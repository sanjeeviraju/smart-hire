import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, JSON, String, Text, inspect, text
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from app.db.base import Base


class CandidateStatus(str, enum.Enum):
    UPLOADED = 'Uploaded'
    SCREENED = 'Screened'
    SHORTLISTED = 'Shortlisted'
    INTERVIEW_SENT = 'Interview Sent'
    INTERVIEWED = 'Interviewed'
    SELECTED = 'Selected'
    REJECTED = 'Rejected'


candidate_status_enum = Enum(
    CandidateStatus,
    name='candidatestatus',
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
)

_selection_column_checked = False


def ensure_candidate_selection_column(db: Session) -> None:
    global _selection_column_checked

    if _selection_column_checked:
        return

    bind = db.get_bind()
    inspector = inspect(bind)
    columns = {column['name'] for column in inspector.get_columns('candidates')}
    if 'selection' not in columns:
        db.execute(text('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS selection VARCHAR(20)'))
        db.commit()

    _selection_column_checked = True


class Candidate(Base):
    __tablename__ = 'candidates'

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    job_description_id: Mapped[int] = mapped_column(ForeignKey('job_descriptions.id', ondelete='CASCADE'), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(80), nullable=True)
    resume_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    resume_text: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_skills: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    extracted_experience_years: Mapped[float] = mapped_column(default=0.0, nullable=False)
    extracted_education: Mapped[str] = mapped_column(String(100), default='Unknown', nullable=False)
    extracted_projects: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[CandidateStatus] = mapped_column(
        candidate_status_enum,
        default=CandidateStatus.UPLOADED,
        nullable=False,
        index=True,
    )
    selection: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    interview_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    interview_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interview_token_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    job_description = relationship('JobDescription', back_populates='candidates')
    resume_score = relationship(
        'ResumeScore',
        back_populates='candidate',
        uselist=False,
        cascade='all, delete-orphan',
        passive_deletes=True,
    )
    interview_session = relationship(
        'InterviewSession',
        back_populates='candidate',
        uselist=False,
        cascade='all, delete-orphan',
        passive_deletes=True,
    )
    interviews = relationship(
        'Interview',
        back_populates='candidate',
        cascade='all, delete-orphan',
        passive_deletes=True,
    )
