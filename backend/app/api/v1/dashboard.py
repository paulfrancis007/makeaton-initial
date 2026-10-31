import datetime
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_staff_or_admin
from app.db.session import get_db
from app.models.auth import User
from app.services.dashboard_service import (
    get_admin_dashboard_metrics,
    get_customer_dashboard_metrics,
    get_staff_dashboard_metrics,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboards & Analytics"])


@router.get("/admin")
def get_admin_dashboard(
    start_date: Optional[datetime.date] = Query(None),
    end_date: Optional[datetime.date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Dict[str, Any]:
    """Retrieve comprehensive platform metrics for administrator oversight."""
    return get_admin_dashboard_metrics(db=db, start_date=start_date, end_date=end_date)


@router.get("/staff")
def get_staff_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
) -> Dict[str, Any]:
    """Retrieve operational action metrics for staff members."""
    return get_staff_dashboard_metrics(db=db)


@router.get("/customer")
def get_customer_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieve strictly isolated metrics and recent history for the authenticated customer."""
    return get_customer_dashboard_metrics(db=db, current_user=current_user)
