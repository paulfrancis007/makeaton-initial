from functools import lru_cache
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core environment
    APP_ENV: str = "development"
    APP_NAME: str = "Brightloop"
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    TIMEZONE: str = "Asia/Kolkata"
    DEFAULT_CURRENCY: str = "INR"

    # Databases
    DATABASE_URL: str
    TEST_DATABASE_URL: Optional[str] = None

    # Security
    SESSION_SECRET_KEY: str = "insecure-dev-session-secret-change-in-production"
    SESSION_MAX_AGE_SECONDS: int = 43200  # 12 hours

    # Company / Invoice Issuer Settings
    COMPANY_NAME: str = "Brightloop Technologies Private Limited"
    COMPANY_TAX_ID: str = "GSTIN29ABCDE1234F1Z5"
    COMPANY_EMAIL: str = "billing@brightloop.test"
    COMPANY_PHONE: str = "+91 80 1234 5678"
    COMPANY_ADDRESS_LINE1: str = "100 Innovation Boulevard"
    COMPANY_ADDRESS_LINE2: Optional[str] = "Suite 400"
    COMPANY_CITY: str = "Bengaluru"
    COMPANY_STATE: str = "Karnataka"
    COMPANY_POSTAL_CODE: str = "560100"
    COMPANY_COUNTRY: str = "India"

    # SMTP Configuration (Mailpit loopback default)
    SMTP_HOST: str = "127.0.0.1"
    SMTP_PORT: int = 1025
    SMTP_USERNAME: Optional[str] = ""
    SMTP_PASSWORD: Optional[str] = ""
    SMTP_STARTTLS: bool = False
    SMTP_SSL: bool = False
    EMAIL_FROM: str = "Brightloop <noreply@brightloop.test>"

    @property
    def issuer_address_dict(self) -> dict:
        return {
            "name": self.COMPANY_NAME,
            "tax_id": self.COMPANY_TAX_ID,
            "email": self.COMPANY_EMAIL,
            "phone": self.COMPANY_PHONE,
            "address_line1": self.COMPANY_ADDRESS_LINE1,
            "address_line2": self.COMPANY_ADDRESS_LINE2,
            "city": self.COMPANY_CITY,
            "state": self.COMPANY_STATE,
            "postal_code": self.COMPANY_POSTAL_CODE,
            "country": self.COMPANY_COUNTRY,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
