from typing import Generator
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.config import Settings, get_settings
from app.db.session import get_db

# Common dependency injection wrappers


def get_current_db() -> Generator[Session, None, None]:
    yield from get_db()


def get_app_settings() -> Settings:
    return get_settings()
