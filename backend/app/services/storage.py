from urllib.parse import urlparse

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)


def upload_bytes(bucket: str, path: str, content: bytes, content_type: str) -> str:
    settings = get_settings()
    client = get_supabase_client()
    options = {'content-type': content_type, 'upsert': 'false'}

    try:
        client.storage.from_(bucket).upload(path, content, options)
        return client.storage.from_(bucket).get_public_url(path)
    except Exception as exc:
        message = str(exc)
        if 'Name or service not known' in message or 'Failed to resolve' in message:
            host = urlparse(settings.supabase_url).hostname or settings.supabase_url
            raise RuntimeError(
                f'Unable to resolve Supabase host "{host}". Check SUPABASE_URL in backend/.env.'
            ) from exc
        raise
