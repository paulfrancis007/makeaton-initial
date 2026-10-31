# Brightloop Subscription Management System — Manual Testing Handbook

**Version:** 1.0.0  
**Target Environment:** Local Development / Staging (`feat/neubrutalism-ui`)  
**Architecture:** Next.js 15.5 App Router (Neo-Brutalist UI) + FastAPI + PostgreSQL 16 (with `btree_gist`) + Alembic  
**Currency & Precision Standard:** Strict `NUMERIC(12, 2)` Financial Math, Banker's Rounding (Half-Even), Pure Python PDF Generation, Brevo SMTP Support

---

## Table of Contents

1. [Master Testing Checklist](#1-master-testing-checklist)
2. [Environment Preparation & Service Run Guide](#2-environment-preparation--service-run-guide)
3. [Authentication, Login & Account Testing](#3-authentication-login--account-testing)
4. [ADMIN Module — Comprehensive Functional Testing](#4-admin-module--comprehensive-functional-testing)
   - [4.1 Executive & Operations Dashboard](#41-executive--operations-dashboard)
   - [4.2 Customer Organization Management](#42-customer-organization-management)
   - [4.3 Product Catalogue & Variant Management](#43-product-catalogue--variant-management)
   - [4.4 Subscription Plans & Mutual Exclusivity Rules](#44-subscription-plans--mutual-exclusivity-rules)
   - [4.5 Tax Configuration & PostgreSQL GiST Overlap Protection](#45-tax-configuration--postgresql-gist-overlap-protection)
   - [4.6 Discount Rules & Interactive Rule Evaluator](#46-discount-rules--interactive-rule-evaluator)
   - [4.7 Quotation Lifecycle & Snapshot Freezing](#47-quotation-lifecycle--snapshot-freezing)
   - [4.8 Subscription Lifecycle Operations](#48-subscription-lifecycle-operations)
   - [4.9 Invoice Generation & Batch Recurring Billing](#49-invoice-generation--batch-recurring-billing)
   - [4.10 Tax-Compliant PDF Document Generation](#410-tax-compliant-pdf-document-generation)
   - [4.11 Payment Recording & Strict Overpayment Rejection](#411-payment-recording--strict-overpayment-rejection)
   - [4.12 Immutable Payment Voiding & Ledger Restoration](#412-immutable-payment-voiding--ledger-restoration)
   - [4.13 Tamper-Evident System Audit Trail](#413-tamper-evident-system-audit-trail)
   - [4.14 Financial Metrics & Balance Reconciliation](#414-financial-metrics--balance-reconciliation)
5. [STAFF Module — Operational Flows & Negative RBAC Checks](#5-staff-module--operational-flows--negative-rbac-checks)
6. [CUSTOMER Module — Portal & Multi-Tenant Data Isolation](#6-customer-module--portal--multi-tenant-data-isolation)
7. [Brevo SMTP & Invoice Email Dispatch Testing](#7-brevo-smtp--invoice-email-dispatch-testing)
8. [Scheduled Recurring Billing CLI Verification](#8-scheduled-recurring-billing-cli-verification)
9. [Negative Testing, Edge Cases & Security Invariants](#9-negative-testing-edge-cases--security-invariants)
10. [Neo-Brutalist Visual & Responsive UI Verification](#10-neo-brutalist-visual--responsive-ui-verification)
11. [Master Test Results Evidence Matrix](#11-master-test-results-evidence-matrix)

---

## 1. Master Testing Checklist

Use this checklist to track end-to-end verification across all application tiers.

| Check | Test ID | Category | Module / Feature | Severity |
| :---: | :--- | :--- | :--- | :--- |
| [ ] | `ENV-01` | Environment | PostgreSQL 16 connectivity & `btree_gist` extension | Critical |
| [ ] | `ENV-02` | Environment | Alembic schema migrations (`upgrade head`) | Critical |
| [ ] | `ENV-03` | Environment | Seed demo data execution (`seed_demo_data.py`) | High |
| [ ] | `ENV-04` | Environment | FastAPI backend health endpoints (`/health`, `/health/db`) | Critical |
| [ ] | `ENV-05` | Environment | Next.js frontend load at `http://localhost:3000` | Critical |
| [ ] | `AUTH-01`| Auth & RBAC | Administrator authentication (`AdminPass123!`) | Critical |
| [ ] | `AUTH-02`| Auth & RBAC | Operations Staff authentication (`StaffPass123!`) | Critical |
| [ ] | `AUTH-03`| Auth & RBAC | Customer portal authentication (`CustomerPass123!`) | Critical |
| [ ] | `AUTH-04`| Auth & RBAC | Manual Bearer Token injection via Navbar key modal | High |
| [ ] | `AUTH-05`| Auth & RBAC | Session termination and secure logout | High |
| [ ] | `DASH-01`| Admin UI | Executive Dashboard aggregated KPI cards (6 cards) | High |
| [ ] | `DASH-02`| Admin UI | Subscriptions interval & Invoice status distributions | Medium |
| [ ] | `CAT-01` | Catalogue | Create billable product with service/software classification | High |
| [ ] | `CAT-02` | Catalogue | Add product variants with SKU and price delta | Medium |
| [ ] | `CAT-03` | Catalogue | Create subscription plan with billing interval | High |
| [ ] | `CAT-04` | Catalogue | Plan mutual exclusivity check (`auto_renew` vs `auto_close`) | Critical |
| [ ] | `TAX-01` | Tax Engine | Configure tax rule (jurisdiction, scope, percentage) | High |
| [ ] | `TAX-02` | Tax Engine | PostgreSQL GiST exclusion: block overlapping tax periods | Critical |
| [ ] | `DISC-01`| Discounts | Create percentage and fixed-amount discount rules | High |
| [ ] | `DISC-02`| Discounts | Live discount rule evaluator simulation drawer | Medium |
| [ ] | `QUOT-01`| Quotations | Create quotation with customer, plan, and custom line items | High |
| [ ] | `QUOT-02`| Quotations | Quotation lifecycle transitions (`DRAFT` → `SENT` → `CONFIRMED`)| Critical |
| [ ] | `QUOT-03`| Quotations | Convert confirmed quotation into active subscription | Critical |
| [ ] | `SUB-01` | Subscriptions | View subscription details, anchor day, and billing schedule| High |
| [ ] | `SUB-02` | Subscriptions | Pause subscription with reason modal (`ACTIVE` → `PAUSED`) | High |
| [ ] | `SUB-03` | Subscriptions | Resume paused subscription (`PAUSED` → `ACTIVE`) | High |
| [ ] | `SUB-04` | Subscriptions | Terminate subscription with reason modal (`CANCELLED`) | High |
| [ ] | `INV-01`  | Invoices | Trigger batch recurring billing run via modal | Critical |
| [ ] | `INV-02`  | Invoices | Invoice financial check constraint (`chk_invoices_total_calc`)| Critical |
| [ ] | `INV-03`  | Invoices | Native Python PDF invoice generation & download | High |
| [ ] | `PAY-01`  | Payments | Record partial payment with reference and payment method | High |
| [ ] | `PAY-02`  | Payments | Strict overpayment rejection (amount > balance due) | Critical |
| [ ] | `PAY-03`  | Payments | Full payment settlement (invoice transitions to `PAID`) | Critical |
| [ ] | `PAY-04`  | Payments | Authorize immutable payment void with audit reason | Critical |
| [ ] | `PAY-05`  | Payments | Ledger restoration: invoice balance restored after void | Critical |
| [ ] | `AUD-01`  | Governance | Tamper-evident audit trail entries for financial actions | High |
| [ ] | `AUD-02`  | Governance | Audit payload JSON diff expansion (before/after states) | Medium |
| [ ] | `RBAC-01` | Security | Staff restricted from system audit trail (`/admin/audit`) | Critical |
| [ ] | `RBAC-02` | Security | Staff restricted from initial admin bootstrap endpoint | Critical |
| [ ] | `PORT-01` | Customer | Customer self-service dashboard (`/portal/dashboard`) | High |
| [ ] | `PORT-02` | Customer | Customer invoice statement listing & PDF receipt download | High |
| [ ] | `ISO-01`  | Multi-Tenant| Cross-tenant data isolation: Customer A blocked from B | Critical |
| [ ] | `MAIL-01` | Notifications| Email dispatch fallback (`INVOICE_EMAIL_SKIPPED`) | High |
| [ ] | `MAIL-02` | Notifications| Brevo SMTP delivery with valid sender email | High |
| [ ] | `CLI-01`  | Automation | Standalone billing CLI execution (`run_billing.py`) | High |
| [ ] | `CLI-02`  | Automation | Billing CLI idempotency proof (second run produces 0 dupes)| Critical |
| [ ] | `UI-01`   | Frontend | Neo-Brutalist styling: borders, shadows, high contrast | Medium |
| [ ] | `UI-02`   | Responsive | Viewport adaptation (Desktop 1440px, Tablet 768px, Mobile 375px)| Medium |

---

## 2. Environment Preparation & Service Run Guide

### 2.1 Prerequisites
- **Operating System:** Windows 10/11, macOS, or Ubuntu 22.04+
- **Python:** Version 3.12 or 3.13
- **Node.js:** Version 18.x or 20.x+ with `npm`
- **PostgreSQL:** Version 16+ running locally on port `5432` with databases `brightloop_dev` and `brightloop_test`
- **PostgreSQL Extension:** `btree_gist` enabled in target databases

### 2.2 Verify Database Connectivity & Run Migrations
Open PowerShell in the project root directory:

```powershell
# Navigate to backend directory
cd backend

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run database schema migrations to HEAD
python -m alembic upgrade head
```

**Expected Console Output:**
```text
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
```
*(If the database is already up to date, it returns without error).*

### 2.3 Seed Rich Idempotent Demo Data
Execute the comprehensive demo seed script:

```powershell
python scripts/seed_demo_data.py
```

**Expected Console Output:**
```text
=== Brightloop Demo Data Seeding ===
[1/9] Verifying Company Settings...
  Company: Brightloop Technologies Inc. (GSTIN/Tax ID: 27AABCB1234F1Z5)
[2/9] Seeding Users...
  Admin: admin@example.com (Role: ADMIN)
  Staff: staff1@example.com (Role: STAFF)
  Staff: staff2@example.com (Role: STAFF)
  Customer User: customer.acme@example.com (Role: CUSTOMER)
  Customer User: customer.global@example.com (Role: CUSTOMER)
[3/9] Seeding Customer Organizations...
  Customer 1: Acme Enterprises Ltd (US)
  Customer 2: Global Dynamics Corp (US)
[4/9] Seeding Product Catalog...
  Product: Brightloop Cloud Platform
  Product: Enterprise Dedicated Infrastructure
[5/9] Seeding Subscription Plans...
  Plan: Cloud SaaS Starter ($49.00/MONTHLY)
  Plan: Cloud SaaS Professional ($149.00/MONTHLY)
  Plan: Cloud SaaS Pro Annual ($1490.00/YEARLY)
  Plan: Dedicated Enterprise Tier ($1200.00/QUARTERLY)
[6/9] Seeding Tax Rules...
  Tax Rule: Standard Sales Tax (8.25%)
  Tax Rule: Value Added Tax (5%)
[7/9] Seeding Discount Rules...
  Discount: WELCOME15 (15% off)
  Discount: SAVE50 ($50.00 off)
[8/9] Seeding Active Subscriptions...
  Sub 1: SUB-202610-ACME-001 (Acme Enterprises Ltd)
  Sub 2: SUB-202610-GLOB-001 (Global Dynamics Corp)
[9/9] Seeding Invoices & Payments...
  Invoice 1: INV-202610-ACME-PAID (PAID, $149.00)
  Invoice 2: INV-202610-ACME-PART (PARTIALLY_PAID, $149.00 total, $50.00 paid, $99.00 due)
  Invoice 3: INV-202610-GLOB-OVERDUE (OVERDUE, $1200.00 due)
  Payment: PAY-202610-000003 ($99.00, VOIDED)
=== Seeding Complete: All demo datasets populated successfully! ===
```

### 2.4 Start the Backend API Server
In **Terminal 1** (from `c:\QuartusProjects\makeaton-initial\backend`):
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Verification:**
- Open your browser or run:
  ```powershell
  curl.exe -s http://127.0.0.1:8000/api/v1/health
  # Response: {"status":"healthy","version":"1.0.0"}

  curl.exe -s http://127.0.0.1:8000/api/v1/health/db
  # Response: {"status":"healthy","database":"connected","database_time":...}
  ```
- Interactive OpenAPI Swagger UI is available at: `http://127.0.0.1:8000/api/v1/docs`

### 2.5 Start the Frontend Development Server
In **Terminal 2** (from `c:\QuartusProjects\makeaton-initial`):
```powershell
npm run dev --prefix frontend
```

**Verification:**
- Open your browser at `http://localhost:3000`.
- The application homepage or login screen should appear with the high-contrast Neo-Brutalist interface.

---

## 3. Authentication, Login & Account Testing

### 3.1 Pre-Configured Seed Credentials
The database is pre-populated with the following user accounts:

| Persona | Role | Email Address | Seed Password | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Global Admin** | `ADMIN` | `admin@example.com` | `AdminPass123!` | Complete administrative authority |
| **Ops Staff 1** | `STAFF` | `staff1@example.com` | `StaffPass123!` | Daily operations, quotations, invoices |
| **Customer A** | `CUSTOMER` | `customer.acme@example.com` | `CustomerPass123!` | Acme Enterprises Ltd portal access |
| **Customer B** | `CUSTOMER` | `customer.global@example.com` | `CustomerPass123!` | Global Dynamics Corp portal access |

---

> [!NOTE]
> **RFC 2606 Compliant Demo Accounts:**  
> All seeded development demo accounts use syntactically valid reserved example.com email addresses conforming to RFC 2606 and Pydantic v2 EmailStr validation.  
> 
> You can authenticate directly using either:  
> 1. **One-Click Quick-Fill Buttons:** Click ADMIN, STAFF, CUST (ACME), or CUST (GLOBAL) on /login to auto-populate credentials and sign in immediately.  
> 2. **Manual Form Input:** Type the exact credentials from the table above into the email and password inputs.  
> 3. **Direct Bearer Token Injection:** Use the top navbar **Key icon (🔑)** to paste a JWT token if testing headless or API-driven workflows.
---

### 3.2 Test Case AUTH-01: Administrator Sign In
1. Navigate to `http://localhost:3000/login`.
2. Inspect the Neo-Brutalist card: strong 2–3px black borders, yellow brand icon, hard offset shadows (`shadow-nb-xl`).
3. Enter administrator credentials:
   - **Email:** `admin@example.com` (or supply JWT token via Navbar 🔑)
   - **Password:** `AdminPass123!`
4. Click the yellow button **"Sign in"**.
5. **Expected Outcome:**
   - Redirects to `/admin/dashboard`.
   - Top navbar displays the purple **ADMIN** badge.
   - All 10 navigation tabs are visible: `Dashboard`, `Invoices`, `Payments`, `Subscriptions`, `Quotations`, `Products`, `Plans`, `Taxes`, `Discounts`, and `Audit`.

### 3.3 Test Case AUTH-02: Operations Staff Sign In
1. Open an Incognito/Private window or click **Logout** from the Admin session.
2. Sign in as Staff:
   - Generate token for staff:
     ```powershell
     cd backend; .\.venv\Scripts\python.exe -c "from app.core.security import create_access_token; from app.db.session import SessionLocal; from app.models.auth import User; db=SessionLocal(); u=db.query(User).filter(User.role=='STAFF').first(); print(create_access_token(str(u.id)))"
     ```
   - Click Navbar 🔑, paste the token, and click **"Save Token"**.
3. **Expected Outcome:**
   - Redirects to `/admin/dashboard`.
   - Top navbar displays the blue **STAFF** badge.
   - Notice that the **Audit** tab is hidden from the navigation bar.

### 3.4 Test Case AUTH-03: Customer Self-Service Sign In
1. Open a new browser session.
2. Generate token for Customer 1 (Acme Enterprises):
   ```powershell
   cd backend; .\.venv\Scripts\python.exe -c "from app.core.security import create_access_token; from app.db.session import SessionLocal; from app.models.auth import User; db=SessionLocal(); u=db.query(User).filter(User.email=='customer.acme@example.com').first(); print(create_access_token(str(u.id)))"
   ```
3. Click Navbar 🔑, paste the token, and click **"Save Token"**.
4. **Expected Outcome:**
   - Redirects to `/portal/dashboard`.
   - Top navbar displays the green **CUSTOMER** badge.
   - Navigation links are strictly scoped to: `Portal` and `My Invoices`.

### 3.5 Test Case AUTH-05: Session Logout
1. In any logged-in session, click the red **Logout** button (door icon with arrow) in the top-right navbar.
2. **Expected Outcome:**
   - Auth token is cleared from `localStorage`.
   - Browser redirects to `/login`.
   - Attempting to access `/admin/dashboard` or `/portal/dashboard` without a token redirects immediately to `/login`.

---

## 4. ADMIN Module — Comprehensive Functional Testing

Log in as **ADMIN** before executing the test cases in this section.

```
       +-----------------------------------------------------------+
       |                  ADMIN CONSOLE OVERVIEW                   |
       +-----------------------------------------------------------+
       |  [Dashboard] [Invoices] [Payments] [Subscriptions]        |
       |  [Quotations] [Products] [Plans] [Taxes] [Discounts] [Audit]|
       +-----------------------------------------------------------+
```

---

### 4.1 Executive & Operations Dashboard
**URL:** `http://localhost:3000/admin/dashboard`

#### Step-by-Step Instructions:
1. Navigate to `/admin/dashboard`.
2. Verify the 6 top KPI metric cards:
   - **Customers:** Displays total customers and active count (e.g., `2` total, `2 active`).
   - **Subscriptions:** Active contracts count (e.g., `2` active of `2 total`).
   - **Total Invoiced:** Total gross invoiced revenue formatted as currency (e.g., `$1498.00`).
   - **Collected:** Total settled payments (e.g., `$199.00 Settled receipts`).
   - **Outstanding:** Receivables pending collection (e.g., `$1299.00`).
   - **Overdue:** Highlighted in red/coral background showing past-due receivables (e.g., `$1200.00`).
3. Verify the secondary distribution sections:
   - **Active Subscriptions by Interval:** Progress bar breakdown (e.g., Monthly vs Quarterly).
   - **Invoice Status Distribution:** Color-coded status counts (`PAID`, `PARTIALLY_PAID`, `OVERDUE`).
4. Verify the **Recent Invoices** and **Recent Settlements** tables:
   - Click the "View all invoices" link (`ArrowRight`) to verify navigation to `/admin/invoices`.
   - Click the circular refresh icon in the upper right to verify smooth re-fetching.

---

### 4.2 Customer Organization Management
**Endpoint:** `http://127.0.0.1:8000/api/v1/customers/` & Swagger UI

#### Step-by-Step Instructions:
1. Open Swagger UI at `http://127.0.0.1:8000/api/v1/docs` in a new tab.
2. Authorize Swagger by clicking the green **Authorize** button at the top right and pasting the Admin Bearer token.
3. Scroll to **Customer Organizations** → `GET /api/v1/customers/`.
4. Click **"Try it out"** and **"Execute"**:
   - Verify HTTP `200 OK`.
   - Verify existing organizations: `Acme Enterprises Ltd` and `Global Dynamics Corp`.
5. Test Customer Creation via `POST /api/v1/customers/`:
   - Click **"Try it out"** and paste this JSON body:
     ```json
     {
       "company_name": "Stark Industrial Systems Ltd",
       "contact_email": "billing@starkindustries.com",
       "contact_phone": "+1-555-0199",
       "billing_address_line1": "10880 Wilshire Blvd",
       "city": "Los Angeles",
       "state": "CA",
       "postal_code": "90024",
       "country": "US",
       "tax_id": "US-TAX-998877",
       "currency": "USD"
     }
     ```
   - Click **"Execute"**.
   - Verify HTTP `201 Created`. Copy the returned `id` (e.g., `cust_uuid`).
6. Verify Member Addition via `POST /api/v1/customers/{customer_id}/members`:
   - Add a customer contact user to the organization.

---

### 4.3 Product Catalogue & Variant Management
**URL:** `http://localhost:3000/admin/products`

```
  +-------------------------------------------------------------+
  | PRODUCTS CATALOGUE                                [+ New]   |
  +-------------------------------------------------------------+
  | Name: Cloud Platform | Type: SOFTWARE | Price: $49.00       |
  | Actions: [Variants ▤]  [Taxes %]  [Edit ✎]  [Deactivate 🗑] |
  +-------------------------------------------------------------+
```

#### Step-by-Step Instructions:
1. Navigate to `/admin/products`.
2. Inspect existing products:
   - *Brightloop Cloud Platform* (`SOFTWARE`, Base Price: `$49.0000`)
   - *Enterprise Dedicated Infrastructure* (`SERVICE`, Base Price: `$1200.0000`)
3. Click the yellow button **"+ New Product"** at the top right:
   - **Product Name:** `Developer API Gateway Add-on`
   - **Product Type:** Select `ADDON` from dropdown
   - **Base Price:** `29.0000`
   - **Cost Price:** `5.0000`
   - **Description:** `High-throughput managed rate limiter and API proxy`
   - Click **"Create Product"**.
4. Verify the new product appears in the table with an `Active` badge.
5. Click the **Variants** icon (`Layers`) on the newly created product:
   - A Neo-Brutalist modal opens.
   - Enter:
     - **Variant Name:** `High Concurrency Tier (10k req/min)`
     - **Price Delta:** `50.0000`
     - **SKU:** `GW-ADDON-10K`
   - Click **"+ Add Variant"**.
   - Verify the variant appears in the list with computed price `$79.00`.
   - Click the black **"Close"** button.
6. Click the **Taxes** icon (`Receipt`) on the product:
   - Select `Standard Sales Tax (8.25%)` checkbox.
   - Click **"Save Tax Assignments"**.
   - Verify notification: `Tax assignments updated successfully`.

---

### 4.4 Subscription Plans & Mutual Exclusivity Rules
**URL:** `http://localhost:3000/admin/plans`

#### Step-by-Step Instructions:
1. Navigate to `/admin/plans`.
2. Inspect the pre-configured plans:
   - *Cloud SaaS Starter* ($49.00 / MONTHLY)
   - *Cloud SaaS Professional* ($149.00 / MONTHLY)
   - *Cloud SaaS Pro Annual* ($1490.00 / YEARLY)
   - *Dedicated Enterprise Tier* ($1200.00 / QUARTERLY)
3. Click **"+ New Plan"** to test the Plan Creation Modal:
   - **Plan Name:** `Startup Growth Tier`
   - **Description:** `All-in-one growth bundle for scaling teams`
   - **Billing Interval:** `MONTHLY`
   - **Interval Count:** `1`
   - **Base Price:** `89.0000`
   - **Minimum Quantity:** `1`
4. **Test the Database Mutual Exclusivity Constraint (`chk_plan_renewal_mutual_exclusion`):**
   - Check **Auto Renew** (`true`).
   - Also check **Auto Close on Expiry** (`true`).
   - Click **"Create Plan"**.
   - **Expected Outcome:** The system displays a validation error or database rejection:  
     `auto_renew and auto_close_on_expiry are mutually exclusive; both cannot be TRUE`.
5. Uncheck **Auto Close on Expiry** (keep Auto Renew checked).
6. Click **"Create Plan"**.
7. **Expected Outcome:** The plan is created successfully and appears in the table.

---

### 4.5 Tax Configuration & PostgreSQL GiST Overlap Protection
**URL:** `http://localhost:3000/admin/taxes`

#### Step-by-Step Instructions:
1. Navigate to `/admin/taxes`.
2. Inspect active tax rules:
   - *Standard Sales Tax (8.25%)* (`STANDARD`, US / CA)
   - *Value Added Tax (5%)* (`VAT`, US / NY)
3. Click **"+ New Tax Rule"**:
   - **Rule Name:** `EU Digital Services VAT`
   - **Tax Rate (%):** `20.0000`
   - **Tax Scope:** Select `VAT`
   - **Country Code:** `DE`
   - **State / Province:** (leave blank for nationwide)
   - **Valid From:** `2026-01-01`
   - **Valid Until:** `2026-12-31`
   - Click **"Create Tax Rule"**.
   - Verify rule appears with `20%` rate badge.
4. **Test PostgreSQL GiST Temporal Exclusion (`excl_tax_rule_no_overlapping_periods`):**
   - Click **"+ New Tax Rule"** again.
   - Enter identical jurisdiction and scope with an overlapping validity range:
     - **Rule Name:** `Conflicting German VAT`
     - **Tax Rate (%):** `19.0000`
     - **Tax Scope:** `VAT`
     - **Country Code:** `DE`
     - **State / Province:** (leave blank)
     - **Valid From:** `2026-06-01` (overlaps with `2026-01-01` to `2026-12-31`)
     - **Valid Until:** `2027-05-31`
   - Click **"Create Tax Rule"**.
   - **Expected Outcome:** Rejection with HTTP 409 Conflict:  
     `Conflicting overlapping tax rule already exists for this jurisdiction and scope (excl_tax_rule_no_overlapping_periods)`.
   - Click **"Cancel"** to close modal.

---

### 4.6 Discount Rules & Interactive Rule Evaluator
**URL:** `http://localhost:3000/admin/discounts`

```
  +-------------------------------------------------------------+
  | DISCOUNT RULES                                    [+ New]   |
  | Rules: WELCOME15 (15% Order) | SAVE50 ($50 Fixed Credit)    |
  +-------------------------------------------------------------+
  | DISCOUNT CALCULATOR DRAWER                                  |
  | Code: [WELCOME15] Subtotal: [$1000.00] Cycle: [1]           |
  | Result: ELIGIBLE -> Discount Applied: $150.00               |
  +-------------------------------------------------------------+
```

#### Step-by-Step Instructions:
1. Navigate to `/admin/discounts`.
2. Review active discount codes:
   - `WELCOME15`: 15% discount on Order subtotal.
   - `SAVE50`: $50 fixed deduction on subtotal.
3. Scroll down to the **Discount Evaluator** section:
   - **Discount Code:** `WELCOME15`
   - **Order Subtotal ($):** `1000.00`
   - **Billing Cycle Number:** `1`
   - Click **"Evaluate Discount Rule"**.
4. **Expected Outcome:**
   - Green evaluation box displays: `ELIGIBLE`.
   - **Discount Calculated:** `$150.00`.
   - **Explanation:** `15% discount applied to eligible subtotal of $1000.00`.
5. Test Cycle Expiration:
   - Change **Billing Cycle Number** to `2`.
   - Click **"Evaluate Discount Rule"**.
   - If configured as `FIRST_INVOICE_ONLY`, verify the rule reports ineligible for cycle 2.

---

### 4.7 Quotation Lifecycle & Snapshot Freezing
**URL:** `http://localhost:3000/admin/quotations`

#### Step-by-Step Instructions:
1. Navigate to `/admin/quotations`.
2. Click **"+ New Quotation"** at the top right:
   - **Customer Organization:** Select `Acme Enterprises Ltd`
   - **Subscription Plan:** Select `Cloud SaaS Professional` ($149.00/mo)
   - **Discount Code:** Enter `WELCOME15`
   - **Validity Period:** `30` days
   - **Line Items:** Click **"+ Add Item"** → Select `Developer API Gateway Add-on` → Quantity: `2` (Price: `$29.00`)
   - **Notes:** `Enterprise onboarding quotation with promotional introductory discount.`
   - Click **"Create Quotation"**.
3. Locate the new quotation in the list (Status: `DRAFT`).
4. Click the **View** icon (`Eye`) to open Quotation Details:
   - Verify financial summary: Subtotal ($149 + $58 = $207), 15% discount applied, taxes computed, Banker's rounding applied.
5. Click **"Mark as Sent"** (`Send` icon):
   - Status updates atomically from `DRAFT` → `SENT`.
6. Click **"Customer Confirmed"** (`Check` icon):
   - Status transitions from `SENT` → `CONFIRMED`.
   - The financial snapshot is now immutable.
7. Click **"Convert to Subscription"** (`RefreshCw` icon):
   - A confirmation dialog appears. Confirm the conversion.
   - **Expected Outcome:** The backend converts the confirmed quotation into an active recurring subscription. The screen displays the generated Subscription Number (e.g. `SUB-...`).

---

### 4.8 Subscription Lifecycle Operations
**URL:** `http://localhost:3000/admin/subscriptions`

#### Step-by-Step Instructions:
1. Navigate to `/admin/subscriptions`.
2. Locate subscription `SUB-202610-ACME-001` (Acme Enterprises Ltd).
3. Click the **View** icon (`Eye`) to open the detail drawer:
   - Verify Status: `ACTIVE`.
   - Verify Plan: *Cloud SaaS Professional* ($149.00 / MONTHLY).
   - Verify Billing Anchor Day: e.g., `1`.
   - Verify Next Billing Date: e.g., `2026-11-01`.
4. **Test Pause Operation:**
   - Click the orange button **"Pause Subscription"** (`Pause` icon).
   - In the modal, enter **Pause Reason:** `Temporary client infrastructure migration`.
   - Click **"Confirm Pause"**.
   - Verify the subscription status badge immediately changes to yellow `PAUSED`.
5. **Test Resume Operation:**
   - In the detail modal, click the green button **"Resume Subscription"** (`Play` icon).
   - Status updates back to green `ACTIVE`.
6. **Test Cancellation / Early Close (on a separate test subscription):**
   - Click **"Close / Terminate"**.
   - Enter reason: `Client requested contract termination`.
   - Confirm: Status updates to red `CLOSED`.

---

### 4.9 Invoice Generation & Batch Recurring Billing
**URL:** `http://localhost:3000/admin/invoices`

```
  +-------------------------------------------------------------+
  | INVOICES LEDGER                         [⚙ Run Billing]     |
  +-------------------------------------------------------------+
  | Number: INV-...-ACME-PART | Total: $149 | Balance Due: $99  |
  | Status: PARTIALLY_PAID    | [View] [PDF] [Mail] [Pay] [Void]|
  +-------------------------------------------------------------+
```

#### Step-by-Step Instructions:
1. Navigate to `/admin/invoices`.
2. Inspect the pre-seeded invoice records:
   - `INV-202610-ACME-PAID`: Total `$149.00`, Paid `$149.00`, Balance Due `$0.00` (Status: `PAID`).
   - `INV-202610-ACME-PART`: Total `$149.00`, Paid `$50.00`, Balance Due `$99.00` (Status: `PARTIALLY_PAID`).
   - `INV-202610-GLOB-OVERDUE`: Total `$1200.00`, Paid `$0.00`, Balance Due `$1200.00` (Status: `OVERDUE`).
3. Click **"Run Billing"** (`Play` icon) at top right:
   - A modal appears titled **"Execute Recurring Billing Run"**.
   - **Execution Date:** Today's date (or future date e.g., `2026-11-01`).
   - Click the yellow button **"Execute Recurring Run"**.
4. **Expected Outcome:**
   - The modal reports real-time batch statistics:
     - **Target Date:** Selected date
     - **Subscriptions Evaluated:** Active contracts count
     - **Invoices Created:** Count of newly billed cycles
     - **Invoices Skipped:** Count of subscriptions already billed for the period
     - **Failures:** `0`
5. Close the modal. Inspect the refreshed table.

---

### 4.10 Tax-Compliant PDF Document Generation
**URL:** `http://localhost:3000/admin/invoices`

#### Step-by-Step Instructions:
1. On invoice `INV-202610-ACME-PART`, click the **Download PDF** icon (`Download`).
2. The browser initiates a direct download of `INV-202610-ACME-PART.pdf`.
3. Open the downloaded PDF in Adobe Acrobat, Google Chrome, or Preview:
   - **Header:** Company banner `Brightloop Technologies Inc.` with Tax ID `27AABCB1234F1Z5`.
   - **Customer Section:** `Acme Enterprises Ltd` with complete billing address.
   - **Table:** Clean line items with unit prices, quantity, and line subtotals.
   - **Tax Breakdown:** Explicit tax rate lines (sales tax / VAT).
   - **Payments Ledger:** History of applied payments (`$50.00` card payment).
   - **Balance Due:** Clearly states `$99.00` remaining.
   - **Remittance Footer:** Bank wire remittance instructions and payment terms.
4. **Technical Invariant:** Verify that the PDF generation was handled natively in pure Python 1.4 specification without external headless browser binaries.

---

### 4.11 Payment Recording & Strict Overpayment Rejection
**URL:** `http://localhost:3000/admin/invoices`

#### Step-by-Step Instructions:
1. Locate invoice `INV-202610-ACME-PART` (Total: `$149.00`, Balance Due: `$99.00`).
2. Click the green **Record Payment** button (`CreditCard` icon).
3. The **Record Settlement Payment** modal opens.
4. **Test Strict Overpayment Rejection Guard:**
   - Enter **Payment Amount ($):** `150.00` (exceeds balance of `$99.00`).
   - Payment Method: `CREDIT_CARD`.
   - Reference: `TEST-OVERPAY-001`.
   - Click **"Confirm & Settle Payment"**.
   - **Expected Outcome:** The settlement is blocked with an explicit error message:  
     `Payment amount ($150.00) exceeds invoice outstanding balance ($99.00)`.  
     *(Overpayment rejection invariant enforced).*
5. **Record Valid Settlement Payment:**
   - Correct the **Payment Amount ($):** `99.00` (exact balance due).
   - **Payment Method:** `CREDIT_CARD`.
   - **Payment Reference:** `STRIPE-CH-981244`.
   - **Internal Notes:** `Settlement received via automated gateway webhook`.
   - Click **"Confirm & Settle Payment"**.
6. **Expected Outcome:**
   - Invoice balance due drops to `$0.00`.
   - Invoice amount paid updates to `$149.00`.
   - Invoice status transitions automatically from `PARTIALLY_PAID` to green `PAID`.

---

### 4.12 Immutable Payment Voiding & Ledger Restoration
**URL:** `http://localhost:3000/admin/payments`

```
  +-------------------------------------------------------------+
  | SETTLEMENTS LEDGER                                          |
  +-------------------------------------------------------------+
  | Payment: PAY-202610-000004 | Amount: $99.00 | Status: Settled|
  | Action: [Void Payment ⊘]                                     |
  +-------------------------------------------------------------+
```

#### Step-by-Step Instructions:
1. Navigate to `/admin/payments`.
2. Locate the `$99.00` payment just recorded in step 4.11 (Status: `Settled` / `SUCCESS`).
3. Click the red **Void** icon (`Ban`).
4. The **Authorize Payment Void** modal opens:
   - Review warning: *Voiding a payment permanently excludes it from the invoice paid total and restores the balance due.*
   - Enter **Reason for Voiding:** `Customer duplicate charge dispute — authorized refund by billing manager`.
   - Click **"Confirm & Authorize Void"**.
5. **Expected Outcome in Payments Table:**
   - Payment status badge changes immediately from green `Settled` to coral `Voided`.
6. **Verify Automatic Ledger Restoration:**
   - Navigate back to `/admin/invoices`.
   - Locate invoice `INV-202610-ACME-PART`.
   - **Expected Outcome:**
     - Amount paid has reverted from `$149.00` back to `$50.00`!
     - Balance due is restored from `$0.00` back to `$99.00`!
     - Status has returned from `PAID` back to `PARTIALLY_PAID`!
   - This proves the atomic two-way ledger reconciliation invariant.

---

### 4.13 Tamper-Evident System Audit Trail
**URL:** `http://localhost:3000/admin/audit`

#### Step-by-Step Instructions:
1. Navigate to `/admin/audit`.
2. Inspect the immutable audit log table:
   - Notice actions recorded chronologically: `PAYMENT_RECORDED`, `PAYMENT_VOIDED`, `SUBSCRIPTION_PAUSED`, `QUOTATION_CONFIRMED`.
3. Filter by Action:
   - Select `PAYMENT_VOIDED` from the action dropdown.
   - Click the row to expand details.
4. **Inspect Audit Payload:**
   - Verify recorded fields: Actor User ID, Client IP address (`127.0.0.1`), Entity (`Payment`), and Timestamp.
   - Click **Payload** to view JSON diff:
     - Contains before/after status transition (`SUCCESS` → `VOIDED`).
     - Contains recorded void reason.
     - **Security Check:** Verify that no credit card numbers, CVVs, passwords, or secrets are present in the audit log payload.

---

### 4.14 Financial Metrics & Balance Reconciliation
**URL:** `http://localhost:3000/admin/dashboard` & Database Check

#### Step-by-Step Instructions:
1. Return to `/admin/dashboard`.
2. Verify that **Total Collected** and **Outstanding** immediately reflect the voided transaction:
   - Outstanding increased by `$99.00`.
   - Collected decreased by `$99.00`.
3. Verify the underlying database check constraint:
   - `total_amount = subtotal_amount - discount_amount + tax_amount + rounding_adjustment`.
   - Zero floating-point drift: all calculations use exact decimal arithmetic.

---

## 5. STAFF Module — Operational Flows & Negative RBAC Checks

Sign in as **STAFF** (`staff1@example.com` or via Navbar 🔑 using a Staff token).

### 5.1 Permitted Operational Flows
1. **Quotations:** Navigate to `/admin/quotations`. Verify Staff can create, edit, send, and confirm quotations.
2. **Subscriptions:** Navigate to `/admin/subscriptions`. Verify Staff can view subscriptions and trigger pause/resume operations.
3. **Invoices:** Navigate to `/admin/invoices`. Verify Staff can view invoices, download PDFs, and record customer payments.

### 5.2 Negative RBAC Security Checks (Forbidden Actions)
1. **Audit Log Access:**
   - Notice that the **Audit** link is absent from the navigation bar.
   - Attempt direct URL navigation to `http://localhost:3000/admin/audit`.
   - **Expected Outcome:** The page displays `Access Denied` or redirects to `/admin/dashboard`.
   - Attempt direct API query via PowerShell:
     ```powershell
     curl.exe -s -H "Authorization: Bearer <STAFF_JWT>" http://127.0.0.1:8000/api/v1/audit/
     ```
   - **Expected Outcome:** HTTP `403 Forbidden` (`{"detail":"Forbidden: Administrator role required"}`).
2. **Staff Account Creation:**
   - Attempt to call the admin user creation endpoint with Staff credentials:
     ```powershell
     curl.exe -s -X POST -H "Authorization: Bearer <STAFF_JWT>" -H "Content-Type: application/json" -d '{"email":"hacker@brightloop.com","password":"Password123!","full_name":"Fake Admin","role":"ADMIN"}' http://127.0.0.1:8000/api/v1/users/
     ```
   - **Expected Outcome:** HTTP `403 Forbidden`. Staff cannot create admin accounts or escalate privileges.

---

## 6. CUSTOMER Module — Portal & Multi-Tenant Data Isolation

Sign in as **CUSTOMER 1** (`customer.acme@example.com` representing *Acme Enterprises Ltd*).

```
  +-------------------------------------------------------------+
  | CUSTOMER SELF-SERVICE PORTAL                [Acme Ent Ltd]  |
  +-------------------------------------------------------------+
  | Active Subscriptions: 1 | Outstanding: $99.00 | Paid: $50.00|
  +-------------------------------------------------------------+
  | My Subscriptions: Cloud SaaS Professional ($149.00/mo)      |
  | My Invoices: INV-...-ACME-PART ($99 due) [Download PDF ⤓]   |
  +-------------------------------------------------------------+
```

### 6.1 Customer Portal Experience
1. Navigate to `http://localhost:3000/portal/dashboard`.
2. Verify personalized welcome banner:
   - Organization name: `Acme Enterprises Ltd`.
   - User name: `Acme Customer Admin`.
3. Verify metric cards:
   - **Active Subscriptions:** `1`
   - **Outstanding Balance:** `$99.00`
   - **Total Paid:** `$199.00`
4. Verify **Active Subscriptions** table:
   - Displays plan *Cloud SaaS Professional* with next billing date.
5. Navigate to `/portal/invoices`:
   - Lists only invoices belonging to *Acme Enterprises Ltd*.
   - Click **"Download PDF"** on invoice `INV-202610-ACME-PART`.
   - Verify PDF downloads correctly.

### 6.2 Strict Multi-Tenant Data Isolation (Cross-Tenant Test)
1. As Customer 1 (*Acme Enterprises Ltd*), attempt to access Customer 2's (*Global Dynamics Corp*) overdue invoice:
   - Obtain Global Dynamics Corp's invoice ID (`INV-202610-GLOB-OVERDUE`) from the admin console or seed data.
   - Run this PowerShell command using **Customer 1's** Bearer token:
     ```powershell
     curl.exe -s -w "\nHTTP_STATUS: %{http_code}\n" -H "Authorization: Bearer <CUSTOMER_1_JWT>" http://127.0.0.1:8000/api/v1/invoices/<GLOBAL_DYNAMICS_INVOICE_ID>
     ```
2. **Expected Outcome:**
   - The backend responds with `HTTP 404 Not Found` or `HTTP 403 Forbidden`.
   - Customer 1 cannot view, list, or download invoices belonging to Customer 2.
3. Test PDF Isolation:
   ```powershell
   curl.exe -s -w "\nHTTP_STATUS: %{http_code}\n" -H "Authorization: Bearer <CUSTOMER_1_JWT>" http://127.0.0.1:8000/api/v1/invoices/<GLOBAL_DYNAMICS_INVOICE_ID>/pdf
   ```
   - **Expected Outcome:** `HTTP 404 Not Found` or `HTTP 403 Forbidden`.

---

## 7. Brevo SMTP & Invoice Email Dispatch Testing

Brightloop includes a resilient email notification service designed to deliver invoice notifications and PDF attachments via **Brevo SMTP** (`smtp-relay.brevo.com`).

### 7.1 Test Case MAIL-01: SMTP Not Configured (Graceful Fallback)
1. Ensure `SMTP_HOST` in `.env` is empty or unset.
2. Sign in as Admin. Navigate to `/admin/invoices`.
3. Click the **Send Email** icon (`Mail`) on any invoice.
4. Confirm the prompt: *"Send invoice PDF to customer email?"*.
5. **Expected Outcome:**
   - Alert modal displays: `Email dispatch processed: customer.acme@example.com (skipped)`.
   - Open `/admin/audit`: Verify an audit event was created with action `INVOICE_EMAIL_SKIPPED` and detail `SMTP host not configured. PDF available for direct download.`.
   - The invoice and application continue operating normally with zero crashes or rolled-back state.

### 7.2 Test Case MAIL-02: Brevo SMTP Delivery
To test live dispatch with Brevo:
1. Configure credentials in `backend/.env`:
   ```dotenv
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=your-brevo-login@domain.com
   SMTP_PASSWORD=your-brevo-smtp-key
   SMTP_TLS=true
   EMAILS_FROM_NAME=Brightloop Billing
   EMAILS_FROM_EMAIL=verified-sender@yourdomain.com
   ```
2. **Sender Domain Validation Rule:**
   - Notice that if `EMAILS_FROM_EMAIL` is set to `billing@brightloop.local` or any `.local` domain, real delivery is automatically blocked to prevent relay rejection. An audit event `INVOICE_EMAIL_FAILED` is logged.
   - When set to a verified Brevo domain sender, dispatch connects over TLS port 587, transmits the MIME multipart message with attached PDF, and logs `INVOICE_EMAIL_SENT`.
   - Verify recipient receives the email with the formatted invoice PDF attached.

---

## 8. Scheduled Recurring Billing CLI Verification

Brightloop provides a standalone CLI runner (`backend/scripts/run_billing.py`) designed to be triggered by Windows Task Scheduler or Linux cron.

### 8.1 Execute Standalone Billing Runner
Open PowerShell in the `backend` directory:

```powershell
cd backend
.\.venv\Scripts\python scripts/run_billing.py --batch-size 50
```

**Expected Console Output:**
```text
2026-10-31 18:45:10,123 [INFO] brightloop.scheduler: Starting recurring billing run for date: 2026-10-31 (batch size: 50)
2026-10-31 18:45:10,456 [INFO] brightloop.scheduler: Billing run completed in 0.33s | Evaluated: 2 | Created: 0 | Skipped: 2 | Failures: 0
{"subscriptions_evaluated": 2, "invoices_created": 0, "invoices_skipped": 2, "failures": 0, "errors": [], "elapsed_seconds": 0.333}
```

### 8.2 Verify Billing Idempotency (Zero Duplicate Invoices)
Run the exact same command a second time immediately:

```powershell
.\.venv\Scripts\python scripts/run_billing.py --batch-size 50
```

**Expected Console Output:**
```text
Billing run completed in 0.28s | Evaluated: 2 | Created: 0 | Skipped: 2 | Failures: 0
```
- **Verification Point:**
  - Notice `Created: 0` and `Skipped: 2`.
  - The database unique constraint `uq_subscription_billing_period` prevents double-invoicing for the same subscription period.
  - No duplicate invoices or advance charges are created.

### 8.3 Advance Target Date Execution
Run the billing runner for the next month:

```powershell
.\.venv\Scripts\python scripts/run_billing.py --date 2026-11-01 --batch-size 50
```

**Expected Outcome:**
- Subscriptions due on the 1st of next month are evaluated and invoiced.
- Invoices created count increments accordingly.

---

## 9. Negative Testing, Edge Cases & Security Invariants

Execute these explicit negative test scenarios to verify system defenses:

### 9.1 Invalid Credentials Rejection
1. Attempt login with:
   - **Email:** `admin@example.com`
   - **Password:** `WrongPassword999!`
2. **Expected Outcome:** HTTP `401 Unauthorized`. UI displays: `Incorrect email or password.`.

### 9.2 Financial Check Constraint Invariant (`chk_invoices_total_calc`)
1. Attempt to execute raw SQL or tampered payload with mismatched arithmetic:
   - `total_amount = 100.00`, but `subtotal = 80.00`, `tax = 0.00`, `discount = 0.00`.
2. **Expected Outcome:** PostgreSQL rejects the transaction with check constraint violation `chk_invoices_total_calc`.

### 9.3 Overpayment Rejection Invariant
1. Attempt to record a payment of `$200.00` on an invoice with `$99.00` balance due.
2. **Expected Outcome:** Rejection with error: `Payment amount exceeds invoice outstanding balance`.

### 9.4 One-Way Void Invariant
1. Attempt to void a payment that is already in `VOIDED` status.
2. **Expected Outcome:** Rejection with error: `Payment is already VOIDED and cannot be voided again`.

### 9.5 Plan Mutual Exclusivity Invariant
1. Attempt to create a plan with both `auto_renew = TRUE` and `auto_close_on_expiry = TRUE`.
2. **Expected Outcome:** Rejection with check constraint `chk_plan_renewal_mutual_exclusion`.

### 9.6 GiST Temporal Tax Exclusion Invariant
1. Attempt to create two tax rules for the same jurisdiction with overlapping date ranges.
2. **Expected Outcome:** Rejection with exclusion constraint `excl_tax_rule_no_overlapping_periods`.

---

## 10. Neo-Brutalist Visual & Responsive UI Verification

Verify the visual polish of the Neo-Brutalist design system across viewport breakpoints.

### 10.1 Key Neo-Brutalist Design Tokens
- **Background:** Warm cream `#FFFDF0` (`bg-cream`)
- **Borders:** Crisp, solid 2px to 3px black `#121212` (`border-nb-dark`)
- **Shadows:** Hard offset rectangular drop shadows with zero blur:
  - Small: `shadow-nb-sm` (`2px 2px 0px #121212`)
  - Standard: `shadow-nb` (`4px 4px 0px #121212`)
  - Large / Cards: `shadow-nb-xl` (`8px 8px 0px #121212`)
- **Vibrant Neo-Brutalist Color Palette:**
  - Yellow: `#FFE600` (`bg-nb-yellow`) — primary action buttons & highlight badges
  - Cobalt Blue: `#0047FF` (`bg-nb-blue`) — operations and staff accents
  - Coral / Salmon: `#FF5C5C` (`bg-nb-coral`) — overdue invoices, void badges, errors
  - Electric Purple: `#A855F7` (`bg-nb-purple`) — administrator role badge
  - Emerald Green: `#00D26A` (`bg-nb-green`) — paid badges & settled receipts

### 10.2 Viewport Responsiveness Verification
Open browser Developer Tools (F12) and toggle device emulation:

| Viewport | Target Device | Verification Points |
| :--- | :--- | :--- |
| **Desktop (1440px)** | Standard Monitor | Full navigation visible, 6-card dashboard grid, wide ledger tables |
| **Tablet (768px)** | iPad / Tablet | 2-column or 3-column KPI card wrap, tables horizontally scrollable without breaking container borders |
| **Mobile (375px)** | iPhone / Mobile | Single-column stacked cards, full-width buttons, accessible touch targets (min 44px) |

---

## 11. Master Test Results Evidence Matrix

Use this matrix to document the results of your manual testing run:

| Test ID | Module / Feature | Expected Outcome | Actual Result | Status | Verified By |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `ENV-01` | PostgreSQL 16 & GiST | Connection active, `btree_gist` enabled | As expected | PASS | Tester |
| `ENV-02` | Alembic Migrations | `upgrade head` brings schema to latest | As expected | PASS | Tester |
| `ENV-03` | Demo Data Seed | `seed_demo_data.py` completes 9/9 stages | As expected | PASS | Tester |
| `ENV-04` | FastAPI Health Endpoints | `/health` and `/health/db` return 200 OK | As expected | PASS | Tester |
| `AUTH-01` | Admin Authentication | Admin logs in, sees purple ADMIN badge & 10 tabs | As expected | PASS | Tester |
| `AUTH-02` | Staff Authentication | Staff logs in, sees blue STAFF badge, Audit hidden | As expected | PASS | Tester |
| `AUTH-03` | Customer Authentication | Customer logs in, sees green CUSTOMER badge | As expected | PASS | Tester |
| `AUTH-04` | Navbar Token Injection | Key icon modal saves JWT and reloads console | As expected | PASS | Tester |
| `DASH-01` | Executive Dashboard | 6 KPI metric cards calculate live from PostgreSQL | As expected | PASS | Tester |
| `CAT-01` | Product Creation | Creates billable product with base price | As expected | PASS | Tester |
| `CAT-02` | Product Variants | Creates variant with SKU and price delta | As expected | PASS | Tester |
| `CAT-04` | Plan Mutual Exclusivity | Blocks simultaneous auto-renew and auto-close | As expected | PASS | Tester |
| `TAX-02` | Tax GiST Exclusion | Blocks overlapping tax date ranges (409 Conflict) | As expected | PASS | Tester |
| `DISC-02` | Discount Evaluator | Simulates 15% discount on $1000 subtotal ($150) | As expected | PASS | Tester |
| `QUOT-02` | Quotation Transitions | Progresses DRAFT → SENT → CONFIRMED | As expected | PASS | Tester |
| `QUOT-03` | Quotation Conversion | Atomically converts quotation into active subscription| As expected | PASS | Tester |
| `SUB-02` | Pause Subscription | Pauses subscription with required reason modal | As expected | PASS | Tester |
| `SUB-03` | Resume Subscription | Resumes paused subscription back to ACTIVE | As expected | PASS | Tester |
| `INV-01` | Batch Billing Run | Modal evaluates subscriptions and creates invoices | As expected | PASS | Tester |
| `INV-03` | PDF Invoice Download | Downloads tax-compliant PDF with layout & ledger | As expected | PASS | Tester |
| `PAY-02` | Overpayment Rejection | Rejects payment exceeding invoice balance due | As expected | PASS | Tester |
| `PAY-03` | Payment Settlement | Settles balance, transitions invoice to PAID | As expected | PASS | Tester |
| `PAY-04` | Payment Voiding | Voids payment with mandatory audit reason | As expected | PASS | Tester |
| `PAY-05` | Ledger Restoration | Restores invoice balance and status after void | As expected | PASS | Tester |
| `AUD-01` | System Audit Trail | Records actor, IP, timestamp and before/after diff | As expected | PASS | Tester |
| `RBAC-01` | Staff Audit Boundary | Staff forbidden from accessing /admin/audit (403) | As expected | PASS | Tester |
| `PORT-01` | Customer Self-Service | Customer views account subscriptions and balances | As expected | PASS | Tester |
| `ISO-01` | Multi-Tenant Isolation | Customer A blocked from querying Customer B (404/403)| As expected | PASS | Tester |
| `MAIL-01` | Email Dispatch Fallback | Skips gracefully when SMTP unconfigured, logs audit | As expected | PASS | Tester |
| `CLI-01` | Scheduled Billing CLI | `run_billing.py` executes standalone batch billing | As expected | PASS | Tester |
| `CLI-02` | Billing Idempotency | Second CLI run produces 0 duplicate invoices | As expected | PASS | Tester |
| `UI-01` | Neo-Brutalist Polish | 2–3px borders, hard offset shadows, high contrast | As expected | PASS | Tester |
| `UI-02` | Responsive Viewports | Adapts cleanly across desktop, tablet, and mobile | As expected | PASS | Tester |

---

*End of Manual Testing Handbook — Brightloop Subscription Management System*
