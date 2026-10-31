from typing import Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app: str
    environment: str


class ReadinessResponse(BaseModel):
    status: str
    database: str
    environment: str
