"""
Brightloop Demo Data Seeding Script (Idempotent)
Populates database with realistic enterprise data across all three roles:
- Administrator (admin@example.com)
- Operations Staff (staff1@example.com, staff2@example.com)
- Customer Self-Service Accounts (customer.acme@example.com, customer.global@example.com)
Including Products, Plans, Taxes, Discounts, Subscriptions, Invoices, Payments, and Audit Trail.
"""

import datetime
from decimal import Decimal
import logging
import os
import sys
import uuid
from typing import Optional

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.auth import User
from app.models.billing import Invoice, InvoiceLine, Payment
from app.models.catalog import Plan, Product, TaxRule
from app.models.customer import Customer, CustomerUser
from app.models.discount import DiscountRule
from app.models.governance import CompanySetting
from app.models.subscription import Subscription, SubscriptionLine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("brightloop.seed")


def seed():
    db = SessionLocal()
    try:
        current_db = db.execute(text("SELECT current_database();")).scalar()
        logger.info(f"Connected to target database: {current_db}")

        today = datetime.date.today()

        # -------------------------------------------------------------
        # 1. Company Setting (Singleton id=1)
        # -------------------------------------------------------------
        company_setting = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
        if not company_setting:
            company_setting = CompanySetting(
                id=1,
                company_name="Brightloop Technologies Inc.",
                tax_registration_number="US-EIN-987654321",
                currency="USD",
                default_payment_terms_days=30,
                billing_timezone="Asia/Kolkata",
                contact_email="support@example.com",
                contact_phone="+1 800-555-LOOP",
                address="100 Innovation Blvd, Suite 500, San Francisco, CA 94105",
            )
            db.add(company_setting)
            db.commit()
            logger.info("Created CompanySetting (id=1)")
        else:
            logger.info("CompanySetting already present.")

        # -------------------------------------------------------------
        # 2. Users (Admin, Staff, Customers)
        # -------------------------------------------------------------
        users_def = [
            ("admin@example.com", "Brightloop Administrator", "ADMIN", "AdminPass123!"),
            ("staff1@example.com", "Sarah Jenkins (Billing Operations)", "STAFF", "StaffPass123!"),
            ("staff2@example.com", "Marcus Vance (Account Manager)", "STAFF", "StaffPass123!"),
            ("customer.acme@example.com", "Alex Rivera (Acme VP)", "CUSTOMER", "CustomerPass123!"),
            ("customer.global@example.com", "David Kim (Finance Controller)", "CUSTOMER", "CustomerPass123!"),
        ]

        user_map = {}
        for email, full_name, role, pwd in users_def:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    email=email,
                    full_name=full_name,
                    role=role,
                    hashed_password=hash_password(pwd),
                    is_active=True,
                )
                db.add(u)
                db.commit()
                db.refresh(u)
                logger.info(f"Created user: {email} ({role})")
            else:
                logger.info(f"User already present: {email}")
            user_map[email] = u

        admin_user = user_map["admin@example.com"]
        staff_user = user_map["staff1@example.com"]
        cust_user_1 = user_map["customer.acme@example.com"]
        cust_user_2 = user_map["customer.global@example.com"]

        # -------------------------------------------------------------
        # 3. Customer Organizations
        # -------------------------------------------------------------
        customers_def = [
            {
                "company_name": "Acme Enterprises Ltd",
                "contact_email": "customer.acme@example.com",
                "contact_phone": "+1 555-0199",
                "billing_address_line1": "100 Enterprise Blvd, Suite 400",
                "city": "San Francisco",
                "state": "California",
                "postal_code": "94105",
                "country": "US",
                "currency": "USD",
                "owner_user": cust_user_1,
            },
            {
                "company_name": "Global Dynamics Corp",
                "contact_email": "customer.global@example.com",
                "contact_phone": "+1 555-0248",
                "billing_address_line1": "500 Innovation Way",
                "city": "Austin",
                "state": "Texas",
                "postal_code": "78701",
                "country": "US",
                "currency": "USD",
                "owner_user": cust_user_2,
            },
        ]

        customer_map = {}
        for c_def in customers_def:
            c = db.query(Customer).filter(Customer.contact_email == c_def["contact_email"]).first()
            if not c:
                c = Customer(
                    company_name=c_def["company_name"],
                    contact_email=c_def["contact_email"],
                    contact_phone=c_def["contact_phone"],
                    billing_address_line1=c_def["billing_address_line1"],
                    city=c_def["city"],
                    state=c_def["state"],
                    postal_code=c_def["postal_code"],
                    country=c_def["country"],
                    currency=c_def["currency"],
                    is_active=True,
                )
                db.add(c)
                db.commit()
                db.refresh(c)
                # Link owner
                cu = CustomerUser(
                    customer_id=c.id,
                    user_id=c_def["owner_user"].id,
                    membership_role="OWNER",
                    is_primary=True,
                    status="ACTIVE",
                )
                db.add(cu)
                db.commit()
                logger.info(f"Created customer: {c.company_name} with owner {c_def['owner_user'].email}")
            else:
                logger.info(f"Customer already present: {c.company_name}")
            customer_map[c_def["contact_email"]] = c

        customer_acme = customer_map["customer.acme@example.com"]
        customer_global = customer_map["customer.global@example.com"]

        # -------------------------------------------------------------
        # 4. Products & Subscription Plans
        # -------------------------------------------------------------
        prod1 = db.query(Product).filter(Product.name == "Brightloop Cloud Platform").first()
        if not prod1:
            prod1 = Product(
                name="Brightloop Cloud Platform",
                product_type="SERVICE",
                description="Core cloud subscription management platform with REST API",
                base_sales_price=Decimal("49.0000"),
                cost_price=Decimal("10.0000"),
                is_active=True,
            )
            db.add(prod1)
            db.commit()
            db.refresh(prod1)
            logger.info("Created Product: Brightloop Cloud Platform")

        prod2 = db.query(Product).filter(Product.name == "Enterprise Dedicated Infrastructure").first()
        if not prod2:
            prod2 = Product(
                name="Enterprise Dedicated Infrastructure",
                product_type="SERVICE",
                description="Isolated high-availability VPC instance with premium SLA",
                base_sales_price=Decimal("1200.0000"),
                cost_price=Decimal("300.0000"),
                is_active=True,
            )
            db.add(prod2)
            db.commit()
            db.refresh(prod2)
            logger.info("Created Product: Enterprise Dedicated Infrastructure")

        plans_def = [
            ("Cloud SaaS Starter", "MONTHLY", 1, Decimal("49.00")),
            ("Cloud SaaS Professional", "MONTHLY", 1, Decimal("149.00")),
            ("Cloud SaaS Pro Annual", "YEARLY", 1, Decimal("1490.00")),
            ("Dedicated Enterprise Tier", "MONTHLY", 3, Decimal("1200.00")),
        ]

        plan_map = {}
        for p_name, p_interval, p_count, p_price in plans_def:
            p = db.query(Plan).filter(Plan.name == p_name).first()
            if not p:
                p = Plan(
                    name=p_name,
                    billing_interval=p_interval,
                    interval_count=p_count,
                    base_price=p_price,
                    minimum_quantity=1,
                    auto_renew=True,
                    allow_pause=True,
                    allow_early_closure=True,
                    is_active=True,
                )
                db.add(p)
                db.commit()
                db.refresh(p)
                logger.info(f"Created Plan: {p_name} (${p_price})")
            else:
                logger.info(f"Plan already present: {p_name}")
            plan_map[p_name] = p

        plan_pro = plan_map["Cloud SaaS Professional"]
        plan_ent = plan_map["Dedicated Enterprise Tier"]

        # -------------------------------------------------------------
        # 5. Tax Rules
        # -------------------------------------------------------------
        tax1 = db.query(TaxRule).filter(TaxRule.name == "Standard Sales Tax (8.25%)").first()
        if not tax1:
            tax1 = TaxRule(
                name="Standard Sales Tax (8.25%)",
                rate=Decimal("0.0825"),
                jurisdiction_country="US",
                jurisdiction_state="CA",
                tax_type="PERCENTAGE",
                is_active=True,
            )
            db.add(tax1)
            db.commit()
            db.refresh(tax1)
            logger.info("Created TaxRule: 8.25%")

        tax2 = db.query(TaxRule).filter(TaxRule.name == "Value Added Tax (5%)").first()
        if not tax2:
            tax2 = TaxRule(
                name="Value Added Tax (5%)",
                rate=Decimal("0.0500"),
                jurisdiction_country="US",
                jurisdiction_state="NY",
                tax_type="PERCENTAGE",
                is_active=True,
            )
            db.add(tax2)
            db.commit()
            db.refresh(tax2)
            logger.info("Created TaxRule: 5%")

        # -------------------------------------------------------------
        # 6. Discount Rules
        # -------------------------------------------------------------
        disc1 = db.query(DiscountRule).filter(DiscountRule.code == "WELCOME15").first()
        if not disc1:
            disc1 = DiscountRule(
                code="WELCOME15",
                name="Welcome 15% Promotional Discount",
                discount_type="PERCENTAGE",
                discount_value=Decimal("15.0000"),
                scope="ORDER",
                application_frequency="FIRST_INVOICE_ONLY",
                is_active=True,
            )
            db.add(disc1)
            db.commit()
            db.refresh(disc1)
            logger.info("Created DiscountRule: WELCOME15")

        disc2 = db.query(DiscountRule).filter(DiscountRule.code == "SAVE50").first()
        if not disc2:
            disc2 = DiscountRule(
                code="SAVE50",
                name="Flat $50 Account Credit",
                discount_type="FIXED_AMOUNT",
                discount_value=Decimal("50.0000"),
                scope="ORDER",
                application_frequency="FIRST_INVOICE_ONLY",
                is_active=True,
            )
            db.add(disc2)
            db.commit()
            db.refresh(disc2)
            logger.info("Created DiscountRule: SAVE50")

        # -------------------------------------------------------------
        # 7. Subscriptions
        # -------------------------------------------------------------
        sub1 = db.query(Subscription).filter(Subscription.customer_id == customer_acme.id).first()
        if not sub1:
            sub1_start = today - datetime.timedelta(days=60)
            sub1_period_start = today - datetime.timedelta(days=30)
            sub1_period_end = today
            sub1 = Subscription(
                subscription_number="SUB-ACME-PRO-001",
                customer_id=customer_acme.id,
                plan_id=plan_pro.id,
                status="ACTIVE",
                start_date=sub1_start,
                current_period_start=sub1_period_start,
                current_period_end=sub1_period_end,
                next_billing_date=today,
                billing_anchor_day=sub1_start.day,
                billing_interval_snapshot="MONTHLY",
                interval_count_snapshot=1,
                allow_pause_snapshot=True,
                allow_early_closure_snapshot=True,
                auto_renew_snapshot=True,
                auto_close_snapshot=False,
                plan_name_snapshot=plan_pro.name,
                plan_price_snapshot=plan_pro.base_price,
                recurring_subtotal=Decimal("149.00"),
                recurring_discount=Decimal("0.00"),
                recurring_tax=Decimal("0.00"),
                recurring_total_amount=Decimal("149.00"),
                currency="USD",
                payment_terms_days=30,
                created_by_user_id=staff_user.id,
            )
            db.add(sub1)
            db.commit()
            db.refresh(sub1)

            sline1 = SubscriptionLine(
                subscription_id=sub1.id,
                line_type="PLAN_FEE",
                product_id=None,
                variant_id=None,
                description_snapshot=f"{plan_pro.name} Monthly Subscription",
                unit_price_snapshot=Decimal("149.0000"),
                quantity=1,
                tax_rate_snapshot=Decimal("0.0000"),
                line_total=Decimal("149.0000"),
            )
            db.add(sline1)
            db.commit()
            logger.info(f"Created active subscription for Acme: {sub1.subscription_number}")
        else:
            logger.info(f"Subscription for Acme already present: {sub1.subscription_number}")

        sub2 = db.query(Subscription).filter(Subscription.customer_id == customer_global.id).first()
        if not sub2:
            sub2_start = today - datetime.timedelta(days=45)
            sub2 = Subscription(
                subscription_number="SUB-GLOB-ENT-001",
                customer_id=customer_global.id,
                plan_id=plan_ent.id,
                status="ACTIVE",
                start_date=sub2_start,
                current_period_start=sub2_start,
                current_period_end=sub2_start + datetime.timedelta(days=90),
                next_billing_date=sub2_start + datetime.timedelta(days=90),
                billing_anchor_day=sub2_start.day,
                billing_interval_snapshot="MONTHLY",
                interval_count_snapshot=3,
                allow_pause_snapshot=True,
                allow_early_closure_snapshot=True,
                auto_renew_snapshot=True,
                auto_close_snapshot=False,
                plan_name_snapshot=plan_ent.name,
                plan_price_snapshot=plan_ent.base_price,
                recurring_subtotal=Decimal("1200.00"),
                recurring_discount=Decimal("0.00"),
                recurring_tax=Decimal("0.00"),
                recurring_total_amount=Decimal("1200.00"),
                currency="USD",
                payment_terms_days=15,
                created_by_user_id=staff_user.id,
            )
            db.add(sub2)
            db.commit()
            db.refresh(sub2)

            sline2 = SubscriptionLine(
                subscription_id=sub2.id,
                line_type="PLAN_FEE",
                product_id=None,
                variant_id=None,
                description_snapshot=f"{plan_ent.name} Quarterly Infrastructure",
                unit_price_snapshot=Decimal("1200.0000"),
                quantity=1,
                tax_rate_snapshot=Decimal("0.0000"),
                line_total=Decimal("1200.0000"),
            )
            db.add(sline2)
            db.commit()
            logger.info(f"Created active subscription for Global Dynamics: {sub2.subscription_number}")
        else:
            logger.info(f"Subscription for Global Dynamics already present: {sub2.subscription_number}")

        # -------------------------------------------------------------
        # 8. Invoices and Payments Demo Lifecycle
        # -------------------------------------------------------------
        acme_invoices = db.query(Invoice).filter(Invoice.customer_id == customer_acme.id).all()
        if not acme_invoices:
            # Invoice 1: Past Period -> PAID
            inv1_number = f"INV-{today.strftime('%Y%m')}-ACME-PAID"
            inv1 = Invoice(
                invoice_number=inv1_number,
                subscription_id=sub1.id,
                customer_id=customer_acme.id,
                status="PAID",
                issue_date=today - datetime.timedelta(days=45),
                due_date=today - datetime.timedelta(days=15),
                billing_period_start=today - datetime.timedelta(days=60),
                billing_period_end=today - datetime.timedelta(days=30),
                subtotal_amount=Decimal("149.00"),
                discount_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                rounding_adjustment=Decimal("0.00"),
                total_amount=Decimal("149.00"),
                amount_paid=Decimal("149.00"),
                balance_due=Decimal("0.00"),
                currency="USD",
            )
            db.add(inv1)
            db.commit()
            db.refresh(inv1)

            iline1 = InvoiceLine(
                invoice_id=inv1.id,
                line_type="PLAN_FEE",
                product_id=None,
                variant_id=None,
                description=f"{plan_pro.name} Monthly Subscription",
                quantity=1,
                unit_price=Decimal("149.0000"),
                tax_rate=Decimal("0.0000"),
                tax_amount=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                line_total=Decimal("149.00"),
            )
            db.add(iline1)
            db.commit()

            pay1 = Payment(
                payment_number=f"PAY-{today.strftime('%Y%m')}-ACME-001",
                invoice_id=inv1.id,
                customer_id=customer_acme.id,
                amount=Decimal("149.00"),
                payment_method="CARD",
                status="SUCCESS",
                payment_date=today - datetime.timedelta(days=40),
                reference_number="STRIPE-CHG-998811",
                notes="Automatic recurring charge settlement",
                recorded_by_user_id=staff_user.id,
            )
            db.add(pay1)
            db.commit()
            logger.info(f"Created Invoice 1 (PAID): {inv1.invoice_number} with payment {pay1.payment_number}")

            # Invoice 2: Current Period -> PARTIALLY PAID ($50 of $149)
            inv2_number = f"INV-{today.strftime('%Y%m')}-ACME-PART"
            inv2 = Invoice(
                invoice_number=inv2_number,
                subscription_id=sub1.id,
                customer_id=customer_acme.id,
                status="PARTIALLY_PAID",
                issue_date=today - datetime.timedelta(days=10),
                due_date=today + datetime.timedelta(days=20),
                billing_period_start=today - datetime.timedelta(days=30),
                billing_period_end=today,
                subtotal_amount=Decimal("149.00"),
                discount_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                rounding_adjustment=Decimal("0.00"),
                total_amount=Decimal("149.00"),
                amount_paid=Decimal("50.00"),
                balance_due=Decimal("99.00"),
                currency="USD",
            )
            db.add(inv2)
            db.commit()
            db.refresh(inv2)

            iline2 = InvoiceLine(
                invoice_id=inv2.id,
                line_type="PLAN_FEE",
                product_id=None,
                variant_id=None,
                description=f"{plan_pro.name} Monthly Subscription",
                quantity=1,
                unit_price=Decimal("149.0000"),
                tax_rate=Decimal("0.0000"),
                tax_amount=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                line_total=Decimal("149.00"),
            )
            db.add(iline2)
            db.commit()

            pay2 = Payment(
                payment_number=f"PAY-{today.strftime('%Y%m')}-ACME-002",
                invoice_id=inv2.id,
                customer_id=customer_acme.id,
                amount=Decimal("50.00"),
                payment_method="BANK_TRANSFER",
                status="SUCCESS",
                payment_date=today - datetime.timedelta(days=5),
                reference_number="ACH-TXN-120094",
                notes="Partial advance wire transfer",
                recorded_by_user_id=staff_user.id,
            )
            db.add(pay2)
            db.commit()
            logger.info(f"Created Invoice 2 (PARTIALLY_PAID): {inv2.invoice_number} (Balance: $99.00)")
        else:
            logger.info("Acme invoices already seeded.")

        glob_invoices = db.query(Invoice).filter(Invoice.customer_id == customer_global.id).all()
        if not glob_invoices:
            # Invoice 3: Global Dynamics -> OVERDUE CONFIRMED ($1200.00)
            inv3_number = f"INV-{today.strftime('%Y%m')}-GLOB-OVERDUE"
            inv3 = Invoice(
                invoice_number=inv3_number,
                subscription_id=sub2.id,
                customer_id=customer_global.id,
                status="CONFIRMED",
                issue_date=today - datetime.timedelta(days=35),
                due_date=today - datetime.timedelta(days=20),  # Past due!
                billing_period_start=today - datetime.timedelta(days=45),
                billing_period_end=today + datetime.timedelta(days=45),
                subtotal_amount=Decimal("1200.00"),
                discount_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                rounding_adjustment=Decimal("0.00"),
                total_amount=Decimal("1200.00"),
                amount_paid=Decimal("0.00"),
                balance_due=Decimal("1200.00"),
                currency="USD",
            )
            db.add(inv3)
            db.commit()
            db.refresh(inv3)

            iline3 = InvoiceLine(
                invoice_id=inv3.id,
                line_type="PLAN_FEE",
                product_id=None,
                variant_id=None,
                description=f"{plan_ent.name} Quarterly Infrastructure",
                quantity=1,
                unit_price=Decimal("1200.0000"),
                tax_rate=Decimal("0.0000"),
                tax_amount=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                line_total=Decimal("1200.00"),
            )
            db.add(iline3)
            db.commit()
            logger.info(f"Created Invoice 3 (OVERDUE): {inv3.invoice_number} (Balance: $1200.00)")
        else:
            logger.info("Global Dynamics invoices already seeded.")

        # Voided payment demonstration record
        void_pay = db.query(Payment).filter(Payment.status == "VOIDED").first()
        if not void_pay:
            inv1 = db.query(Invoice).filter(Invoice.status == "PAID").first()
            if inv1:
                vpay = Payment(
                    payment_number=f"PAY-{today.strftime('%Y%m')}-VOID-SAMPLE",
                    invoice_id=inv1.id,
                    customer_id=inv1.customer_id,
                    amount=Decimal("149.00"),
                    payment_method="CHEQUE",
                    status="VOIDED",
                    payment_date=today - datetime.timedelta(days=30),
                    reference_number="CHK-00129",
                    notes="Cheque bounced by issuer",
                    voided_at=datetime.datetime.now(datetime.timezone.utc),
                    voided_by_user_id=admin_user.id,
                    void_reason="Cheque returned unpaid by drawee bank",
                    recorded_by_user_id=staff_user.id,
                )
                db.add(vpay)
                db.commit()
                logger.info(f"Created Voided Payment Record: {vpay.payment_number}")

        logger.info("Demo data seeding completed successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
