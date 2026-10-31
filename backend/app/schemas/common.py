from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorField(BaseModel):
    path: str
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: Optional[List[ErrorField]] = None
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    total: int = Field(default=0, ge=0)


class CompanyMetaResponse(BaseModel):
    company_name: str
    company_tax_id: Optional[str] = None
    company_email: str
    company_phone: Optional[str] = None
    default_currency: str
    timezone: str
