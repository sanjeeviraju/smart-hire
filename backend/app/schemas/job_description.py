from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

JobHiringStatus = Literal['active', 'applications_closed', 'hiring_ended']


class JobDescriptionBase(BaseModel):
    title: str
    department: str
    description: str
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    min_experience_years: float = 0
    max_experience_years: float | None = None
    education_requirement: str = "Bachelor's"
    screening_threshold: int = Field(default=60, ge=0, le=100)


class JobDescriptionCreate(JobDescriptionBase):
    pass


class JobDescriptionUpdate(BaseModel):
    title: str | None = None
    department: str | None = None
    description: str | None = None
    required_skills: list[str] | None = None
    preferred_skills: list[str] | None = None
    min_experience_years: float | None = None
    max_experience_years: float | None = None
    education_requirement: str | None = None
    screening_threshold: int | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None
    hiring_status: JobHiringStatus | None = None


class JobDescriptionStatusUpdate(BaseModel):
    hiring_status: JobHiringStatus


class JobDescriptionRead(JobDescriptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hr_user_id: int
    is_active: bool
    hiring_status: JobHiringStatus
    created_at: datetime
    candidate_count: int = 0
    pass_rate: float = 0.0
