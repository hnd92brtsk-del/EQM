from app.db.base import Base

try:
    from app.db.session import SessionLocal, engine
except ModuleNotFoundError:  # pragma: no cover - allows sqlite-only tests when postgres driver is unavailable
    SessionLocal = None
    engine = None

__all__ = ["Base", "SessionLocal", "engine"]
