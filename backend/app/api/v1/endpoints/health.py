from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.deps import get_app_settings, get_current_db
from app.core.config import Settings
from app.core.errors import ServiceUnavailableException
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check(settings: Settings = Depends(get_app_settings)):
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        environment=settings.APP_ENV,
    )


@router.get("/ready", response_model=ReadinessResponse)
def readiness_check(
    db: Session = Depends(get_current_db),
    settings: Settings = Depends(get_app_settings),
):
    try:
        db.execute(text("SELECT 1"))
        return ReadinessResponse(
            status="ready",
            database="connected",
            environment=settings.APP_ENV,
        )
    except Exception:
        raise ServiceUnavailableException(
            message="Database connection failed",
            code="DATABASE_UNAVAILABLE",
        )
