import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.hr_user import HRUser

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    expires_delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    payload: dict[str, Any] = {'sub': str(subject), 'exp': expire, 'type': 'access'}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def get_current_hr_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> HRUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing authentication token')

    try:
        payload = decode_token(credentials.credentials)
        if payload.get('type') != 'access':
            raise ValueError('Invalid token type')
        user_id = int(payload['sub'])
    except (JWTError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token') from exc

    user = db.query(HRUser).filter(HRUser.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found')
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account disabled')
    return user


def create_interview_token(candidate_id: int) -> tuple[str, datetime]:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.interview_token_expire_hours)
    payload = {'sub': str(candidate_id), 'scope': 'interview', 'exp': expires_at}
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token, expires_at


def verify_interview_token(token: str) -> int:
    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise ValueError('Invalid token') from exc

    if payload.get('scope') != 'interview':
        raise ValueError('Invalid token scope')

    try:
        return int(payload['sub'])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError('Invalid token subject') from exc


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()
