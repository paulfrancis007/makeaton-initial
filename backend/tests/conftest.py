import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_current_db
from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from app.models import Base

settings = get_settings()
test_db_url = settings.TEST_DATABASE_URL or settings.DATABASE_URL

test_engine = create_engine(test_db_url, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Ensure all tables exist on the test database."""
    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture
def db() -> Session:
    """Provides a transactional database session using savepoints so inner commits stay isolated."""
    connection = test_engine.connect()
    trans = connection.begin()
    session = TestingSessionLocal(bind=connection, join_transaction_mode="create_savepoint")

    yield session

    session.close()
    trans.rollback()
    connection.close()


@pytest.fixture
def client(db: Session) -> TestClient:
    """Test client with database session overridden to the test transaction."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_current_db] = override_get_db
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
