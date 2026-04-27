from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InterviewAnswer(Base):
    __tablename__ = 'interview_answers'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    question_index: Mapped[int] = mapped_column(nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(80), nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    score: Mapped[float | None] = mapped_column(default=None)
    ai_feedback: Mapped[dict | None] = mapped_column(JSON, default=None)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    session = relationship('InterviewSession', back_populates='answers')
