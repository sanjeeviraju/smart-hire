import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InterviewSessionStatus(str, enum.Enum):
    NOT_STARTED = 'NOT_STARTED'
    STARTED = 'STARTED'
    COMPLETED = 'COMPLETED'


class InterviewSession(Base):
    __tablename__ = 'interview_sessions'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    status: Mapped[InterviewSessionStatus] = mapped_column(Enum(InterviewSessionStatus), default=InterviewSessionStatus.NOT_STARTED, nullable=False)
    questions: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    video_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_score: Mapped[float | None] = mapped_column(default=None)
    communication_score: Mapped[float | None] = mapped_column(default=None)
    technical_score: Mapped[float | None] = mapped_column(default=None)
    behavioral_score: Mapped[float | None] = mapped_column(default=None)
    confidence_score: Mapped[float | None] = mapped_column(default=None)
    ai_analysis: Mapped[dict | None] = mapped_column(JSON, default=None)
    recommendation: Mapped[str | None] = mapped_column(String(120), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    candidate = relationship('Candidate', back_populates='interview_session')
    answers = relationship(
        'InterviewAnswer',
        back_populates='session',
        cascade='all, delete-orphan',
        passive_deletes=True,
    )
