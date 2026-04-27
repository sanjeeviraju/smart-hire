from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.db.session import get_db
from app.models.candidate import Candidate, CandidateStatus
from app.models.interview import Interview
from app.models.interview_answer import InterviewAnswer
from app.models.interview_session import InterviewSession, InterviewSessionStatus
from app.schemas.interview import (
    InterviewEmailVerificationRequest,
    InterviewEmailVerificationResponse,
    InterviewAnswerSubmitResponse,
    InterviewCompleteResponse,
    InterviewQuestionRead,
    InterviewStartResponse,
    ProctorEventRequest,
    ProctoringCheckResponse,
    InterviewTokenValidationResponse,
)
from app.services.interview_evaluator import evaluate_interview, transcribe_audio_bytes
from app.services.proctoring import analyze_proctor_frame
from app.services.storage import upload_bytes

router = APIRouter()


def _to_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _normalize_email(value: str | None) -> str:
    return (value or '').strip().lower()


def _find_interview_by_token(db: Session, token: str) -> Interview | None:
    return (
        db.query(Interview)
        .options(
            joinedload(Interview.candidate).joinedload(Candidate.interview_session),
            joinedload(Interview.candidate).joinedload(Candidate.job_description),
        )
        .filter(Interview.token == token)
        .order_by(Interview.sent_at.desc())
        .first()
    )


def _get_invitation_context(db: Session, token: str) -> tuple[Interview, Candidate]:
    interview = _find_interview_by_token(db, token)
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Invalid token')

    candidate = interview.candidate
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Candidate not found')

    if interview.is_used:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail='This link has already been used')

    if interview.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail='This link has expired')

    return interview, candidate


def _ensure_session(db: Session, candidate: Candidate) -> InterviewSession:
    if candidate.interview_session is None:
        session = InterviewSession(candidate_id=candidate.id, status=InterviewSessionStatus.NOT_STARTED, questions=[])
        db.add(session)
        db.flush()
        return session
    return candidate.interview_session


def _get_proctor_state(session: InterviewSession) -> dict:
    ai = session.ai_analysis if isinstance(session.ai_analysis, dict) else {}
    proctor = ai.get('proctoring')
    if not isinstance(proctor, dict):
        proctor = {'warnings': 0, 'events': [], 'terminated': False}
    proctor.setdefault('warnings', 0)
    proctor.setdefault('events', [])
    proctor.setdefault('terminated', False)
    ai['proctoring'] = proctor
    session.ai_analysis = ai
    return proctor


def _register_warning(
    *,
    session: InterviewSession,
    candidate: Candidate,
    reasons: list[str],
    force_terminate: bool = False,
) -> tuple[int, int, bool]:
    settings = get_settings()
    warning_limit = int(settings.proctor_warning_limit or 4)
    proctor = _get_proctor_state(session)
    proctor['warnings'] = int(proctor.get('warnings', 0)) + 1
    proctor['events'].append(
        {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'reasons': reasons,
        }
    )
    warnings = int(proctor['warnings'])
    terminate = force_terminate or warnings >= warning_limit
    if terminate:
        proctor['terminated'] = True
        proctor['terminated_reason'] = reasons[0] if reasons else 'proctoring_limit_exceeded'
        session.status = InterviewSessionStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)
        session.total_score = session.total_score or 0.0
        session.technical_score = session.technical_score or 0.0
        session.communication_score = session.communication_score or 0.0
        session.behavioral_score = session.behavioral_score or 0.0
        session.confidence_score = session.confidence_score or 0.0
        session.recommendation = 'Not Recommended'
        ai = session.ai_analysis if isinstance(session.ai_analysis, dict) else {}
        ai.setdefault('key_strengths', [])
        ai.setdefault('key_concerns', [])
        ai.setdefault('cultural_fit_assessment', '')
        ai.setdefault('narrative_analysis', '')
        ai.setdefault('hire_recommendation_reason', '')
        ai['proctoring'] = proctor
        session.ai_analysis = ai
        candidate.status = CandidateStatus.INTERVIEWED
    return warnings, warning_limit, terminate


