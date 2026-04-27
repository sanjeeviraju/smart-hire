from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AuthRegister(BaseModel):
    full_name: str
    email: EmailStr
    company_name: str
    password: str = Field(min_length=8)


class AuthLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class HRUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    company_name: str
    is_active: bool
    created_at: datetime
