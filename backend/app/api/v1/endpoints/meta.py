from fastapi import APIRouter, Depends
from app.api.deps import get_app_settings
from app.core.config import Settings
from app.schemas.common import CompanyMetaResponse

router = APIRouter()


@router.get("/meta", response_model=CompanyMetaResponse)
def get_company_meta(settings: Settings = Depends(get_app_settings)):
    return CompanyMetaResponse(
        company_name=settings.COMPANY_NAME,
        company_tax_id=settings.COMPANY_TAX_ID,
        company_email=settings.COMPANY_EMAIL,
        company_phone=settings.COMPANY_PHONE,
        default_currency=settings.DEFAULT_CURRENCY,
        timezone=settings.TIMEZONE,
    )
