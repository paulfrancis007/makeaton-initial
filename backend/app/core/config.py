from typing import List, Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Brightloop API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "127.0.0.1"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # JWT & Security Configuration
    JWT_SECRET_KEY: str = "brightloop-insecure-dev-secret-change-in-prod-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    BOOTSTRAP_ADMIN_TOKEN: str = "brightloop-bootstrap-admin-secret-2026"

    # Database Configuration
    POSTGRES_USER: str = "brightloop_app"
    POSTGRES_PASSWORD: str = "brightloop_dev_password"
    POSTGRES_SERVER: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "brightloop_dev"
    DATABASE_URL: str = ""

    # SMTP & Email Delivery Configuration (e.g. Brevo)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_TLS: bool = True
    EMAILS_FROM_NAME: str = "Brightloop Billing"
    EMAILS_FROM_EMAIL: str = "billing@brightloop.local"

    @model_validator(mode="after")
    def assemble_database_url(self) -> "Settings":
        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
                f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return self

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            insecure_defaults = {
                "brightloop-insecure-dev-secret-change-in-prod-2026",
                "secret",
                "changeme",
                "password",
                "",
            }
            if self.JWT_SECRET_KEY in insecure_defaults or len(self.JWT_SECRET_KEY) < 32:
                raise ValueError(
                    "In production, JWT_SECRET_KEY must be a cryptographically strong secret of at least 32 characters."
                )
            if self.BOOTSTRAP_ADMIN_TOKEN == "brightloop-bootstrap-admin-secret-2026":
                raise ValueError(
                    "In production, default BOOTSTRAP_ADMIN_TOKEN cannot be used."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
