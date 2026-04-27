from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ResumeScore(Base):
    __tablename__ = 'resume_scores'
    __table_args__ = (
        UniqueConstraint('candidate_id', 'jd_id', name='uq_resume_scores_candidate_jd'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('candidates.id', ondelete='CASCADE'), nullable=False, index=True)
    jd_id: Mapped[int] = mapped_column(ForeignKey('job_descriptions.id', ondelete='CASCADE'), nullable=False, index=True)
    skill_score: Mapped[float] = mapped_column(nullable=False)
    exp_score: Mapped[float] = mapped_column(nullable=False)
    edu_score: Mapped[float] = mapped_column(nullable=False)
    project_score: Mapped[float] = mapped_column(nullable=False)
    overall_score: Mapped[float] = mapped_column(nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    matched_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    missing_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    screened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    candidate = relationship('Candidate', back_populates='resume_score')
    job_description = relationship('JobDescription')
