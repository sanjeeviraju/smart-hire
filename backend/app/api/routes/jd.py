from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from app.api.deps import get_current_hr_user
from app.db.session import get_db
from app.models.candidate import Candidate
from app.models.hr_user import HRUser
from app.models.job_description import JobDescription
from app.models.resume_score import ResumeScore
from app.schemas.job_description import JobDescriptionCreate, JobDescriptionRead, JobDescriptionStatusUpdate, JobDescriptionUpdate
from app.services.activity_service import log_activity

router = APIRouter()


def _attach_jd_metrics(jd: JobDescription, candidate_count: int | None, passed_count: int | None) -> JobDescription:
    total_candidates = int(candidate_count or 0)
    total_passed = int(passed_count or 0)
    jd.candidate_count = total_candidates
    jd.pass_rate = round((total_passed / total_candidates) * 100, 2) if total_candidates else 0.0
    return jd


def _get_owned_jd(db: Session, jd_id: int, hr_user_id: int) -> JobDescription:
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id, JobDescription.hr_user_id == hr_user_id).first()
    if jd is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='JD not found')
    return jd


@router.post('/', response_model=JobDescriptionRead)
def create_jd(
    payload: JobDescriptionCreate,
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> JobDescription:
    jd = JobDescription(
        hr_user_id=current_user.id,
        title=payload.title,
        department=payload.department,
        description=payload.description,
        required_skills=payload.required_skills,
        preferred_skills=payload.preferred_skills,
        min_experience_years=payload.min_experience_years,
        max_experience_years=payload.max_experience_years,
        education_requirement=payload.education_requirement,
        screening_threshold=payload.screening_threshold,
    )
    db.add(jd)
    db.commit()
    db.refresh(jd)
    try:
        log_activity(
            db,
            current_user.id,
            'jd_created',
            f'New JD created: {jd.title}',
        )
    except Exception:
        pass
    return jd


@router.get('/', response_model=list[JobDescriptionRead])
def list_jds(
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> list[JobDescription]:
    rows = (
        db.query(JobDescription)
        .outerjoin(Candidate, Candidate.job_description_id == JobDescription.id)
        .outerjoin(ResumeScore, and_(ResumeScore.candidate_id == Candidate.id, ResumeScore.jd_id == JobDescription.id))
        .with_entities(
            JobDescription,
            func.count(Candidate.id).label('candidate_count'),
            func.coalesce(
                func.sum(case((ResumeScore.passed.is_(True), 1), else_=0)),
                0,
            ).label('passed_count'),
        )
        .filter(JobDescription.hr_user_id == current_user.id, JobDescription.is_active.is_(True))
        .group_by(JobDescription.id)
        .order_by(JobDescription.created_at.desc())
        .all()
    )
    return [_attach_jd_metrics(jd, candidate_count, passed_count) for jd, candidate_count, passed_count in rows]


@router.get('/{jd_id}', response_model=JobDescriptionRead)
def get_jd(
    jd_id: int,
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> JobDescription:
    row = (
        db.query(JobDescription)
        .outerjoin(Candidate, Candidate.job_description_id == JobDescription.id)
        .outerjoin(ResumeScore, and_(ResumeScore.candidate_id == Candidate.id, ResumeScore.jd_id == JobDescription.id))
        .with_entities(
            JobDescription,
            func.count(Candidate.id).label('candidate_count'),
            func.coalesce(
                func.sum(case((ResumeScore.passed.is_(True), 1), else_=0)),
                0,
            ).label('passed_count'),
        )
        .filter(
            JobDescription.id == jd_id,
            JobDescription.hr_user_id == current_user.id,
            JobDescription.is_active.is_(True),
        )
        .group_by(JobDescription.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='JD not found')
    jd, candidate_count, passed_count = row
    return _attach_jd_metrics(jd, candidate_count, passed_count)


@router.put('/{jd_id}', response_model=JobDescriptionRead)
def update_jd(
    jd_id: int,
    payload: JobDescriptionUpdate,
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> JobDescription:
    jd = _get_owned_jd(db, jd_id, current_user.id)

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(jd, key, value)

    db.commit()
    db.refresh(jd)
    return jd


@router.patch('/{jd_id}/status', response_model=JobDescriptionRead)
def update_jd_status(
    jd_id: int,
    payload: JobDescriptionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> JobDescription:
    jd = _get_owned_jd(db, jd_id, current_user.id)
    jd.hiring_status = payload.hiring_status
    db.commit()
    db.refresh(jd)
    try:
        status_message = {
            'active': f'JD reopened: {jd.title}',
            'applications_closed': f'Applications closed for {jd.title}',
            'hiring_ended': f'Hiring ended for {jd.title}',
        }[payload.hiring_status]
        log_activity(db, current_user.id, 'jd_status_changed', status_message)
    except Exception:
        pass
    return jd


@router.delete('/{jd_id}')
def deactivate_jd(
    jd_id: int,
    db: Session = Depends(get_db),
    current_user: HRUser = Depends(get_current_hr_user),
) -> dict[str, str]:
    jd = _get_owned_jd(db, jd_id, current_user.id)

    jd.is_active = False
    db.commit()
    try:
        log_activity(
            db,
            current_user.id,
            'jd_deleted',
            f'JD deleted: {jd.title}',
        )
    except Exception:
        pass
    return {'message': 'Job description deleted'}
