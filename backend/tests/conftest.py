import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, sessionmaker
from alembic.config import Config
from alembic import command

from app.api.deps import get_current_db
from app.core.config import get_settings
from app.db.session import get_db
from app.main import app

settings = get_settings()

# Guard 1: Require an explicitly configured TEST_DATABASE_URL
if not settings.TEST_DATABASE_URL:
    pytest.exit(
        "TEST_DATABASE_URL must be explicitly configured in backend/.env for test execution. "
        "Falling back to DATABASE_URL is prohibited.",
        returncode=1,
    )

test_url = make_url(settings.TEST_DATABASE_URL)
dev_url = make_url(settings.DATABASE_URL)

# Guard 2: Disallow targeting the development database
if test_url == dev_url or (test_url.database and test_url.database == dev_url.database):
    pytest.exit(
        f"TEST_DATABASE_URL ({test_url.database}) cannot match or target the development database ({dev_url.database}). "
        "An explicitly separate disposable test database is required.",
        returncode=1,
    )

test_engine = create_engine(settings.TEST_DATABASE_URL, pool_pre_ping=True)

# Guard 3: Verify the actual connected PostgreSQL database identity
with test_engine.connect() as probe_conn:
    current_db = probe_conn.execute(text("SELECT current_database()")).scalar()
    if current_db == dev_url.database:
        pytest.exit(
            f"Active connection targets development database '{current_db}'! Test execution aborted.",
            returncode=1,
        )

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Verify and apply the schema on the test database strictly through Alembic migrations."""
    ini_path = "backend/alembic.ini" if os.path.exists("backend/alembic.ini") else "alembic.ini"
    cfg = Config(ini_path)
    cfg.set_main_option("sqlalchemy.url", settings.TEST_DATABASE_URL)

    # Run Alembic upgrade head to guarantee all tables, constraints and sequences exist via migrations
    command.upgrade(cfg, "head")
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
