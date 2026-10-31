# Brightloop Subscription Management System — Demo & Evaluation Walkthrough

This document provides a comprehensive, step-by-step evaluation guide for the **Brightloop Subscription Management System** (Stages 1 through 18 completed).

---

## 1. System Architecture & Prerequisites

- **Backend:** Python 3.13, FastAPI, Synchronous SQLAlchemy 2.x, Psycopg 3, Alembic, Pydantic v2.
- **Frontend:** Next.js 15.5 App Router, React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Database:** PostgreSQL 16 with B-tree and GiST temporal exclusion constraints (`btree_gist` extension).
- **Ledger Invariant:** Pure `NUMERIC(12, 2)` currency representation (no float drift), strict check constraints (`chk_invoices_total_calc`), Banker's Rounding (half-even), strict overpayment rejection, and atomic one-way payment voiding.

### Ports & Services
| Component | Local URL | Port |
| :--- | :--- | :--- |
| **Frontend Application** | `http://localhost:3000` | 3000 |
| **Backend REST API** | `http://localhost:8000` | 8000 |
| **Interactive OpenAPI Docs**| `http://localhost:8000/docs` | 8000 |
| **PostgreSQL Dev Database** | `postgresql://brightloop_app:***@localhost:5432/brightloop_dev` | 5432 |
| **PostgreSQL Test Database**| `postgresql://brightloop_app:***@localhost:5432/brightloop_test`| 5432 |

---

## 2. Quickstart Commands

### A. Run Database Migrations (Dev Database)
```powershell
cd backend
.\.venv\Scripts\python -m alembic upgrade head
```

### B. Seed Rich Idempotent Demo Data
```powershell
.\.venv\Scripts\python scripts/seed_demo_data.py
```

### C. Run Backend API Server
```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### D. Run Frontend Development Server
```powershell
npm run dev --prefix frontend
```

---

## 3. Pre-Configured Demo Credentials

The login page (`/login`) includes one-click quick-fill buttons for each role:

| Role | Email Address | Password | Intended Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@brightloop.local` | `AdminPass123!` | Full control: catalog, plans, taxes, discounts, users, audit log, billing runs, voids. |
| **Operations Staff** | `staff1@brightloop.local` | `StaffPass123!` | Day-to-day operations: customer management, quotations, subscriptions, invoices, payments. |
| **Customer 1** | `customer@acme.local` | `CustomerPass123!` | Acme Enterprises Ltd: self-service dashboard, subscriptions, invoice downloads. |
| **Customer 2** | `billing@globaldynamics.local` | `CustomerPass123!` | Global Dynamics Corp: view account subscriptions, past-due invoices, receipts. |

---

## 4. End-to-End Evaluation Journey (16 Steps)

### Step 1: Sign In as Administrator
1. Open `http://localhost:3000/login`.
2. Click the quick button **"Fill Admin Credentials"** (`admin@brightloop.local` / `AdminPass123!`).
3. Click **"Sign In to Console"**.
4. You are redirected to `/admin/dashboard`. Notice the top navbar displays the purple **ADMIN** role badge.

### Step 2: Inspect Executive & Operations Dashboard
1. Navigate to `http://localhost:3000/admin/dashboard`.
2. Review the live aggregated KPI cards:
   - **Customers:** Total and active accounts.
   - **Subscriptions:** Active contracts count.
   - **Total Invoiced:** Gross revenue billed across all invoices.
   - **Collected:** Settled receipts with zero float discrepancy.
   - **Outstanding Receivables & Overdue:** Highlighted in amber and rose.
3. Review the **Recent Invoices** and **Recent Settlements** tables with direct navigation links.

### Step 3: Product Catalogue & Plan Management
1. Navigate to `/admin/products`.
   - Inspect existing products (*Brightloop Cloud Platform*, *Enterprise Dedicated Infrastructure*).
   - Create a new billable product or service add-on.
2. Navigate to `/admin/plans`.
   - Inspect billing interval configurations: *Cloud SaaS Professional* ($149/month), *Dedicated Enterprise Tier* ($1200/quarter).
   - Notice the strict database constraint: `auto_renew = FALSE OR auto_close_on_expiry = FALSE`.

### Step 4: Tax Rules & GiST Temporal Exclusions
1. Navigate to `/admin/taxes`.
2. Review tax rules: *Standard Sales Tax (8.25%)* and *Value Added Tax (5%)*.
3. Note the PostgreSQL GiST exclusion constraint (`excl_tax_rule_no_overlapping_periods`): no overlapping date ranges are permitted for the same jurisdiction, protecting statutory accuracy.

### Step 5: Discount Rules Engine
1. Navigate to `/admin/discounts`.
2. Inspect active rules:
   - `WELCOME15`: 15% promotional discount on order subtotal.
   - `SAVE50`: $50 fixed-amount order credit.
3. Test discount calculation preview in the calculator drawer.

### Step 6: Create & Review Quotation
1. Switch user or stay as Admin/Staff. Navigate to `/admin/quotations`.
2. Click **"Create Quotation"**:
   - Select Customer: *Acme Enterprises Ltd*.
   - Plan: *Cloud SaaS Professional*.
   - Unit price: $149.00, Quantity: 1.
3. Save quotation in `DRAFT` state.
4. Transition quotation state: `DRAFT` → `SENT` → `CONFIRMED`.
   - Prices, discounts, taxes and banker's rounding are frozen into the immutable quotation snapshot.

### Step 7: Convert Quotation into Active Subscription
1. Inside the confirmed quotation detail modal (or via `/admin/subscriptions`), click **"Convert to Subscription"**.
2. Select Contract Start Date.
3. The platform atomically creates a `Subscription` record with billing anchor day, billing interval snapshot, and initial billing period `[start, end)`.

