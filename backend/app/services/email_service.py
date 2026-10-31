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
    sender_name = settings.EMAILS_FROM_NAME
    sender_email = settings.EMAILS_FROM_EMAIL
    smtp_host = settings.SMTP_HOST.strip() if settings.SMTP_HOST else None
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER.strip() if settings.SMTP_USER else None
    smtp_password = settings.SMTP_PASSWORD
    smtp_tls = settings.SMTP_TLS

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

    # 3. Validate sender email when SMTP delivery is enabled
    cleaned_sender = (sender_email or "").strip().lower()
    if not cleaned_sender or cleaned_sender == "billing@brightloop.local" or cleaned_sender.endswith("@brightloop.local") or cleaned_sender.endswith(".local"):
        logger.warning(
            f"SMTP delivery is enabled (host={smtp_host}), but EMAILS_FROM_EMAIL is set to default or invalid '{sender_email}'. Real delivery blocked."
        )
        log_audit_event(
            db=db,
            action="INVOICE_EMAIL_FAILED",
            entity_name="Invoice",
            entity_id=invoice.id,
            actor_user_id=actor_user.id if actor_user else None,
            ip_address=ip_address,
            details={
                "recipient": to_email,
                "reason": f"A valid sender email (EMAILS_FROM_EMAIL) must be configured when SMTP is enabled. Current value: {sender_email}",
            },
        )
        db.commit()
        return {
            "sent": False,
            "message": "A verified sender email address (EMAILS_FROM_EMAIL) is required for SMTP delivery.",
            "error": "INVALID_SENDER_EMAIL",
        }

    # 4. Construct MIME message
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

    # 5. Attempt delivery
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
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
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed for host {smtp_host}: code={getattr(e, 'smtp_code', 'unknown')}")
        log_audit_event(
            db=db,
            action="INVOICE_EMAIL_FAILED",
            entity_name="Invoice",
            entity_id=invoice.id,
            actor_user_id=actor_user.id if actor_user else None,
            ip_address=ip_address,
            details={"recipient": to_email, "error": "SMTP authentication failed. Verify credentials."},
        )
        db.commit()
        return {
            "sent": False,
            "message": "SMTP authentication failed. Please verify email credentials.",
            "error": "SMTP_AUTHENTICATION_ERROR",
        }
    except smtplib.SMTPException as e:
        logger.warning(f"SMTP delivery error for {to_email}: {e}")
        log_audit_event(
            db=db,
            action="INVOICE_EMAIL_FAILED",
            entity_name="Invoice",
            entity_id=invoice.id,
            actor_user_id=actor_user.id if actor_user else None,
            ip_address=ip_address,
            details={"recipient": to_email, "error": f"SMTP delivery error: {str(e)}"},
        )
        db.commit()
        return {
            "sent": False,
            "message": f"Could not send email due to SMTP error: {e}. Invoice PDF remains available for download.",
            "error": str(e),
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
