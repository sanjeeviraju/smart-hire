from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models.candidate import CandidateStatus


class ResumeScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    candidate_id: int | None = None
    jd_id: int | None = None
    skill_score: float
    exp_score: float
    edu_score: float
    project_score: float
    overall_score: float
    passed: bool
    matched_skills: list[str]
    missing_skills: list[str]
    screened_at: datetime


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_description_id: int
    full_name: str
    email: str | None = ""
    phone: str | None
    resume_url: str
    extracted_skills: list[str]
    extracted_experience_years: float
    extracted_education: str
    extracted_projects: list[dict[str, Any]]
    resume_text: str
    status: CandidateStatus
    selection: str | None = None
    interview_token_expires: datetime | None
    created_at: datetime
    resume_score: ResumeScoreResponse | None = None


class CandidateListResponse(BaseModel):
    items: list[CandidateRead]
    total: int


class CandidateDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    jd_id: int
    full_name: str
    email: str
    phone: str | None
    skills: list[str]
    years_of_experience: float
    education_level: str | None
    projects: str | None
    resume_url: str | None
    resume_filename: str | None
    resume_text: str | None
    status: str
    selection: str | None = None
    created_at: datetime
    updated_at: datetime
    resume_score: ResumeScoreResponse | None = None


class ScreeningRequest(BaseModel):
    candidate_ids: list[int]
    skill_importance: int = 4
    exp_importance: int = 3
    edu_importance: int = 2
    project_importance: int = 2
    active_skills: list[str] | None = None
    threshold: float | None = None

    @field_validator('skill_importance', 'exp_importance', 'edu_importance', 'project_importance')
    @classmethod
    def importance_range(cls, value: int) -> int:
        if not 1 <= value <= 5:
            raise ValueError('Importance must be 1-5')
        return value

    @field_validator('threshold')
    @classmethod
    def threshold_range(cls, value: float | None) -> float | None:
        if value is not None and not 0 <= value <= 100:
            raise ValueError('Threshold must be 0-100')
        return value


class ScreeningResultItem(BaseModel):
    candidate_id: int
    candidate_name: str
    skill_score: float
    exp_score: float
    edu_score: float
    project_score: float
    overall_score: float
    passed: bool
    matched_skills: list[str]
    missing_skills: list[str]


class ScreeningResponse(BaseModel):
    results: list[ScreeningResultItem]
    total_screened: int
    total_passed: int
    total_failed: int


class CandidateStatusUpdate(BaseModel):
    status: CandidateStatus


class SelectionUpdate(BaseModel):
    selection: str | None = None

    @field_validator('selection')
    @classmethod
    def validate_selection(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in {'selected', 'rejected'}:
            raise ValueError("selection must be 'selected', 'rejected', or null")
        return value


class CandidateBulkAction(BaseModel):
    candidate_ids: list[int]
    force_regenerate: bool = False


class SendInterviewRequest(BaseModel):
    candidate_ids: list[int]
    force_resend: bool = False


class SendInterviewResultItem(BaseModel):
    candidate_id: int
    success: bool
    token: str | None = None
    error: str | None = None


class BulkCandidateDeleteRequest(BaseModel):
    candidate_ids: list[int]


class CandidateUploadResponse(BaseModel):
    uploaded: int
    failed: list[dict[str, str]]


class SendInterviewResponse(BaseModel):
    sent: int
    results: list[SendInterviewResultItem]


class InterviewTrackingItem(BaseModel):
    candidate_id: int
    candidate_name: str
    email: str
    overall_score: float | None
    sent_at: datetime
    opened_at: datetime | None
    completed_at: datetime | None
    is_used: bool
    status: str
    can_force_resend: bool
