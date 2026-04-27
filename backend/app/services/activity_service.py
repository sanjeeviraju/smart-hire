import logging

from sqlalchemy.orm import Session

from app.models.activity import Activity

logger = logging.getLogger(__name__)


def log_activity(
    db: Session,
    hr_user_id: int,
    type: str,
    message: str,
) -> None:
    """
    Create an Activity record in the database.
    Called after every significant user action.
    Never raises — catches all exceptions silently
    so activity logging never breaks the main flow.
    """
    try:
        activity = Activity(
            hr_user_id=hr_user_id,
            type=type,
            message=message,
        )
        db.add(activity)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"[ACTIVITY] Failed to log: {exc}")
