import uuid
from typing import Any, List, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorField(BaseModel):
    path: str
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    fields: Optional[List[ErrorField]] = None
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class AppException(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        fields: Optional[List[dict]] = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = [ErrorField(**f) for f in fields] if fields else None
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(status.HTTP_404_NOT_FOUND, code, message)


class ForbiddenException(AppException):
    def __init__(self, message: str = "Permission denied", code: str = "FORBIDDEN"):
        super().__init__(status.HTTP_403_FORBIDDEN, code, message)


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required", code: str = "UNAUTHORIZED"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, code, message)


class ConflictException(AppException):
    def __init__(self, message: str, code: str = "CONFLICT"):
        super().__init__(status.HTTP_409_CONFLICT, code, message)


class ValidationException(AppException):
    def __init__(self, message: str, fields: Optional[List[dict]] = None, code: str = "VALIDATION_ERROR"):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, code, message, fields)


class ServiceUnavailableException(AppException):
    def __init__(self, message: str = "Service unavailable", code: str = "SERVICE_UNAVAILABLE"):
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, code, message)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        content = {
            "error": {
                "code": exc.code,
                "message": exc.message,
                "fields": [f.model_dump() for f in exc.fields] if exc.fields else None,
                "request_id": request_id,
            }
        }
        return JSONResponse(status_code=exc.status_code, content=content)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        field_errors = []
        for error in exc.errors():
            loc = ".".join(str(l) for l in error.get("loc", []) if l != "body")
            field_errors.append({"path": loc or "root", "message": error.get("msg", "Invalid input")})
        
        content = {
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Input validation failed",
                "fields": field_errors,
                "request_id": request_id,
            }
        }
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=content)

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        # Never leak raw stack traces or database errors in responses
        content = {
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "fields": None,
                "request_id": request_id,
            }
        }
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=content)
