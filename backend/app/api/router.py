from fastapi import APIRouter

from app.api.routes import auth, candidates, dashboard, interview, jd

api_router = APIRouter()
api_router.include_router(auth.router, prefix='/auth', tags=['auth'])
api_router.include_router(jd.router, prefix='/jd', tags=['job-descriptions'])
api_router.include_router(candidates.router, tags=['candidates'])
api_router.include_router(interview.router, prefix='/interview', tags=['interview'])
api_router.include_router(dashboard.router, prefix='/dashboard', tags=['dashboard'])
