from sqlalchemy import create_engine, inspect

from app.core.config import get_settings

settings = get_settings()
print(f"db_url={settings.database_url}")
engine = create_engine(settings.database_url, pool_pre_ping=True)
inspector = inspect(engine)
print(f"tables={inspector.get_table_names()}")