def _next_expected_question_index(db: Session, session_id: int, total_questions: int) -> int | None:
    answered = {
        x[0]
        for x in db.query(InterviewAnswer.question_index)
        .filter(InterviewAnswer.session_id == session_id)
        .all()
    }
    for idx in range(1, total_questions + 1):
        if idx not in answered:
            return idx
    return None


@router.get('/validate/{token}', response_model=InterviewTokenValidationResponse)
def validate_token(token: str, db: Session = Depends(get_db)) -> InterviewTokenValidationResponse:
    interview = _find_interview_by_token(db, token)
    if interview is None or interview.candidate is None:
        return InterviewTokenValidationResponse(valid=False, message='This interview link is invalid or expired.')

    candidate = interview.candidate
    session = candidate.interview_session
    started = bool(session and session.status == InterviewSessionStatus.STARTED)
    completed = bool(interview.completed_at or (session and session.status == InterviewSessionStatus.COMPLETED))
    expired = bool(interview.expires_at and interview.expires_at < datetime.now(timezone.utc))

    if interview.is_used and not completed:
        return InterviewTokenValidationResponse(valid=False, message='This interview link is no longer active.')
    if expired:
        return InterviewTokenValidationResponse(valid=False, message='This interview link has expired.')
    if completed:
        return InterviewTokenValidationResponse(valid=False, message='Interview already completed.')
    if started:
        return InterviewTokenValidationResponse(valid=False, message='Interview already started or completed.')

    if not interview.opened_at:
        interview.opened_at = datetime.now(timezone.utc)
        db.commit()

    return InterviewTokenValidationResponse(
        valid=True,
        message='Valid interview link.',
        candidate_name=candidate.full_name,
        job_title=candidate.job_description.title if candidate.job_description else None,
        expires_at=interview.expires_at,
        started=started,
        completed=completed,
    )


@router.get('/{token}/open')
def open_interview(token: str, db: Session = Depends(get_db)) -> dict[str, object]:
    interview, candidate = _get_invitation_context(db, token)

    if not interview.opened_at:
        interview.opened_at = datetime.now(timezone.utc)
        db.commit()

    return {
        'valid': True,
        'token': token,
        'jd_id': interview.jd_id,
        'candidate_id': candidate.id,
    }


@router.post('/verify-email/{token}', response_model=InterviewEmailVerificationResponse)
def verify_email(
    token: str,
    payload: InterviewEmailVerificationRequest,
    db: Session = Depends(get_db),
) -> InterviewEmailVerificationResponse:
    try:
        interview, candidate = _get_invitation_context(db, token)
    except HTTPException:
        return InterviewEmailVerificationResponse(
            verified=False,
            message='This interview link is invalid or expired.',
        )

    session = candidate.interview_session
    started = bool(session and session.status == InterviewSessionStatus.STARTED)
    completed = bool(session and session.status == InterviewSessionStatus.COMPLETED)
    if started or completed:
        return InterviewEmailVerificationResponse(
            verified=False,
            message='Interview already started or completed.',
        )

    if not interview.opened_at:
        interview.opened_at = datetime.now(timezone.utc)
        db.commit()

    entered = _normalize_email(payload.email)
    actual = _normalize_email(candidate.email)
    if not entered or entered != actual:
        return InterviewEmailVerificationResponse(
            verified=False,
            message='Please enter the registered email used in your application.',
        )

    return InterviewEmailVerificationResponse(
        verified=True,
        message='Email verified successfully.',
    )


@router.post('/start/{token}', response_model=InterviewStartResponse)
def start_interview(token: str, db: Session = Depends(get_db)) -> InterviewStartResponse:
    interview, candidate = _get_invitation_context(db, token)
    session = _ensure_session(db, candidate)

    if session.status == InterviewSessionStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Interview already completed')
    if session.status == InterviewSessionStatus.STARTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Interview already started')
    if not session.questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Interview questions are not ready')

    if not interview.opened_at:
        interview.opened_at = datetime.now(timezone.utc)
    candidate.interview_token_expires = interview.expires_at
    candidate.interview_token_used = False
    session.status = InterviewSessionStatus.STARTED
    session.started_at = session.started_at or datetime.now(timezone.utc)
    _get_proctor_state(session)
    db.commit()
    settings = get_settings()

    return InterviewStartResponse(
        message='Interview started',
        total_questions=len(session.questions),
        time_limit_minutes=30,
        warning_limit=int(settings.proctor_warning_limit or 4),
    )


