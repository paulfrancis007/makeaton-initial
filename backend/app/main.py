from typing import Any
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.config import settings
from app.db.session import check_db_health
from app.api.v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
)

# CORS Middleware configured strictly for allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 API Routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str


class DatabaseHealthResponse(BaseModel):
    status: str
    database: str


class RootResponse(BaseModel):
    message: str
    docs_url: str
    health_url: str
    db_health_url: str


@app.get("/", response_model=RootResponse, tags=["General"])
def root() -> RootResponse:
    return RootResponse(
        message="Brightloop Subscription Management System API",
        docs_url=f"{settings.API_V1_PREFIX}/docs",
        health_url=f"{settings.API_V1_PREFIX}/health",
        db_health_url=f"{settings.API_V1_PREFIX}/health/db",
    )


@app.get(f"{settings.API_V1_PREFIX}/health", response_model=HealthResponse, tags=["Health"])
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )


@app.get(
    f"{settings.API_V1_PREFIX}/health/db",
    response_model=DatabaseHealthResponse,
    responses={
        503: {
            "model": DatabaseHealthResponse,
            "description": "Database service unavailable",
        }
    },
    tags=["Health"],
)
def database_health_check() -> Any:
    if check_db_health():
        return DatabaseHealthResponse(status="ok", database="connected")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "unavailable", "database": "disconnected"},
    )
