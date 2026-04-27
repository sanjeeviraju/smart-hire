from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


JOB_HIRING_STATUSES = ('active', 'applications_closed', 'hiring_ended')


class JobDescription(Base):
    __tablename__ = 'job_descriptions'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    hr_user_id: Mapped[int] = mapped_column(ForeignKey('hr_users.id', ondelete='CASCADE'), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    preferred_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    min_experience_years: Mapped[float] = mapped_column(default=0.0, nullable=False)
    max_experience_years: Mapped[float | None] = mapped_column(default=None)
    education_requirement: Mapped[str] = mapped_column(String(100), default='Bachelor\'s', nullable=False)
    screening_threshold: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    hiring_status: Mapped[str] = mapped_column(String(32), default='active', nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    hr_user = relationship('HRUser', back_populates='job_descriptions')
    candidates = relationship('Candidate', back_populates='job_description', cascade='all, delete-orphan')
    interviews = relationship('Interview', back_populates='job_description', cascade='all, delete-orphan')
