from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    'ai_hiring_platform',
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=['app.tasks.screening'],
)
celery_app.conf.update(task_track_started=True)
