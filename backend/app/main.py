import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

logging.basicConfig(
    level=logging.WARNING,
    format="%(name)s | %(levelname)s | %(message)s"
)
logging.getLogger("app").setLevel(logging.INFO)
logging.getLogger("app.services.resume_parser").setLevel(logging.INFO)

for noisy in [
    "httpcore", "httpx", "hpack",
    "python_multipart", "urllib3",
    "uvicorn.access",
]:
    logging.getLogger(noisy).setLevel(logging.ERROR)

settings = get_settings()

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
async def startup_event() -> None:
    parser_logger = logging.getLogger("app")
    from app.services.resume_parser import get_spacy_nlp

    nlp = get_spacy_nlp()
    if nlp:
        parser_logger.info("[Startup] spaCy NER model ready")
    else:
        parser_logger.warning(
            "[Startup] spaCy NER not available - "
            "install with: python -m spacy download en_core_web_trf"
        )


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}
