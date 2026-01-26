from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from contextlib import contextmanager
import os

from app.config import get_settings

settings = get_settings()

# Ensure data directory exists
db_path = settings.database_url.replace("sqlite:///", "").replace("./", "")
db_dir = os.path.dirname(db_path)
if db_dir:
    os.makedirs(db_dir, exist_ok=True)

# Create SQLite engine with check_same_thread=False for FastAPI
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency for getting database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from app.models import (
        product, requirement, requirement_version,
        code_link, test_link, delivery_link,
        release_snapshot, jira_settings, jira_story_draft, attachment
    )
    Base.metadata.create_all(bind=engine)


def check_database_connection() -> bool:
    """Check if database is connected."""
    try:
        with get_db_context() as db:
            db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
