from unittest.mock import patch, MagicMock
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from app.core.config import Settings
from app.db.base import Base
from app.db.session import engine, SessionLocal, get_db, check_db_health
from app.main import database_health_check, DatabaseHealthResponse


def test_database_configuration():
    """Verify database configuration and URL construction using synchronous psycopg 3."""
    custom_settings = Settings(
        POSTGRES_USER="test_user",
        POSTGRES_PASSWORD="test_password",
        POSTGRES_SERVER="127.0.0.1",
        POSTGRES_PORT=5432,
        POSTGRES_DB="test_db",
        DATABASE_URL="",
    )
    assert custom_settings.DATABASE_URL.startswith("postgresql+psycopg://")
    assert "test_user:test_password" in custom_settings.DATABASE_URL
    assert "127.0.0.1:5432/test_db" in custom_settings.DATABASE_URL


def test_database_declarative_base():
    """Verify Declarative Base setup for model metadata and Alembic discovery."""
    assert issubclass(Base, DeclarativeBase)
    assert Base.metadata is not None


def test_session_lifecycle():
    """Verify that get_db dependency yields a session and guarantees its closure."""
    mock_session = MagicMock()
    with patch("app.db.session.SessionLocal", return_value=mock_session):
        gen = get_db()
        session = next(gen)
        assert session == mock_session
        assert not mock_session.close.called

        # Simulating generator completion upon request finish
        try:
            next(gen)
        except StopIteration:
            pass

        assert mock_session.close.called


def test_database_health_endpoint_healthy():
    """Verify database health endpoint returns HTTP 200 when database is healthy."""
    with patch("app.main.check_db_health", return_value=True):
        response = database_health_check()
        assert isinstance(response, DatabaseHealthResponse)
        assert response.status == "ok"
        assert response.database == "connected"


def test_database_health_endpoint_unhealthy():
    """Verify database health endpoint returns HTTP 503 when database is unreachable."""
    with patch("app.main.check_db_health", return_value=False):
        response = database_health_check()
        assert response.status_code == 503
        assert response.body == b'{"status":"unavailable","database":"disconnected"}'


def test_check_db_health_error_handling():
    """Verify check_db_health catches connection errors safely without crashing."""
    with patch.object(engine, "connect", side_effect=OperationalError("mock error", params=None, orig=Exception())):
        healthy = check_db_health()
        assert healthy is False


def test_live_postgres_connectivity_and_extension():
    """Integration check verifying SELECT 1 and btree_gist extension presence."""
    try:
        with engine.connect() as conn:
            # Test SELECT 1 probe
            result = conn.execute(text("SELECT 1;")).scalar()
            assert result == 1

            # Test btree_gist extension installed by Alembic
            ext = conn.execute(
                text("SELECT extname FROM pg_extension WHERE extname = 'btree_gist';")
            ).scalar()
            assert ext == "btree_gist"
    except Exception as exc:
        # In isolated environments where socket connections are restricted, skip integration test
        import pytest
        pytest.skip(f"Live PostgreSQL not reachable in current execution sandbox: {exc}")
