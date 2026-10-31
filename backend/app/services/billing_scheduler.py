import argparse
import datetime
import logging
import sys
import time
from typing import Any, Dict, Optional
import zoneinfo

from app.db.session import SessionLocal
from app.models.governance import CompanySetting
from app.services.billing_service import run_recurring_billing

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("brightloop.scheduler")


def get_billing_date_in_company_timezone(db) -> datetime.date:
    """Retrieve billing date respecting company settings timezone."""
    setting = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    tz_str = setting.billing_timezone if setting and setting.billing_timezone else "Asia/Kolkata"
    try:
        tz = zoneinfo.ZoneInfo(tz_str)
        return datetime.datetime.now(tz).date()
    except Exception:
        return datetime.date.today()


def run_scheduled_billing(
    billing_date: Optional[datetime.date] = None,
    batch_size: int = 100,
    db: Optional[SessionLocal] = None,
) -> Dict[str, Any]:
    """
    Scheduled runner that invokes the authoritative billing service.
    Designed to be run by Windows Task Scheduler or cron.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True
    start_time = time.time()
    try:
        target_date = billing_date or get_billing_date_in_company_timezone(db)
        logger.info(f"Starting recurring billing run for date: {target_date} (batch size: {batch_size})")

        result = run_recurring_billing(
            db=db,
            billing_date=target_date,
            batch_size=batch_size,
            actor_user=None,
            ip_address="127.0.0.1 (Scheduler)",
        )

        elapsed = time.time() - start_time
        logger.info(
            f"Billing run completed in {elapsed:.2f}s | "
            f"Evaluated: {result['subscriptions_evaluated']} | "
            f"Created: {result['invoices_created']} | "
            f"Skipped: {result['invoices_skipped']} | "
            f"Failures: {result['failures']}"
        )

        if result["errors"]:
            for err in result["errors"]:
                logger.warning(f"Subscription {err['subscription_number']} error: {err['error']}")

        result["elapsed_seconds"] = round(elapsed, 3)
        return result
    finally:
        if own_session:
            db.close()


def main():
    parser = argparse.ArgumentParser(description="Brightloop Scheduled Billing Runner")
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Target billing date in YYYY-MM-DD format (defaults to current date in configured timezone)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Maximum subscriptions to process in this run",
    )
    args = parser.parse_args()

    target_date = None
    if args.date:
        try:
            target_date = datetime.date.fromisoformat(args.date)
        except ValueError:
            logger.error(f"Invalid date format '{args.date}'. Expected YYYY-MM-DD.")
            sys.exit(1)

    try:
        result = run_scheduled_billing(billing_date=target_date, batch_size=args.batch_size)
        sys.exit(0)
    except Exception as e:
        logger.critical(f"Fatal scheduler error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
