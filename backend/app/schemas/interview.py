from datetime import datetime
from typing import Any

from pydantic import BaseModel


class InterviewTokenValidationResponse(BaseModel):
    valid: bool
    message: str
    candidate_name: str | None = None
    job_title: str | None = None
    expires_at: datetime | None = None
    started: bool = False
    completed: bool = False


class InterviewEmailVerificationRequest(BaseModel):
    email: str


class InterviewEmailVerificationResponse(BaseModel):
    verified: bool
    message: str


class InterviewQuestionRead(BaseModel):
    question_index: int
    question_text: str
    question_type: str
    total_questions: int


class InterviewStartResponse(BaseModel):
    message: str
    total_questions: int
    time_limit_minutes: int
    warning_limit: int


class InterviewAnswerSubmitResponse(BaseModel):
    message: str
    question_index: int
    next_question_index: int | None
    total_questions: int
    interview_completed: bool
    answer_saved: bool = True


class InterviewCompleteResponse(BaseModel):
    message: str
    completed: bool


class ProctorEventRequest(BaseModel):
    event_type: str
    metadata: dict[str, Any] | None = None


class ProctoringCheckResponse(BaseModel):
    ok: bool
    suspicious: bool
    warning_count: int
    warning_limit: int
    terminate_interview: bool
    reasons: list[str]
    message: str
    face_count: int | None = None
    model: str | None = None
