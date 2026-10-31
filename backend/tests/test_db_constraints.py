import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Customer,
    Plan,
    Product,
    ProductVariant,
    Subscription,
    SubscriptionTerm,
    AgreementVersion,
    AgreementLine,
    SubscriptionEvent,
    SubscriptionPause,
    Invoice,
    Payment,
    TaxRule,
    User,
)


def test_user_email_unique_and_role_check(db: Session):
    # Valid user creation
    u1 = User(
        email_normalized="alice@example.com",
        name="Alice",
        password_hash="hashed_pw_1",
        role="ADMIN",
    )
    db.add(u1)
    db.commit()

    # Duplicate email must fail
    u2 = User(
        email_normalized="alice@example.com",
        name="Alice Duplicate",
        password_hash="hashed_pw_2",
        role="STAFF",
    )
    db.add(u2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Invalid role must fail check constraint
    u3 = User(
        email_normalized="bob@example.com",
        name="Bob",
        password_hash="hashed_pw_3",
        role="SUPERADMIN",
    )
    db.add(u3)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_product_price_non_negative_check(db: Session):
    # Negative sales price must fail
    p = Product(
        name="Negative Product",
        type="SERVICE",
        sales_price=Decimal("-10.00"),
        cost_price=Decimal("5.00"),
    )
    db.add(p)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_tax_rule_rate_bounds_check(db: Session):
    # Rate > 100 must fail
    t_over = TaxRule(
        name="Over 100 Tax",
        classification="GST",
        rate=Decimal("105.00"),
    )
    db.add(t_over)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Negative rate must fail
    t_neg = TaxRule(
        name="Negative Tax",
        classification="GST",
        rate=Decimal("-5.00"),
    )
    db.add(t_neg)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_plan_interval_check(db: Session):
    # Invalid interval must fail
    plan = Plan(
        name="Hourly Plan",
        base_fee=Decimal("100.00"),
        minimum_seats=1,
        extra_seat_unit_price=Decimal("10.00"),
        interval="HOURLY",  # Allowed: DAILY, WEEKLY, MONTHLY, YEARLY
    )
    db.add(plan)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_invoice_period_and_total_identity_check(db: Session):
    # Set up prerequisite customer, plan, subscription, term, agreement
    cust = Customer(
        email_normalized="client@example.com",
        name="Acme Client",
    )
    plan = Plan(
        name="Monthly Standard",
        base_fee=Decimal("500.00"),
        minimum_seats=5,
        extra_seat_unit_price=Decimal("50.00"),
        interval="MONTHLY",
    )
    db.add_all([cust, plan])
    db.commit()

    sub = Subscription(
        number="SUB-TEST-001",
        customer_id=cust.id,
        plan_id=plan.id,
        state="ACTIVE",
        seat_quantity=5,
    )
    db.add(sub)
    db.commit()

    term = SubscriptionTerm(
        subscription_id=sub.id,
        sequence=1,
        start_date=date(2027, 1, 1),
        expiry_date=date(2028, 1, 1),
        original_anchor_date=date(2027, 1, 1),
        interval="MONTHLY",
    )
    agr = AgreementVersion(
        subscription_id=sub.id,
        sequence=1,
        state="ACCEPTED",
        seat_quantity=5,
    )
    db.add_all([term, agr])
    db.commit()

    # 1. Total identity failure: total != subtotal - discount + tax
    inv_bad_math = Invoice(
        number="INV-BAD-001",
        subscription_id=sub.id,
        term_id=term.id,
        agreement_id=agr.id,
        customer_id=cust.id,
        period_start=date(2027, 1, 1),
        period_end=date(2027, 2, 1),
        invoice_date=date(2027, 1, 1),
        due_date=date(2027, 1, 16),
        state="CONFIRMED",
        subtotal=Decimal("500.00"),
        discount_total=Decimal("50.00"),
        tax_total=Decimal("90.00"),
        total=Decimal("999.00"),  # Incorrect! Should be 500 - 50 + 90 = 540.00
        issuer_name="Brightloop",
        issuer_address={"city": "Bengaluru"},
        customer_name=cust.name,
        customer_email=cust.email_normalized,
        customer_address={"city": "Bengaluru"},
    )
    db.add(inv_bad_math)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 2. Correct total identity succeeds
    inv_good = Invoice(
        number="INV-GOOD-001",
        subscription_id=sub.id,
        term_id=term.id,
        agreement_id=agr.id,
        customer_id=cust.id,
        period_start=date(2027, 1, 1),
        period_end=date(2027, 2, 1),
        invoice_date=date(2027, 1, 1),
        due_date=date(2027, 1, 16),
        state="CONFIRMED",
        subtotal=Decimal("500.00"),
        discount_total=Decimal("50.00"),
        tax_total=Decimal("90.00"),
        total=Decimal("540.00"),
        issuer_name="Brightloop",
        issuer_address={"city": "Bengaluru"},
        customer_name=cust.name,
        customer_email=cust.email_normalized,
        customer_address={"city": "Bengaluru"},
    )
    db.add(inv_good)
    db.commit()

    # 3. Duplicate period_start for same subscription fails unique constraint
    inv_dup_period = Invoice(
        number="INV-DUP-PERIOD",
        subscription_id=sub.id,
        term_id=term.id,
        agreement_id=agr.id,
        customer_id=cust.id,
        period_start=date(2027, 1, 1),  # Same period_start!
        period_end=date(2027, 2, 1),
        invoice_date=date(2027, 1, 1),
        due_date=date(2027, 1, 16),
        state="CONFIRMED",
        subtotal=Decimal("500.00"),
        discount_total=Decimal("0.00"),
        tax_total=Decimal("0.00"),
        total=Decimal("500.00"),
        issuer_name="Brightloop",
        issuer_address={"city": "Bengaluru"},
        customer_name=cust.name,
        customer_email=cust.email_normalized,
        customer_address={"city": "Bengaluru"},
    )
    db.add(inv_dup_period)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_payment_constraints(db: Session):
    # Setup user, customer, plan, sub, invoice
    u = User(
        email_normalized="cashier@example.com",
        name="Staff Cashier",
        password_hash="hash",
        role="STAFF",
    )
    c = Customer(email_normalized="paying@example.com", name="Paying Customer")
    p = Plan(name="Pay Plan", base_fee=Decimal("100.00"), minimum_seats=1, extra_seat_unit_price=Decimal("0"), interval="MONTHLY")
    db.add_all([u, c, p])
    db.commit()

    sub = Subscription(number="SUB-PAY-01", customer_id=c.id, plan_id=p.id, state="ACTIVE", seat_quantity=1)
    db.add(sub)
    db.commit()

    term = SubscriptionTerm(subscription_id=sub.id, sequence=1, start_date=date(2027, 1, 1), expiry_date=date(2028, 1, 1), original_anchor_date=date(2027, 1, 1), interval="MONTHLY")
    agr = AgreementVersion(subscription_id=sub.id, sequence=1, state="ACCEPTED", seat_quantity=1)
    db.add_all([term, agr])
    db.commit()

    inv = Invoice(
        number="INV-PAY-01",
        subscription_id=sub.id,
        term_id=term.id,
        agreement_id=agr.id,
        customer_id=c.id,
        period_start=date(2027, 1, 1),
        period_end=date(2027, 2, 1),
        invoice_date=date(2027, 1, 1),
        due_date=date(2027, 1, 16),
        state="CONFIRMED",
        subtotal=Decimal("100.00"),
        total=Decimal("100.00"),
        issuer_name="Brightloop",
        issuer_address={"city": "Bengaluru"},
        customer_name=c.name,
        customer_email=c.email_normalized,
        customer_address={"city": "Bengaluru"},
    )
    db.add(inv)
    db.commit()

    # 1. Zero/negative amount rejected
    pay_bad = Payment(
        invoice_id=inv.id,
        amount=Decimal("-10.00"),
        method="CASH",
        payment_date=date(2027, 1, 5),
        note="Negative payment",
        recorded_by=u.id,
        request_key="req-neg-01",
        request_hash="hash01",
    )
    db.add(pay_bad)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 2. Empty note rejected
    pay_empty_note = Payment(
        invoice_id=inv.id,
        amount=Decimal("50.00"),
        method="CASH",
        payment_date=date(2027, 1, 5),
        note="   ",
        recorded_by=u.id,
        request_key="req-empty-note",
        request_hash="hash02",
    )
    db.add(pay_empty_note)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # 3. Valid payment succeeds
    pay_ok = Payment(
        invoice_id=inv.id,
        amount=Decimal("50.00"),
        method="BANK_TRANSFER",
        payment_date=date(2027, 1, 5),
        note="First installment",
        recorded_by=u.id,
        request_key="req-key-unique-01",
        request_hash="hash03",
    )
    db.add(pay_ok)
    db.commit()

    # 4. Duplicate request_key rejected
    pay_dup_key = Payment(
        invoice_id=inv.id,
        amount=Decimal("50.00"),
        method="BANK_TRANSFER",
        payment_date=date(2027, 1, 5),
        note="Duplicate retry",
        recorded_by=u.id,
        request_key="req-key-unique-01",  # Same request_key!
        request_hash="hash03",
    )
    db.add(pay_dup_key)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_financial_deletion_safety_restrict(db: Session):
    # Customer referenced by an invoice cannot be deleted (ON DELETE RESTRICT)
    c = Customer(email_normalized="nodelete@example.com", name="Protected Customer")
    p = Plan(name="Protect Plan", base_fee=Decimal("100.00"), minimum_seats=1, extra_seat_unit_price=Decimal("0"), interval="MONTHLY")
    db.add_all([c, p])
    db.commit()

    sub = Subscription(number="SUB-PROT-01", customer_id=c.id, plan_id=p.id, state="ACTIVE", seat_quantity=1)
    db.add(sub)
    db.commit()

    term = SubscriptionTerm(subscription_id=sub.id, sequence=1, start_date=date(2027, 1, 1), expiry_date=date(2028, 1, 1), original_anchor_date=date(2027, 1, 1), interval="MONTHLY")
    agr = AgreementVersion(subscription_id=sub.id, sequence=1, state="ACCEPTED", seat_quantity=1)
    db.add_all([term, agr])
    db.commit()

    inv = Invoice(
        number="INV-PROT-01",
        subscription_id=sub.id,
        term_id=term.id,
        agreement_id=agr.id,
        customer_id=c.id,
        period_start=date(2027, 1, 1),
        period_end=date(2027, 2, 1),
        invoice_date=date(2027, 1, 1),
        due_date=date(2027, 1, 16),
        state="CONFIRMED",
        subtotal=Decimal("100.00"),
        total=Decimal("100.00"),
        issuer_name="Brightloop",
        issuer_address={"city": "Bengaluru"},
        customer_name=c.name,
        customer_email=c.email_normalized,
        customer_address={"city": "Bengaluru"},
    )
    db.add(inv)
    db.commit()

    # Attempting to delete the customer must fail with foreign key violation
    db.delete(c)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Attempting to delete the subscription must fail with foreign key violation
    db.delete(sub)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_partial_unique_index_one_draft_version(db: Session):
    c = Customer(email_normalized="draft-test@example.com", name="Draft Tester")
    p = Plan(name="Draft Plan", base_fee=Decimal("100.00"), minimum_seats=1, extra_seat_unit_price=Decimal("0"), interval="MONTHLY")
    db.add_all([c, p])
    db.commit()

    sub = Subscription(number="SUB-DRAFT-01", customer_id=c.id, plan_id=p.id, state="DRAFT", seat_quantity=1)
    db.add(sub)
    db.commit()

    v1 = AgreementVersion(subscription_id=sub.id, sequence=1, state="DRAFT", seat_quantity=1)
    db.add(v1)
    db.commit()

    # Second DRAFT version for the same subscription must fail partial unique index
    v2_draft = AgreementVersion(subscription_id=sub.id, sequence=2, state="DRAFT", seat_quantity=1)
    db.add(v2_draft)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # But an ISSUED version for the same subscription succeeds
    v2_issued = AgreementVersion(subscription_id=sub.id, sequence=2, state="ISSUED", seat_quantity=1)
    db.add(v2_issued)
    db.commit()


def test_partial_unique_index_accepted_version_effective_dates(db: Session):
    c = Customer(email_normalized="accepted-test@example.com", name="Accepted Tester")
    p = Plan(name="Accepted Plan", base_fee=Decimal("100.00"), minimum_seats=1, extra_seat_unit_price=Decimal("0"), interval="MONTHLY")
    db.add_all([c, p])
    db.commit()

    sub = Subscription(number="SUB-ACCEPT-01", customer_id=c.id, plan_id=p.id, state="ACTIVE", seat_quantity=1)
    db.add(sub)
    db.commit()

    effective_dt = date(2027, 1, 1)
    v1 = AgreementVersion(subscription_id=sub.id, sequence=1, state="ACCEPTED", effective_from=effective_dt, seat_quantity=1)
    db.add(v1)
    db.commit()

    # Second ACCEPTED version with same effective date for same subscription must fail
    v2 = AgreementVersion(subscription_id=sub.id, sequence=2, state="ACCEPTED", effective_from=effective_dt, seat_quantity=1)
    db.add(v2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Second ACCEPTED version with different effective date succeeds
    v3 = AgreementVersion(subscription_id=sub.id, sequence=2, state="ACCEPTED", effective_from=date(2027, 7, 1), seat_quantity=1)
    db.add(v3)
    db.commit()


def test_partial_unique_index_one_open_pause_per_term(db: Session):
    c = Customer(email_normalized="pause-test@example.com", name="Pause Tester")
    p = Plan(name="Pause Plan", base_fee=Decimal("100.00"), minimum_seats=1, extra_seat_unit_price=Decimal("0"), interval="MONTHLY")
    db.add_all([c, p])
    db.commit()

    sub = Subscription(number="SUB-PAUSE-01", customer_id=c.id, plan_id=p.id, state="ACTIVE", seat_quantity=1)
    db.add(sub)
    db.commit()

    term = SubscriptionTerm(subscription_id=sub.id, sequence=1, start_date=date(2027, 1, 1), expiry_date=date(2028, 1, 1), original_anchor_date=date(2027, 1, 1), interval="MONTHLY")
    db.add(term)
    db.commit()

    ev1 = SubscriptionEvent(subscription_id=sub.id, action="PAUSE", effective_date=date(2027, 2, 1))
    ev2 = SubscriptionEvent(subscription_id=sub.id, action="PAUSE", effective_date=date(2027, 3, 1))
    db.add_all([ev1, ev2])
    db.commit()

    pause1 = SubscriptionPause(
        term_id=term.id,
        start_date=date(2027, 2, 1),
        resumed_date=None,  # Open pause
        original_expiry_date=date(2028, 1, 1),
        pause_event_id=ev1.id,
    )
    db.add(pause1)
    db.commit()

    # Second open pause for the same term must fail partial unique index
    pause2 = SubscriptionPause(
        term_id=term.id,
        start_date=date(2027, 3, 1),
        resumed_date=None,  # Open pause
        original_expiry_date=date(2028, 1, 1),
        pause_event_id=ev2.id,
    )
    db.add(pause2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_term_source_version_cross_subscription_foreign_key_prevention(db: Session):
    c = Customer(email_normalized="cross-sub@example.com", name="Cross Sub Tester")
    p = Plan(name="Cross Plan", base_fee=Decimal("100.00"), minimum_seats=1, extra_seat_unit_price=Decimal("0"), interval="MONTHLY")
    db.add_all([c, p])
    db.commit()

    sub_a = Subscription(number="SUB-CROSS-A", customer_id=c.id, plan_id=p.id, state="ACTIVE", seat_quantity=1)
    sub_b = Subscription(number="SUB-CROSS-B", customer_id=c.id, plan_id=p.id, state="ACTIVE", seat_quantity=1)
    db.add_all([sub_a, sub_b])
    db.commit()

    # Agreement belongs to sub_a
    agr_a = AgreementVersion(subscription_id=sub_a.id, sequence=1, state="ACCEPTED", seat_quantity=1)
    db.add(agr_a)
    db.commit()

    # Term belongs to sub_b, but attempts to reference agr_a belonging to sub_a
    term_bad = SubscriptionTerm(
        subscription_id=sub_b.id,
        sequence=1,
        start_date=date(2027, 1, 1),
        expiry_date=date(2028, 1, 1),
        original_anchor_date=date(2027, 1, 1),
        interval="MONTHLY",
        source_version_id=agr_a.id,  # Illegal cross-subscription reference!
    )
    db.add(term_bad)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Term belongs to sub_a and references agr_a belonging to sub_a -> succeeds!
    term_good = SubscriptionTerm(
        subscription_id=sub_a.id,
        sequence=1,
        start_date=date(2027, 1, 1),
        expiry_date=date(2028, 1, 1),
        original_anchor_date=date(2027, 1, 1),
        interval="MONTHLY",
        source_version_id=agr_a.id,
    )
    db.add(term_good)
    db.commit()
