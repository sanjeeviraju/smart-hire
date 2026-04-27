from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.candidate import Candidate
from app.models.job_description import JobDescription
from app.services.activity_service import log_activity
from app.services.screening_service import run_screening_for_candidates
from app.tasks.celery_app import celery_app


@celery_app.task(bind=True)
def screen_candidates_task(self, jd_id: int, hr_user_id: int) -> dict:
    db: Session = SessionLocal()
    try:
        jd = db.query(JobDescription).filter(JobDescription.id == jd_id, JobDescription.hr_user_id == hr_user_id).first()
        if jd is None:
            return {'processed': 0, 'total': 0, 'error': 'JD not found'}

        candidate_ids = [
            candidate.id
            for candidate in db.query(Candidate)
            .filter(Candidate.job_description_id == jd_id)
            .order_by(Candidate.created_at.asc())
            .all()
        ]
        total = len(candidate_ids)
        results = run_screening_for_candidates(db, jd_id, candidate_ids)

        try:
            passed = len([item for item in results if item['passed']])
            failed = len(results) - passed
            log_activity(
                db,
                hr_user_id,
                'screening_done',
                f'Screened {len(results)} candidate(s) for {jd.title} - {passed} passed, {failed} failed',
            )
        except Exception:
            pass

        self.update_state(state='PROGRESS', meta={'current': total, 'total': total})
        return {'processed': len(results), 'total': total}
    finally:
        db.close()
