from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.candidate import CandidateStatus


class DashboardStatsResponse(BaseModel):
    total_jds: int
    total_candidates: int
    screened: int
    interviews_sent: int
    interviewed: int


class ActivityItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    message: str
    created_at: datetime


DashboardStats = DashboardStatsResponse


class InterviewResultItem(BaseModel):
    candidate_id: int
    candidate_name: str
    email: EmailStr
    total_score: float | None
    recommendation: str | None
    status: CandidateStatus
    completed_at: datetime | None


class JDInterviewResultsResponse(BaseModel):
    jd_id: int
    total: int
    items: list[InterviewResultItem]


class InterviewAnswerDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    question_index: int
    question_text: str
    question_type: str
    answer_text: str | None
    video_url: str | None
    score: float | None
    ai_feedback: dict[str, Any] | None
    answered_at: datetime


class CandidateInterviewDetailResponse(BaseModel):
    candidate_id: int
    candidate_name: str
    email: EmailStr
    job_title: str
    status: CandidateStatus
    interview_date: datetime | None
    total_score: float | None
    technical_score: float | None
    communication_score: float | None
    behavioral_score: float | None
    confidence_score: float | None
    recommendation: str | None
    ai_analysis: dict[str, Any] | None
    video_url: str | None
    answers: list[InterviewAnswerDetail]
