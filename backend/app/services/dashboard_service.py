import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.billing import Invoice, Payment
from app.models.customer import Customer, CustomerUser
from app.models.quotation import Quotation
from app.models.subscription import Subscription


def get_admin_dashboard_metrics(
    db: Session,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """Calculate aggregate business metrics for the ADMIN dashboard using fast SQL aggregates."""
    today = datetime.date.today()
    default_start = start_date or (today - datetime.timedelta(days=30))
    default_end = end_date or today

    # Counts
    total_customers = db.query(func.count(Customer.id)).scalar() or 0
    active_customers = (
        db.query(func.count(Customer.id))
        .filter(Customer.is_active == True)
        .scalar()
        or 0
    )
    active_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "ACTIVE")
        .scalar()
        or 0
    )
    total_subscriptions = db.query(func.count(Subscription.id)).scalar() or 0

    subscriptions_due = (
        db.query(func.count(Subscription.id))
        .filter(
            Subscription.status == "ACTIVE",
            Subscription.next_billing_date <= today,
        )
        .scalar()
        or 0
    )

    # Invoices & Revenue
    total_invoices = db.query(func.count(Invoice.id)).scalar() or 0
    total_invoiced_amount = (
        db.query(func.coalesce(func.sum(Invoice.total_amount), Decimal("0.00")))
        .filter(Invoice.status != "CANCELLED")
        .scalar()
        or Decimal("0.00")
    )

    total_outstanding_balance = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .filter(Invoice.status != "CANCELLED")
        .scalar()
        or Decimal("0.00")
    )

    overdue_invoices_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.due_date < today,
            Invoice.balance_due > 0,
            Invoice.status != "CANCELLED",
        )
        .scalar()
        or 0
    )

    overdue_amount = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .filter(
            Invoice.due_date < today,
            Invoice.balance_due > 0,
            Invoice.status != "CANCELLED",
        )
        .scalar()
        or Decimal("0.00")
    )

    # Payments received in range
    start_dt = datetime.datetime.combine(default_start, datetime.time.min, tzinfo=datetime.timezone.utc)
    end_dt = datetime.datetime.combine(default_end, datetime.time.max, tzinfo=datetime.timezone.utc)

    payments_in_range = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(
            Payment.status == "SUCCESS",
            Payment.payment_date >= start_dt,
            Payment.payment_date <= end_dt,
        )
        .scalar()
        or Decimal("0.00")
    )

    total_payments_collected = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(Payment.status == "SUCCESS")
        .scalar()
        or Decimal("0.00")
    )

    # Recent operations
    recent_invoices = (
        db.query(Invoice)
        .order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
        .limit(5)
        .all()
    )
    recent_payments = (
        db.query(Payment)
        .filter(Payment.status == "SUCCESS")
        .order_by(Payment.payment_date.desc())
        .limit(5)
        .all()
    )

    metrics_data = {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "total_subscriptions": total_subscriptions,
        "active_subscriptions": active_subscriptions,
        "subscriptions_due_for_billing": subscriptions_due,
        "total_invoices": total_invoices,
        "invoices_count": total_invoices,
        "total_invoiced": float(total_invoiced_amount),
        "total_invoiced_amount": float(total_invoiced_amount),
        "total_collected": float(total_payments_collected),
        "total_payments_collected": float(total_payments_collected),
        "total_outstanding": float(total_outstanding_balance),
        "outstanding_balance": float(total_outstanding_balance),
        "overdue_invoices_count": overdue_invoices_count,
        "overdue_amount": float(overdue_amount),
        "payments_in_selected_range": float(payments_in_range),
    }

    return {
        "period": {"start_date": default_start.isoformat(), "end_date": default_end.isoformat()},
        "overview": metrics_data,
        "metrics": metrics_data,
        "recent_invoices": [
            {
                "id": str(i.id),
                "invoice_number": i.invoice_number,
                "customer_name": i.customer.company_name if i.customer else None,
                "total_amount": float(i.total_amount),
                "balance_due": float(i.balance_due),
                "status": i.status,
                "issue_date": str(i.issue_date),
                "due_date": str(i.due_date),
            }
            for i in recent_invoices
        ],
        "recent_payments": [
            {
                "id": str(p.id),
                "payment_number": p.payment_number,
                "invoice_number": p.invoice.invoice_number if p.invoice else None,
                "amount": float(p.amount),
                "payment_method": p.payment_method,
                "status": p.status,
                "payment_date": str(p.payment_date),
            }
            for p in recent_payments
        ],
    }


