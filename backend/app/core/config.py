from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    project_name: str = 'AI Hiring Platform'
    api_v1_prefix: str = '/api/v1'

    database_url: str
    secret_key: str
    algorithm: str = 'HS256'
    access_token_expire_minutes: int = 60 * 24

    gemini_api_key: str = ''
    gemini_generation_model: str = 'gemini-2.5-pro'
    gemini_analysis_model: str = 'gemini-2.5-pro'
    gemini_transcription_model: str = 'gemini-2.0-flash'

    supabase_url: str
    supabase_service_key: str
    supabase_bucket_resumes: str = 'resumes'
    supabase_bucket_interviews: str = 'interviews'

    smtp_host: str = 'smtp.gmail.com'
    smtp_port: int = 587
    smtp_user: str = ''
    smtp_password: str = ''
    smtp_from_name: str = 'Smart Hiring Platform'
    smtp_from_email: str = ''
    frontend_url: str = 'http://localhost:5173'
    company_name: str = 'Smart Hiring Technologies'

    redis_url: str = 'redis://redis:6379/0'
    interview_token_expire_hours: int = 48
    proctor_warning_limit: int = 4
    proctor_yolo_model: str = 'yolov8n-face.pt'
    proctor_frame_confidence: float = 0.35


@lru_cache
def get_settings() -> Settings:
    return Settings()