@router.get('/question/{token}/{question_index}', response_model=InterviewQuestionRead)
def get_question(token: str, question_index: int, db: Session = Depends(get_db)) -> InterviewQuestionRead:
    _, candidate = _get_invitation_context(db, token)
    session = _ensure_session(db, candidate)

    if session.status != InterviewSessionStatus.STARTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Interview not started')

    questions = session.questions or []
    if question_index < 1 or question_index > len(questions):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Question out of range')

    expected = _next_expected_question_index(db, session.id, len(questions))
    if expected is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='All questions are already answered. Complete the interview.')
    if question_index != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Question sequence violation. Please request question {expected}.',
        )

    q = questions[question_index - 1]
    return InterviewQuestionRead(
        question_index=question_index,
        question_text=q.get('question_text', ''),
        question_type=q.get('question_type', 'general'),
        total_questions=len(questions),
    )


@router.post('/answer/{token}', response_model=InterviewAnswerSubmitResponse)
async def submit_answer(
    token: str,
    question_index: int = Form(...),
    answer_text: str | None = Form(default=None),
    audio: UploadFile | None = File(default=None),
    answer_video: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> InterviewAnswerSubmitResponse:
    _, candidate = _get_invitation_context(db, token)
    session = _ensure_session(db, candidate)

    if session.status != InterviewSessionStatus.STARTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Interview not started')

    questions = session.questions or []
    if question_index < 1 or question_index > len(questions):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Question out of range')

    expected = _next_expected_question_index(db, session.id, len(questions))
    if expected is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='All questions are already answered.')
    if question_index != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Question sequence violation. Next expected question is {expected}.',
        )

    normalized_answer = (answer_text or '').strip()
    audio_url: str | None = None
    answer_video_url: str | None = None

    if audio is not None:
        audio_bytes = await audio.read()
        if audio_bytes:
            settings = get_settings()
            audio_path = (
                f'{candidate.id}/session_{session.id}/q{question_index}_{uuid4().hex}_{audio.filename or "answer.webm"}'
            )
            audio_url = upload_bytes(
                settings.supabase_bucket_interviews,
                audio_path,
                audio_bytes,
                content_type=audio.content_type or 'audio/webm',
            )
            if not normalized_answer:
                normalized_answer = transcribe_audio_bytes(audio_bytes, mime_type=audio.content_type or 'audio/webm')

    if answer_video is not None:
        video_bytes = await answer_video.read()
        if video_bytes:
            settings = get_settings()
            video_path = (
                f'{candidate.id}/session_{session.id}/q{question_index}_{uuid4().hex}_{answer_video.filename or "answer.webm"}'
            )
            answer_video_url = upload_bytes(
                settings.supabase_bucket_interviews,
                video_path,
                video_bytes,
                content_type=answer_video.content_type or 'video/webm',
            )
            # If no text or audio provided, try transcript fallback from uploaded media bytes.
            if not normalized_answer and audio is None:
                normalized_answer = transcribe_audio_bytes(video_bytes, mime_type=answer_video.content_type or 'video/webm')

    if not normalized_answer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Answer text, audio, or answer video is required.')

    q = questions[question_index - 1]
    answer = (
        db.query(InterviewAnswer)
        .filter(InterviewAnswer.session_id == session.id, InterviewAnswer.question_index == question_index)
        .first()
    )
    if answer is None:
        answer = InterviewAnswer(
            session_id=session.id,
            question_index=question_index,
            question_text=q.get('question_text', ''),
            question_type=q.get('question_type', 'general'),
            answer_text=normalized_answer,
            audio_url=audio_url,
            video_url=answer_video_url,
        )
        db.add(answer)
    else:
        answer.answer_text = normalized_answer
        answer.audio_url = audio_url or answer.audio_url
        answer.video_url = answer_video_url or answer.video_url
        answer.answered_at = datetime.now(timezone.utc)

    db.commit()

    next_question_index = question_index + 1 if question_index < len(questions) else None
    interview_completed = next_question_index is None

    return InterviewAnswerSubmitResponse(
        message='Answer saved successfully.',
        question_index=question_index,
        next_question_index=next_question_index,
        total_questions=len(questions),
        interview_completed=interview_completed,
        answer_saved=True,
    )