def get_staff_dashboard_metrics(db: Session) -> Dict[str, Any]:
    """Calculate operational metrics for the STAFF role."""
    today = datetime.date.today()

    pending_quotations = (
        db.query(func.count(Quotation.id))
        .filter(Quotation.status.in_(("DRAFT", "SENT")))
        .scalar()
        or 0
    )

    active_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "ACTIVE")
        .scalar()
        or 0
    )

    due_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(
            Subscription.status == "ACTIVE",
            Subscription.next_billing_date <= today,
        )
        .scalar()
        or 0
    )

    unpaid_invoices_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.status.in_(("CONFIRMED", "PARTIALLY_PAID")),
            Invoice.balance_due > 0,
        )
        .scalar()
        or 0
    )

    overdue_invoices_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.due_date < today,
            Invoice.balance_due > 0,
            Invoice.status != "CANCELLED",
        )
        .scalar()
        or 0
    )

    recent_quotes = (
        db.query(Quotation)
        .order_by(Quotation.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "pending_quotations_count": pending_quotations,
        "active_subscriptions_count": active_subscriptions,
        "due_subscriptions_count": due_subscriptions,
        "unpaid_invoices_count": unpaid_invoices_count,
        "overdue_invoices_count": overdue_invoices_count,
        "recent_quotations": [
            {
                "id": str(q.id),
                "quotation_number": q.quotation_number,
                "customer_name": q.customer.company_name if q.customer else None,
                "total_amount": float(q.total_amount),
                "status": q.status,
                "expiry_date": str(q.expiry_date),
            }
            for q in recent_quotes
        ],
    }


def get_customer_dashboard_metrics(db: Session, current_user: User) -> Dict[str, Any]:
    """Calculate strictly isolated metrics for the CUSTOMER role."""
    user_customer_ids = [
        cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
    ]
    if not user_customer_ids:
        return {
            "customer_ids": [],
            "customer": {"id": "", "company_name": "Account"},
            "metrics": {
                "active_subscriptions": 0,
                "total_subscriptions": 0,
                "outstanding_balance": 0.0,
                "total_paid": 0.0,
                "unpaid_invoices_count": 0,
            },
            "active_subscriptions_count": 0,
            "total_outstanding_balance": "0.00",
            "active_subscriptions": [],
            "subscriptions": [],
            "recent_invoices": [],
            "recent_payments": [],
        }

    # Fetch primary customer company details
    primary_customer = db.query(Customer).filter(Customer.id.in_(user_customer_ids)).first()
    company_name = primary_customer.company_name if primary_customer else "Customer Account"

    today = datetime.date.today()

    all_subscriptions = (
        db.query(Subscription)
        .filter(Subscription.customer_id.in_(user_customer_ids))
        .all()
    )
    active_subscriptions = [s for s in all_subscriptions if s.status == "ACTIVE"]

    outstanding_balance = (
        db.query(func.coalesce(func.sum(Invoice.balance_due), Decimal("0.00")))
        .filter(
            Invoice.customer_id.in_(user_customer_ids),
            Invoice.status.in_(("CONFIRMED", "PARTIALLY_PAID")),
        )
        .scalar()
        or Decimal("0.00")
    )

    unpaid_invoices_count = (
        db.query(func.count(Invoice.id))
        .filter(
            Invoice.customer_id.in_(user_customer_ids),
            Invoice.status.in_(("CONFIRMED", "PARTIALLY_PAID")),
            Invoice.balance_due > 0,
        )
        .scalar()
        or 0
    )

    total_paid = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(
            Payment.customer_id.in_(user_customer_ids),
            Payment.status == "SUCCESS",
        )
        .scalar()
        or Decimal("0.00")
    )

    recent_invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id.in_(user_customer_ids))
        .order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
        .limit(5)
        .all()
    )

    recent_payments = (
        db.query(Payment)
        .filter(
            Payment.customer_id.in_(user_customer_ids),
            Payment.status == "SUCCESS",
        )
        .order_by(Payment.payment_date.desc())
        .limit(5)
        .all()
    )

    subscriptions_list = [
        {
            "id": str(s.id),
            "subscription_number": s.subscription_number,
            "plan_name": s.plan_name_snapshot,
            "status": s.status,
            "start_date": str(s.start_date) if s.start_date else str(s.current_period_start),
            "current_period_start": str(s.current_period_start),
            "current_period_end": str(s.current_period_end),
            "next_billing_date": str(s.next_billing_date) if s.next_billing_date else None,
            "recurring_total": str(s.recurring_total_amount),
        }
        for s in all_subscriptions
    ]

    invoices_list = [
        {
            "id": str(i.id),
            "invoice_number": i.invoice_number,
            "total_amount": float(i.total_amount),
            "balance_due": float(i.balance_due),
            "status": i.status,
            "issue_date": str(i.issue_date),
            "due_date": str(i.due_date),
        }
        for i in recent_invoices
    ]

    payments_list = [
        {
            "id": str(p.id),
            "payment_number": p.payment_number,
            "invoice_number": p.invoice.invoice_number if p.invoice else None,
            "amount": float(p.amount),
            "payment_method": p.payment_method,
            "status": p.status,
            "payment_date": str(p.payment_date),
        }
        for p in recent_payments
    ]

    return {
        "customer_ids": [str(cid) for cid in user_customer_ids],
        "customer": {
            "id": str(primary_customer.id) if primary_customer else str(user_customer_ids[0]),
            "company_name": company_name,
        },
        "metrics": {
            "active_subscriptions": len(active_subscriptions),
            "total_subscriptions": len(all_subscriptions),
            "outstanding_balance": float(outstanding_balance),
            "total_paid": float(total_paid),
            "unpaid_invoices_count": unpaid_invoices_count,
        },
        "active_subscriptions_count": len(active_subscriptions),
        "total_outstanding_balance": str(outstanding_balance),
        "active_subscriptions": [s for s in subscriptions_list if s["status"] == "ACTIVE"],
        "subscriptions": subscriptions_list,
        "recent_invoices": invoices_list,
        "recent_payments": payments_list,
    }
