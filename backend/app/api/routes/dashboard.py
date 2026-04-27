from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_hr_user
from app.db.session import get_db
from app.models.activity import Activity
from app.models.candidate import Candidate, CandidateStatus, ensure_candidate_selection_column
from app.models.hr_user import HRUser
from app.models.interview_session import InterviewSession, InterviewSessionStatus
from app.models.job_description import JobDescription
from app.models.resume_score import ResumeScore
from app.schemas.activity import ActivityResponse
from app.schemas.dashboard import (
    CandidateInterviewDetailResponse,
    DashboardStatsResponse,
    InterviewAnswerDetail,
    InterviewResultItem,
    JDInterviewResultsResponse,
)

router = APIRouter()


@router.get('/stats', response_model=DashboardStatsResponse)
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> DashboardStatsResponse:
    owned_jds = db.query(JobDescription.id).filter(
        JobDescription.hr_user_id == current_user.id,
        JobDescription.is_active.is_(True),
    )

    total_jds = (
        db.query(func.count(JobDescription.id))
        .filter(JobDescription.hr_user_id == current_user.id, JobDescription.is_active.is_(True))
        .scalar()
        or 0
    )
    total_candidates = db.query(func.count(Candidate.id)).filter(Candidate.job_description_id.in_(owned_jds)).scalar() or 0
    screened = (
        db.query(func.count(Candidate.id))
        .filter(
            Candidate.job_description_id.in_(owned_jds),
            Candidate.status.in_(
                [
                    CandidateStatus.SCREENED,
                    CandidateStatus.SHORTLISTED,
                    CandidateStatus.INTERVIEW_SENT,
                    CandidateStatus.INTERVIEWED,
                    CandidateStatus.SELECTED,
                ]
            ),
        )
        .scalar()
        or 0
    )
    interviews_sent = (
        db.query(func.count(Candidate.id))
        .filter(Candidate.job_description_id.in_(owned_jds), Candidate.status == CandidateStatus.INTERVIEW_SENT)
        .scalar()
        or 0
    )
    interviewed = (
        db.query(func.count(Candidate.id))
        .filter(Candidate.job_description_id.in_(owned_jds), Candidate.status == CandidateStatus.INTERVIEWED)
        .scalar()
        or 0
    )

    return DashboardStatsResponse(
        total_jds=total_jds,
        total_candidates=total_candidates,
        screened=screened,
        interviews_sent=interviews_sent,
        interviewed=interviewed,
    )


@router.get('/activity', response_model=list[ActivityResponse])
def dashboard_activity(
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> list[Activity]:
    return (
        db.query(Activity)
        .filter(Activity.hr_user_id == current_user.id)
        .order_by(Activity.created_at.desc())
        .limit(20)
        .all()
    )


@router.delete('/activity/{activity_id}')
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> dict[str, int]:
    activity = db.query(Activity).filter(Activity.id == activity_id).first()
    if activity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Activity not found')
    if activity.hr_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not authorized to delete this activity')

    db.delete(activity)
    db.commit()
    return {'deleted': activity_id}


@router.get('/jd/{jd_id}/results', response_model=JDInterviewResultsResponse)
def jd_interview_results(
    jd_id: int,
    recommendation: str | None = Query(default=None),
    sort: str = Query(default='desc'),
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> JDInterviewResultsResponse:
    ensure_candidate_selection_column(db)
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id, JobDescription.hr_user_id == current_user.id).first()
    if jd is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='JD not found')

    rows = (
        db.query(Candidate, InterviewSession)
        .join(InterviewSession, InterviewSession.candidate_id == Candidate.id)
        .join(JobDescription, Candidate.job_description_id == JobDescription.id)
        .filter(
            Candidate.job_description_id == jd_id,
            JobDescription.hr_user_id == current_user.id,
            InterviewSession.status == InterviewSessionStatus.COMPLETED,
        )
        .all()
    )

    items: list[InterviewResultItem] = []
    for candidate, session in rows:
        rec = (session.recommendation or '').strip()
        if recommendation and rec.lower() != recommendation.strip().lower():
            continue
        items.append(
            InterviewResultItem(
                candidate_id=candidate.id,
                candidate_name=candidate.full_name,
                email=candidate.email,
                total_score=session.total_score,
                recommendation=session.recommendation,
                status=candidate.status,
                completed_at=session.completed_at,
            )
        )

    reverse = sort.lower() != 'asc'
    items.sort(key=lambda x: (x.total_score is None, x.total_score or 0.0), reverse=reverse)

    return JDInterviewResultsResponse(jd_id=jd_id, total=len(items), items=items)


@router.get('/candidate/{candidate_id}/interview', response_model=CandidateInterviewDetailResponse)
def candidate_interview_detail(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> CandidateInterviewDetailResponse:
    ensure_candidate_selection_column(db)
    candidate = (
        db.query(Candidate)
        .join(JobDescription, Candidate.job_description_id == JobDescription.id)
        .options(
            joinedload(Candidate.job_description),
            joinedload(Candidate.interview_session).joinedload(InterviewSession.answers),
        )
        .filter(Candidate.id == candidate_id, JobDescription.hr_user_id == current_user.id)
        .first()
    )
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Candidate not found')
    if candidate.interview_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Interview session not found')

    session = candidate.interview_session
    answers = sorted(session.answers or [], key=lambda x: x.question_index)
    answer_items = [InterviewAnswerDetail.model_validate(answer) for answer in answers]

    return CandidateInterviewDetailResponse(
        candidate_id=candidate.id,
        candidate_name=candidate.full_name,
        email=candidate.email,
        job_title=candidate.job_description.title if candidate.job_description else 'Unknown',
        status=candidate.status,
        interview_date=session.completed_at or session.started_at,
        total_score=session.total_score,
        technical_score=session.technical_score,
        communication_score=session.communication_score,
        behavioral_score=session.behavioral_score,
        confidence_score=session.confidence_score,
        recommendation=session.recommendation,
        ai_analysis=session.ai_analysis,
        video_url=session.video_url,
        answers=answer_items,
    )
