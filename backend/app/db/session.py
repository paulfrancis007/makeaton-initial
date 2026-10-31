import logging
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

logger = logging.getLogger(__name__)

# Synchronous SQLAlchemy 2.x Engine with Psycopg 3
# pool_pre_ping=True checks connections on checkout from the pool to guard against stale sockets
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

# Session factory producing transactional Session objects
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a scoped transactional database session.
    Guarantees session closure upon completion of the HTTP request lifecycle.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_health() -> bool:
    """
    Executes a simple 'SELECT 1' probe to verify PostgreSQL connectivity.
    Catches and logs exceptions safely without leaking connection credentials.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1;"))
        return True
    except SQLAlchemyError as exc:
        logger.error("Database health probe failed (SQLAlchemyError): %s", type(exc).__name__)
        return False
    except Exception as exc:
        logger.error("Database health probe failed: %s", type(exc).__name__)
        return False
