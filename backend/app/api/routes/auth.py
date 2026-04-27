from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_hr_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.hr_user import HRUser
from app.schemas.auth import AuthLogin, AuthRegister, HRUserResponse, TokenResponse

router = APIRouter()


@router.post('/register', response_model=HRUserResponse)
def register(payload: AuthRegister, db: Session = Depends(get_db)) -> HRUser:
    try:
        exists = db.query(HRUser).filter(HRUser.email == payload.email.lower()).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email already registered')

        user = HRUser(
            full_name=payload.full_name.strip(),
            email=payload.email.lower(),
            company_name=payload.company_name.strip(),
            hashed_password=hash_password(payload.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Registration failed because the database is unavailable or the schema has not been initialized. Run alembic upgrade head against the configured DATABASE_URL.',
        ) from exc


@router.post('/login', response_model=TokenResponse)
def login(payload: AuthLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(HRUser).filter(HRUser.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account disabled')

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token)


@router.get('/me', response_model=HRUserResponse)
def me(current_user: HRUser = Depends(get_current_hr_user)) -> HRUser:
    return current_user