### Step 8: Trigger Batch Recurring Billing Run
1. Navigate to `/admin/invoices`.
2. Click the top button **"Run Billing Engine"**.
3. Select Execution Date (default today) and click **"Execute Billing"**.
4. The backend billing service evaluates active subscriptions due for billing, executes savepoint-isolated invoice creation, and reports:
   - Subscriptions evaluated
   - Invoices created
   - Invoices skipped (already billed)
   - Failures (0)

### Step 9: Verify Invoice Financial Snapshots & Math Reconciliation
1. On the invoices table, locate invoice `INV-202610-ACME-PART`.
2. Click the **"View Details"** eye icon to open the full drawer:
   - **Line Items Breakdown:** Plan fee description, unit price ($149.00), discount ($0.00), tax ($0.00), line total.
   - **Database Check Constraint:** `chk_invoices_total_calc`:
     `total_amount = subtotal_amount - discount_amount + tax_amount + rounding_adjustment`.
   - **Balance Calculation:** `balance_due = total_amount - amount_paid`.

### Step 10: Download Compliant Tax PDF Invoice
1. In the invoice row or drawer, click **"Download PDF"** (or invoke `GET /api/v1/invoices/{id}/pdf`).
2. Open the downloaded PDF in your browser or Adobe Reader:
   - Formatted with company header, logo banner, tax registration ID, customer billing address.
   - Tabular line items, tax lines, payments ledger, and bank remittance instructions.
   - Generated natively in pure Python 1.4 specification without external binary dependencies.

### Step 11: Record Settlement Payment & Strict Overpayment Rejection
1. On invoice `INV-202610-ACME-PART` (Balance Due: $99.00), click the **"Pay"** button.
2. In the modal, test the overpayment safety guard:
   - Try entering `$150.00` (exceeds balance of $99.00).
   - Submit: Notice the immediate rejection: *"Payment amount exceeds outstanding balance"*.
3. Now enter valid payment:
   - Amount: `$99.00`
   - Method: `CARD`
   - Reference: `AUTH-NET-99128`
4. Click **"Confirm & Settle"**:
   - The backend locks the invoice row with `SELECT ... FOR UPDATE`.
   - Amount paid updates to `$149.00`, balance due drops to `$0.00`.
   - Invoice status transitions atomically to `PAID`.

### Step 12: Authorize Immutable Payment Void
1. Navigate to `/admin/payments`.
2. Locate the payment record just created.
3. Click **"Void"**:
   - Enter authorized reason: *"Dispute / Customer duplicate charge request"*.
   - Click **"Confirm Void"**.
4. Inspect the result:
   - Payment status updates to `VOIDED` with void timestamp and authorizing user ID.
   - Payment amount is permanently excluded from the invoice's aggregate paid total.
   - Navigate back to `/admin/invoices`: notice the invoice balance due is restored from $0.00 back to $99.00, and its status returns to `PARTIALLY_PAID`!

### Step 13: Customer Self-Service Portal Experience
1. Click the Logout icon in the navbar.
2. On `/login`, click **"Fill Customer Credentials"** (`customer@acme.local` / `CustomerPass123!`).
3. Click **"Sign In to Console"**.
4. You are redirected to `/portal/dashboard`:
   - Personalized welcome banner: *Acme Enterprises Ltd*.
   - Metric cards: Active subscriptions, outstanding balance, total paid.
   - Subscriptions list with next billing date.
   - Invoices list with one-click **"Download PDF"** button.
5. Navigate to `/portal/invoices`:
   - Comprehensive searchable archive of all billing statements for Acme Enterprises Ltd.

### Step 14: Multi-Tenant Customer Data Isolation Verification
1. As `customer@acme.local`, attempt to directly query Global Dynamics Corp's invoice `INV-202610-GLOB-OVERDUE`:
   - Via API: `GET /api/v1/invoices/{global_dynamics_inv_id}` with Acme's Bearer token.
   - Result: HTTP `404 Not Found` (tenant-scoped) or `403 Forbidden`.
   - Cross-tenant access is strictly denied; Customer A cannot view, list, or download Customer B's records.

### Step 15: System Audit Trail & Tamper-Evident Ledger
1. Sign back in as Administrator (`admin@brightloop.local`).
2. Navigate to `/admin/audit`.
3. Filter by Action (`PAYMENT_RECORDED`, `PAYMENT_VOIDED`, `INVOICE_GENERATED`, etc.):
   - View chronological log entries with timestamp, actor ID, IP address, and entity ID.
   - Click **"Payload"** on any row to expand the structured JSON snapshot of before/after state changes.

### Step 16: CLI Scheduled Billing Execution
1. Open PowerShell and run the standalone scheduled billing CLI:
   ```powershell
   cd backend
   .\.venv\Scripts\python scripts/run_billing.py --batch-size 50
   ```
2. Inspect the structured JSON log output:
   - Demonstrates company timezone calculation (`Asia/Kolkata`).
   - Evaluates eligible subscriptions.
   - Fully idempotent: previously billed periods are skipped with zero duplicate invoices.

---

## 5. Automated Verification Test Suite

### Full Pytest Suite (80 Tests)
Run all unit, integration, and security tests against the dedicated test database:
```powershell
cd backend
.\.venv\Scripts\python -m pytest tests -v
```
**Expected Result:** `80 passed` (100% pass rate).

### Next.js Production Build
Run Next.js production build and TypeScript type-checking:
```powershell
npm run build --prefix frontend
```
**Expected Result:** `Compiled successfully` with 17 static/prerendered routes and 0 TypeScript errors.
