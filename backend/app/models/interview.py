from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Interview(Base):
    __tablename__ = 'interviews'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False, index=True)
    jd_id: Mapped[int] = mapped_column(ForeignKey('job_descriptions.id', ondelete='CASCADE'), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false', nullable=False)
    force_sent_count: Mapped[int] = mapped_column(Integer, default=0, server_default='0', nullable=False)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default='false', nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    candidate = relationship('Candidate', back_populates='interviews')
    job_description = relationship('JobDescription', back_populates='interviews')