@router.post('/complete/{token}', response_model=InterviewCompleteResponse)
@router.post('/{token}/complete', response_model=InterviewCompleteResponse)
async def complete_interview(
    token: str,
    video: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> InterviewCompleteResponse:
    interview, candidate = _get_invitation_context(db, token)
    session = _ensure_session(db, candidate)

    if session.status == InterviewSessionStatus.COMPLETED:
        return InterviewCompleteResponse(message='Interview already completed.', completed=True)
    if session.status != InterviewSessionStatus.STARTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Interview not started')

    questions = session.questions or []
    answers = (
        db.query(InterviewAnswer)
        .filter(InterviewAnswer.session_id == session.id)
        .order_by(InterviewAnswer.question_index.asc())
        .all()
    )

    if len(answers) < len(questions):
        next_expected = _next_expected_question_index(db, session.id, len(questions)) or (len(answers) + 1)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Interview is incomplete. Next expected question is {next_expected}.',
        )

    if video is not None:
        video_bytes = await video.read()
        if video_bytes:
            settings = get_settings()
            video_path = f'{candidate.id}/session_{session.id}/full_session_{uuid4().hex}_{video.filename or "session.webm"}'
            session.video_url = upload_bytes(
                settings.supabase_bucket_interviews,
                video_path,
                video_bytes,
                content_type=video.content_type or 'video/webm',
            )

    evaluation_input = [
        {
            'question_index': answer.question_index,
            'question_text': answer.question_text,
            'question_type': answer.question_type,
            'answer_text': answer.answer_text or '',
        }
        for answer in answers
    ]
    evaluation = evaluate_interview(candidate, candidate.job_description, evaluation_input)

    per_answer = evaluation.get('per_answer', [])
    by_index = {
        int(item.get('question_index', 0)): item
        for item in per_answer
        if isinstance(item, dict)
    }

    for answer in answers:
        scored = by_index.get(answer.question_index, {})
        answer.score = _to_float(scored.get('score'), 0.0)
        answer.ai_feedback = {
            'feedback_text': (scored.get('feedback_text') or '').strip(),
            'strengths': scored.get('strengths') or [],
            'improvements': scored.get('improvements') or [],
            'communication_rating': int(_to_float(scored.get('communication_rating'), 1.0)),
            'technical_accuracy_rating': int(_to_float(scored.get('technical_accuracy_rating'), 1.0)),
        }

    summary = evaluation.get('summary', {}) if isinstance(evaluation, dict) else {}
    session.total_score = _to_float(summary.get('total_score'))
    session.technical_score = _to_float(summary.get('technical_score'))
    session.communication_score = _to_float(summary.get('communication_score'))
    session.behavioral_score = _to_float(summary.get('behavioral_score'))
    session.confidence_score = _to_float(summary.get('confidence_score'))
    session.recommendation = str(summary.get('recommendation') or 'Neutral')
    proctor_state = _get_proctor_state(session)
    session.ai_analysis = {
        'key_strengths': summary.get('key_strengths') or [],
        'key_concerns': summary.get('key_concerns') or [],
        'cultural_fit_assessment': summary.get('cultural_fit_assessment') or '',
        'narrative_analysis': summary.get('narrative_analysis') or '',
        'hire_recommendation_reason': summary.get('hire_recommendation_reason') or '',
        'proctoring': proctor_state,
    }
    session.status = InterviewSessionStatus.COMPLETED
    completed_at = datetime.now(timezone.utc)
    session.completed_at = completed_at
    interview.completed_at = completed_at
    interview.is_used = True
    candidate.status = CandidateStatus.INTERVIEWED
    candidate.interview_token_used = True

    db.commit()
    return InterviewCompleteResponse(message='Interview completed successfully. Thank you!', completed=True)


