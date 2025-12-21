from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import event

from app.core.config import get_settings
from app.db.base import VersionMixin

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


@event.listens_for(Session, "before_flush")
def bump_row_version(session: Session, flush_context, instances):
    for obj in session.dirty:
        if isinstance(obj, VersionMixin):
            current = getattr(obj, "row_version", None) or 0
            setattr(obj, "row_version", current + 1)
