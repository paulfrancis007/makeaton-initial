from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import smtplib
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth import User
from app.models.billing import Invoice
from app.models.governance import CompanySetting
from app.services.audit_service import log_audit_event
from app.services.pdf_service import generate_invoice_pdf

logger = logging.getLogger(__name__)


def send_invoice_email(
    db: Session,
    invoice: Invoice,
    recipient_email: Optional[str] = None,
    actor_user: Optional[User] = None,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send invoice notification email with attached PDF.
    Resilient to SMTP configuration or network failures without rolling back invoice operations.
    """
    to_email = recipient_email or (invoice.customer.contact_email if invoice.customer else None)
    if not to_email:
        return {
            "sent": False,
            "message": "No valid recipient email address found for this invoice.",
            "error": "Missing recipient email",
        }

    company = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    sender_name = getattr(settings, "EMAILS_FROM_NAME", "Brightloop Billing")
    sender_email = getattr(settings, "EMAILS_FROM_EMAIL", "billing@brightloop.local")
    smtp_host = getattr(settings, "SMTP_HOST", None)
    smtp_port = getattr(settings, "SMTP_PORT", 1025)
    smtp_user = getattr(settings, "SMTP_USER", None)
    smtp_password = getattr(settings, "SMTP_PASSWORD", None)
    smtp_tls = getattr(settings, "SMTP_TLS", False)

    # 1. Generate PDF document
    try:
        pdf_bytes = generate_invoice_pdf(invoice, company)
    except Exception as e:
        logger.error(f"Failed to generate invoice PDF for email: {e}", exc_info=True)
        return {
            "sent": False,
            "message": "Failed to generate invoice PDF attachment.",
            "error": str(e),
        }

    # 2. Check if SMTP host is configured
    if not smtp_host:
        logger.info(f"SMTP is not configured in this environment. Skipping email dispatch to {to_email}.")
        log_audit_event(
            db=db,
            action="INVOICE_EMAIL_SKIPPED",
            entity_name="Invoice",
            entity_id=invoice.id,
            actor_user_id=actor_user.id if actor_user else None,
            ip_address=ip_address,
            details={
                "recipient": to_email,
                "reason": "SMTP host not configured. PDF available for direct download.",
            },
        )
        db.commit()
        return {
            "sent": False,
            "message": "Email delivery is not configured in this environment. Invoice PDF is available for direct download.",
            "error": "SMTP_NOT_CONFIGURED",
        }

    # 3. Construct MIME message
    msg = MIMEMultipart()
    msg["From"] = f"{sender_name} <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = f"Tax Invoice {invoice.invoice_number} from {company.company_name if company else 'Brightloop'}"

    body = f"""Dear {invoice.customer.company_name if invoice.customer else 'Customer'},

Please find attached your Tax Invoice {invoice.invoice_number} for the billing period {invoice.billing_period_start} to {invoice.billing_period_end}.

Invoice Summary:
- Total Amount: {invoice.currency} {invoice.total_amount:.2f}
- Amount Paid: {invoice.currency} {invoice.amount_paid:.2f}
- Balance Due: {invoice.currency} {invoice.balance_due:.2f}
- Due Date: {invoice.due_date}

Thank you for your business.

Warm regards,
{company.company_name if company else 'Brightloop Technologies'}
"""
    msg.attach(MIMEText(body, "plain"))

    part = MIMEBase("application", "pdf")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f"attachment; filename=Invoice-{invoice.invoice_number}.pdf")
    msg.attach(part)

    # 4. Attempt delivery
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=5) as server:
            if smtp_tls:
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)

        logger.info(f"Successfully sent invoice email {invoice.invoice_number} to {to_email}")
        log_audit_event(
            db=db,
            action="INVOICE_EMAIL_SENT",
            entity_name="Invoice",
            entity_id=invoice.id,
            actor_user_id=actor_user.id if actor_user else None,
            ip_address=ip_address,
            details={"recipient": to_email, "invoice_number": invoice.invoice_number},
        )
        db.commit()
        return {
            "sent": True,
            "message": f"Invoice email sent successfully to {to_email}.",
            "recipient": to_email,
        }
    except Exception as e:
        logger.warning(f"Failed to deliver invoice email to {to_email}: {e}")
        log_audit_event(
            db=db,
            action="INVOICE_EMAIL_FAILED",
            entity_name="Invoice",
            entity_id=invoice.id,
            actor_user_id=actor_user.id if actor_user else None,
            ip_address=ip_address,
            details={"recipient": to_email, "error": str(e)},
        )
        db.commit()
        return {
            "sent": False,
            "message": f"Could not send email: {e}. Invoice PDF remains available for download.",
            "error": str(e),
        }