@router.post('/proctor/frame/{token}', response_model=ProctoringCheckResponse)
async def proctor_frame(
    token: str,
    frame: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ProctoringCheckResponse:
    interview, candidate = _get_invitation_context(db, token)
    session = _ensure_session(db, candidate)
    settings = get_settings()
    warning_limit = int(settings.proctor_warning_limit or 4)

    if session.status != InterviewSessionStatus.STARTED:
        return ProctoringCheckResponse(
            ok=False,
            suspicious=False,
            warning_count=int(_get_proctor_state(session).get('warnings', 0)),
            warning_limit=warning_limit,
            terminate_interview=session.status == InterviewSessionStatus.COMPLETED,
            reasons=[],
            message='Interview not in active state.',
        )

    frame_bytes = await frame.read()
    check = analyze_proctor_frame(frame_bytes)
    reasons = list(check.get('reasons') or [])
    suspicious = bool(check.get('suspicious'))

    warning_count = int(_get_proctor_state(session).get('warnings', 0))
    terminate = False
    message = 'Proctoring check passed.'

    if suspicious:
        warning_count, warning_limit, terminate = _register_warning(
            session=session,
            candidate=candidate,
            reasons=reasons or ['proctoring_suspicious_frame'],
        )
        if terminate:
            interview.completed_at = session.completed_at or datetime.now(timezone.utc)
            interview.is_used = True
            candidate.interview_token_used = True
        db.commit()
        if terminate:
            message = 'Interview ended due to repeated proctoring violations.'
        else:
            message = f'Warning {warning_count}/{warning_limit}: {", ".join(reasons)}'

    return ProctoringCheckResponse(
        ok=True,
        suspicious=suspicious,
        warning_count=warning_count,
        warning_limit=warning_limit,
        terminate_interview=terminate,
        reasons=reasons,
        message=message,
        face_count=int(check.get('face_count', 0) or 0),
        model=str(check.get('model') or 'unknown'),
    )


@router.post('/proctor/event/{token}', response_model=ProctoringCheckResponse)
def proctor_event(
    token: str,
    payload: ProctorEventRequest,
    db: Session = Depends(get_db),
) -> ProctoringCheckResponse:
    interview, candidate = _get_invitation_context(db, token)
    session = _ensure_session(db, candidate)
    settings = get_settings()
    warning_limit = int(settings.proctor_warning_limit or 4)

    if session.status != InterviewSessionStatus.STARTED:
        return ProctoringCheckResponse(
            ok=False,
            suspicious=False,
            warning_count=int(_get_proctor_state(session).get('warnings', 0)),
            warning_limit=warning_limit,
            terminate_interview=session.status == InterviewSessionStatus.COMPLETED,
            reasons=[],
            message='Interview not in active state.',
        )

    event_type = (payload.event_type or '').strip().lower()
    reasons = [event_type or 'unknown_event']
    force_terminate = event_type in {'time_limit_exceeded'}
    warning_count, warning_limit, terminate = _register_warning(
        session=session,
        candidate=candidate,
        reasons=reasons,
        force_terminate=force_terminate,
    )
    if terminate:
        interview.completed_at = session.completed_at or datetime.now(timezone.utc)
        interview.is_used = True
        candidate.interview_token_used = True
    db.commit()

    message = (
        'Interview ended due to repeated proctoring violations.'
        if terminate
        else f'Warning {warning_count}/{warning_limit}: {event_type}'
    )
    return ProctoringCheckResponse(
        ok=True,
        suspicious=True,
        warning_count=warning_count,
        warning_limit=warning_limit,
        terminate_interview=terminate,
        reasons=reasons,
        message=message,
    )
