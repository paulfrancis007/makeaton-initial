# Brightloop Subscription Management System
## Progressive Antigravity Build Guide — `makeaton-initial`

**Purpose:** Build the challenge solution one verified feature at a time. Every stage includes manual setup, an Antigravity prompt, hands-on checks, and a gate. Do not begin the next stage until the current gate passes.

**Target product:** A responsive web application with three roles: **Admin, Staff, and Customer**.

**Engineering priority:** Database design and integrity first, then backend APIs and business logic, then connected UI, then security/performance/acceptance. The objective is not to generate code quickly; it is to build a system the team can explain, test, maintain, and demonstrate.

---

# 1. Understand the problem before coding

Brightloop sells software and add-ons through recurring subscriptions. Today, it manages subscriptions in spreadsheets, remembers renewals manually, types invoices by hand, matches payments against bank statements, and prepares reports manually.

The requested system centralizes this lifecycle:

1. An admin configures products, variants, plans, taxes, discounts, and quotation templates.
2. A customer registers and can later view only their own subscriptions, invoices, and payments.
3. Staff handles day-to-day customer work, quotations, subscriptions, invoices, and payment recording.
4. A quotation can be turned into a subscription.
5. When an eligible subscription becomes due, the system generates an invoice automatically.
6. Staff records full or partial payments against invoices.
7. Management sees active subscriptions, revenue received, outstanding balances, and overdue invoices.

## Role boundaries

| Capability | Admin | Staff | Customer |
|---|---:|---:|---:|
| Configure products, variants, plans and taxes | Yes | No | No |
| Create/change discount rules | Yes | No | No |
| Create staff accounts | Yes | No | No |
| Manage customer operations | Yes | Yes | Own profile only |
| Create quotations | Yes | Yes | No |
| Manage subscriptions | Yes | Yes, within policy | View own |
| Confirm/send/print invoices | Yes | Yes | View/download own |
| Record payments | Yes | Yes | No |
| View business-wide reports | Yes | Limited operational views | No |
| View another customer's information | As authorized | As authorized | Never |

The challenge brief does not enumerate every staff permission. Treat the table as the proposed permission design and document any adjustment. Enforce access in the backend; hiding a button is not security.

## Required functional areas

- Authentication, registration, password reset, and role-based authorization.
- Customer management.
- Products and product variants.
- Subscription plans with daily, weekly, monthly, and yearly billing.
- Tax rules.
- Quotation templates and quotations.
- Subscription lifecycle: Draft → Quotation → Confirmed → Active → Closed, with pause/resume where configured.
- Discounts: fixed or percentage, thresholds, validity dates, and usage limits.
- Automatic invoice generation with taxes and discounts.
- Payment recording, including partial payments.
- Admin, staff, and customer dashboards/reports.
- Performance and security for thousands of records.

## Explicit non-goals for the first implementation

- A separate Android/iOS app. Build a responsive webapp.
- A third-party payment gateway. Recording payments against invoices is sufficient for the brief.
- AI, blockchain, chatbot features, microservices, or cloud-only infrastructure without a demonstrated need.
- Firebase, Supabase, MongoDB Atlas, or another BaaS.
- Static JSON/mock arrays as the final source of application data.

---

# 2. Recommended stack and architecture

Use a conventional monolithic application with separately organized frontend and backend services:

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js App Router, React, TypeScript | Typed, responsive web interface |
| Styling | Tailwind CSS | Consistent layout and responsive styling |
| UI primitives | shadcn/ui and Lucide icons | Reusable accessible components |
| Forms | React Hook Form and Zod | Structured forms and client-side validation |
| Server state | TanStack Query | API fetching, cache, loading and error states |
| Backend | Python and FastAPI | Explicit REST API and modular business logic |
| API schemas | Pydantic | Server-side validation and response schemas |
| ORM | SQLAlchemy 2.x | Relational database operations |
| Migrations | Alembic | Version-controlled schema changes |
| Database | PostgreSQL | Relational integrity, transactions, constraints and indexes |
| Backend tests | Pytest | Unit and integration tests |
| Browser tests | Playwright | End-to-end user workflows |
| Local environment | Docker Compose or local PostgreSQL | Reproducible local database |
| Email testing | SMTP configuration and optionally Mailpit | Test password reset/invoice email locally |

## Keep the architecture lean

Do not add Redis, Celery, Kubernetes, microservices, cloud queues, or third-party APIs at the beginning. First create a reliable billing service and test it. For scheduled billing, initially provide a repeatable backend command that can be invoked manually and later by Windows Task Scheduler or a deployment scheduler. Add a dedicated worker only if the team can explain why it is necessary.

## Architecture overview

```text
Browser
  |
  | JSON over REST
  v
Next.js frontend
  |
  | /api/v1/*
  v
FastAPI backend
  |
  | SQLAlchemy 2.x
  v
PostgreSQL

Optional local email testing:
FastAPI -> SMTP -> Mailpit
```

## Important engineering decisions

- The frontend must not contain the source of truth for prices, tax, discounts, invoice status, or permissions.
- All important business rules must be validated again on the backend.
- The database must enforce important invariants using foreign keys, unique/check constraints, and indexes.
- Use `NUMERIC`/`DECIMAL` for money. Never use binary floating-point for financial calculations.
- Store historical snapshots on quotations, subscriptions, and invoices so later catalog changes do not rewrite the past.
- Use database transactions for operations that change multiple related records.
- Define the application/billing timezone explicitly and use timezone-aware timestamps where appropriate.
- The invoice's overdue state should be derived from due date and remaining balance, not manually toggled independently.

---

# 3. Repository and team workflow

Repository: **`makeaton-initial`**.

Before changing anything, inspect the current repository. Do not assume it is empty. Keep existing working code unless the team approves replacing it.

## Suggested repository layout

```text
makeaton-initial/
├── frontend/
├── backend/
├── docs/
│   ├── architecture.md
│   ├── database-design.md
│   └── decisions/
├── AGENTS.md
├── BUILD_GUIDE.md
├── .gitignore
└── README.md
```

This is a target layout, not permission to restructure the repository blindly. Antigravity must first report the actual current structure and preserve useful existing conventions.

## Git workflow — every team member participates

1. Use a feature branch for each meaningful unit of work.
2. Pull the latest shared branch before beginning.
3. Commit small, logically related changes.
4. Push your branch and open a pull request.
5. Ask another teammate to review the code and test evidence.
6. Merge only after the stage's test gate passes.
7. Do not let one person become the only person making commits.

Example PowerShell commands (replace `main` if the repository uses another default branch):

```powershell
git status
git switch main
git pull origin main
git switch -c feat/short-feature-name

# After implementation and testing:
git status
git add .
git commit -m "feat: describe the completed change"
git push -u origin feat/short-feature-name
```

Do not commit `.env`, credentials, tokens, database dumps, virtual environments, `node_modules`, build outputs, or temporary files. Do not use `git push --force` on shared branches.

## Suggested team ownership

- Database owner: ERD, schema review, constraints, migrations, query quality.
- Backend owner: FastAPI modules, services, API contracts, validation.
- Frontend owner: layouts, forms, tables, role navigation, responsive UI.
- Integration/test owner: end-to-end testing, debugging, test fixtures, CI/checklists.
- All members: review PRs, understand the whole workflow, contribute commits, and participate in the final presentation.

Ownership is not a silo. Every member should understand the data model and the end-to-end billing flow.

---

# 4. Using Antigravity correctly

1. Open the `makeaton-initial` repository root in Antigravity.
2. Add the `AGENTS.md` file in this guide to the repository root.
3. Add this `BUILD_GUIDE.md` file to the repository root.
4. Ask Antigravity to inspect the repository before making changes.
5. Give it only one stage prompt at a time.
6. Read its plan and proposed file changes before approving substantial work.
7. Perform manual setup and terminal commands yourself.
8. Review the code and test outputs. Do not accept “tests pass” without command output.
9. Fix defects before advancing.
10. Commit the completed stage and start the next stage from a clean working tree.

### Standard instruction to prepend to each stage prompt

```text
Follow the root AGENTS.md and the current stage in BUILD_GUIDE.md.
First inspect the repository and the relevant files. Preserve existing
working code. Implement only this stage; do not start later stages or add
unrelated features. Explain important technical decisions. Run the checks
specified in this stage and report the exact commands and results. Never
claim that a test passed unless you actually ran it. If an important
requirement is ambiguous, document the assumption and ask for team approval
before making a consequential design choice.
```

---

# 5. Windows setup checklist

Do these tasks once, before the coding stages. The commands below are for Windows PowerShell.

## 5.1 Install/check Git

Install Git for Windows if needed. Open a new PowerShell window and run:

```powershell
git --version
```

If Git is not recognized, reopen the terminal after installation and check the PATH.

## 5.2 Install/check Node.js

Install a current Node.js LTS version supported by the selected Next.js release. Open a new PowerShell window:

```powershell
node --version
npm --version
```

Do not mix multiple Node installations unknowingly. If the versions do not match the project requirement, resolve that before installing frontend dependencies.

## 5.3 Install/check Python

Install Python 3.12 or another version supported by the project's dependency choices. Then run:

```powershell
py --version
python --version
```

If `python` is not found but `py` works, use `py -3.12` to create the virtual environment.

## 5.4 Choose a PostgreSQL setup

Choose one approach:

**Option A — Docker Desktop:** install and start Docker Desktop, then verify:

```powershell
docker --version
docker compose version
```

**Option B — Local PostgreSQL installer:** install PostgreSQL and pgAdmin. Verify that the PostgreSQL service is running and that `psql` or pgAdmin can connect.

Do not install both approaches unless you intentionally need both. Do not use a hosted BaaS database.

## 5.5 Optional API client

Install Postman or use the automatically generated FastAPI `/docs` page. An API client is useful for testing backend permissions before the UI is complete, but it is not mandatory.

## 5.6 Optional editor tools

Use Antigravity as the coding agent. A database viewer such as pgAdmin or DBeaver is useful for inspecting tables and records. These tools inspect the local PostgreSQL database; they do not replace the database itself.

---

# 6. Progressive implementation stages

**Rule:** Each stage has a manual section, a prompt, and a test gate. Proceed only when all required boxes are checked. If a gate fails, remain in that stage and fix the cause.

## Stage 0 — Repository audit and scope agreement

### Goal
Know what already exists and agree on architecture before touching files.

### Manual steps

1. Open PowerShell in the `makeaton-initial` repository root.
2. Run:

```powershell
git status
git branch --show-current
git log -5 --oneline
Get-ChildItem -Force
```

3. Note any existing `frontend`, `backend`, `package.json`, Python files, README, tests, and environment files.
4. Do not delete files or reset the branch to make the repository appear clean.
5. Create a shared document or notes for unresolved business decisions.

### Antigravity prompt

```text
We are building the Brightloop Subscription Management System in the
existing makeaton-initial repository.

This is an inspection and planning task only. Do not create, modify, delete,
or install anything yet.

Inspect the repository structure, Git status, branch, README, dependency
manifests, frontend/backend source, tests, and environment configuration.

Report:
1. What already exists and what works.
2. Which files and conventions must be preserved.
3. Whether frontend/backend foundations already exist.
4. A proposed architecture using Next.js + TypeScript, FastAPI and
   PostgreSQL, with SQLAlchemy and Alembic.
5. A proposed modular folder structure adapted to the actual repository.
6. Main system modules and their dependencies.
7. Technical risks and business-rule ambiguities.
8. A staged plan with a test gate for each stage.

Do not assume the repository is empty. Do not claim to have run commands
unless you actually ran them. Do not implement features in this stage.
```

### Test gate
- [ ] The team has reviewed the repository assessment.
- [ ] Existing working work is identified and protected.
- [ ] The proposed stack and project boundaries are agreed.
- [ ] No unexpected files changed.

**Commit:** none required if this was inspection only.

---

## Stage 1 — Local tools and project skeleton

### Goal
Prove that frontend and backend can start locally before adding features.

### Manual steps

1. Complete the Windows setup checklist above.
2. In the repository root, create a branch:

```powershell
git switch main
git pull origin main
git switch -c chore/project-foundation
```

3. If the repository does not use `main`, substitute its actual default branch.
4. Decide whether PostgreSQL will run through Docker Desktop or a local installation.
5. Create local `.env` files only when needed. Ensure `.env` is ignored by Git.

### Antigravity prompt

```text
Implement Stage 1 only: establish the project foundation in the existing
makeaton-initial repository.

Requirements:
- Preserve useful existing files and conventions.
- Set up a Next.js App Router + TypeScript frontend if one does not exist.
- Set up a FastAPI backend if one does not exist.
- Add a minimal frontend page and a backend health endpoint.
- Add a root .gitignore covering node_modules, .next, Python virtual
  environments, __pycache__, build outputs, local .env files and caches.
- Add safe .env.example templates with placeholders only.
- Add a concise README with exact Windows PowerShell setup/start commands.
- Add Docker Compose for PostgreSQL only if Docker was selected.
- Do not add authentication, database models, dashboards, or business logic.
- Keep dependencies minimal and explain why each is needed.

The frontend must render a simple placeholder page. The backend must
return JSON from a health endpoint. Report files created and commands run.
```

### Manual steps after the prompt

1. Review `package.json`, backend dependency files, `.gitignore`, and README.
2. In the frontend folder:

```powershell
npm install
npm run dev
```

3. Open `http://localhost:3000`, confirm the page renders, then press `Ctrl+C`.
4. In the backend folder, create/activate the virtual environment if it was not created:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

5. Start FastAPI using the command in the README, commonly:

```powershell
uvicorn app.main:app --reload
```

6. Open the health endpoint and `/docs`. Use the route and entry point Antigravity actually created; do not assume they match the example if the structure differs.
7. If PowerShell blocks virtual-environment activation, use Command Prompt activation or the appropriate user-scoped execution-policy approach. Do not disable machine-wide security settings blindly.

### Test gate
- [ ] Frontend starts and renders.
- [ ] Backend starts and health endpoint returns the expected response.
- [ ] OpenAPI docs load.
- [ ] PostgreSQL starts if Docker/Compose was selected.
- [ ] `.env` is ignored and no secrets are committed.
- [ ] README commands work on at least one teammate's machine.

**Commit:** `chore: establish frontend and backend foundation`

---

## Stage 2 — Database design and ER diagram (design review only)

### Goal
Agree on data relationships before writing models or APIs. Database design is a major evaluation focus.

### Manual steps

1. Gather the team around the challenge requirements.
2. Open a shared diagramming tool or use Mermaid in Markdown.
3. Discuss the entity relationships and financial history rules.
4. Resolve the listed questions before asking Antigravity to create migrations.

### Antigravity prompt

```text
Implement Stage 2 as a database design exercise only. Do not create ORM
models, migrations, or feature APIs until the team approves the design.

Design a normalized PostgreSQL schema for Brightloop. Evaluate entities
for:
- users and role assignments
- customers and customer-user ownership
- products and product variants
- plans and optional plan-included product lines
- quotation templates and template lines
- quotations and quotation lines
- subscriptions and subscription lines
- subscription pause/resume history if needed
- tax rules and product/tax applicability
- discount rules, applicable products and discount applications
- invoices and invoice lines
- payments
- password reset/session records as appropriate
- audit logs
- company settings

Do not create tables mechanically just because they appear in this list.
Explain whether each table is needed and why.

Deliver:
1. docs/database-design.md with the purpose of each entity.
2. A Mermaid ER diagram.
3. Relationship/cardinality explanations.
4. Candidate primary keys, foreign keys, unique constraints, check
   constraints, deletion policies and indexes.
5. A customer data ownership strategy.
6. A financial snapshot strategy for quotations, subscriptions and invoices.
7. A duplicate invoice prevention strategy using subscription and billing
   period identity.
8. A payment allocation/balance strategy supporting multiple payments
   per invoice.
9. A clear timezone and billing-date strategy.
10. An ambiguity list requiring team decisions.

Use NUMERIC/DECIMAL for money. Do not use floating point. Explain the
reason for each important constraint. Do not silently invent business rules.
```

### Questions the team must decide

- Can a customer organization have more than one login? If not, a single `customers.user_id` may be enough. If yes, use a customer-user membership table.
- Are plan prices separate from product line prices? The brief describes a plan price and subscription product lines; the schema should represent them clearly and avoid double charging.
- Are taxes applied per product line, per plan fee, or both?
- Does a paused subscription extend its expiry date? How is the next billing date adjusted?
- What should happen if a monthly subscription starts on the 29th, 30th, or 31st?
- What are the due-date/payment terms defaults?
- Can a customer have multiple concurrent subscriptions?
- Is overpayment rejected or treated as account credit? Recommended initial rule: reject overpayment.

### Test gate
- [ ] ER diagram reviewed by all team members.
- [ ] Every relationship is understood.
- [ ] Financial snapshots are designed.
- [ ] Duplicate billing prevention is designed at database level.
- [ ] Ambiguous rules are recorded and approved.

**Commit:** `docs: add reviewed database design`.

---

## Stage 3 — PostgreSQL setup, SQLAlchemy models, and Alembic migrations

### Goal
Implement the approved schema and prove that a clean database can be migrated.

### Manual steps

1. Start PostgreSQL using Docker Compose or the local PostgreSQL service.
2. Open pgAdmin or `psql` and connect as a database administrator.
3. Create a dedicated application database user and database. Example SQL (change the password locally):

```sql
CREATE ROLE brightloop_app LOGIN PASSWORD 'use-a-local-secret-here';
CREATE DATABASE brightloop_dev OWNER brightloop_app;
```

4. Put the connection string in the backend `.env`, not in source code. Example format:

```text
DATABASE_URL=postgresql+psycopg://brightloop_app:LOCAL_PASSWORD@localhost:5432/brightloop_dev
```

5. Confirm `.env` is ignored by Git. Do not paste real credentials into Antigravity prompts or commit history.

### Antigravity prompt

```text
Implement Stage 3 using the database design approved in
 docs/database-design.md.

1. Create SQLAlchemy 2.x models and relationships.
2. Configure the database engine and session dependency.
3. Configure Alembic to import all model metadata correctly.
4. Create the initial migration.
5. Implement approved primary keys, foreign keys, indexes, unique
   constraints, check constraints and deletion policies.
6. Use NUMERIC/DECIMAL for monetary values.
7. Use UUIDs where the design specifies them.
8. Store timestamps consistently and document timezone behavior.
9. Preserve financial history; do not cascade-delete invoices/payments.
10. Add a database connectivity check.
11. Do not add business APIs yet.
12. Do not change the approved ERD without documenting the reason and
    asking for team approval.

Provide the commands for migration, rollback in development, and verifying
current migration revision. Include tests that confirm the database can
connect and core constraints are present.
```

### Manual verification

From `backend` with the virtual environment activated:

```powershell
alembic upgrade head
alembic current
alembic history
```

Use pgAdmin or `psql` to inspect tables, columns, constraints, foreign keys, and indexes. If a migration fails, inspect the first meaningful database error and fix it; do not delete migration files or drop the database as a first response.

### Test gate
- [ ] Migration applies to a fresh database.
- [ ] `alembic current` shows the expected revision.
- [ ] Tables and constraints match the ERD.
- [ ] App connects using the dedicated app account, not a superuser.
- [ ] A second empty database can be created from migrations.

**Commit:** `feat: add PostgreSQL models and initial migrations`

---

## Stage 4 — Backend foundation and API conventions

### Goal
Create maintainable backend modules before business logic grows.

### Antigravity prompt

```text
Implement Stage 4: FastAPI backend foundation only.

Set up clear modules for core configuration, database sessions, API v1
routers, dependencies, schemas, services, utilities and exception handling.

Requirements:
- Keep route handlers thin.
- Keep business logic in service modules.
- Do not return SQLAlchemy model objects directly as public API responses.
- Use Pydantic request/response schemas.
- Add consistent validation/error response handling.
- Add pagination conventions for collection endpoints.
- Configure CORS only for the known local frontend origin(s).
- Load settings from environment variables.
- Add health and readiness checks.
- Do not log credentials, tokens or unnecessary personal information.
- Add tests for health, database readiness, validation and exception
  response behavior.
- Do not implement auth or domain features yet.

Update README with startup, test and migration commands.
```

### Manual steps

```powershell
# From backend, with virtual environment active
pytest -q
uvicorn app.main:app --reload
```

Open `/docs` and try the health/readiness endpoints. Submit one malformed request to a test endpoint if available and inspect the structured error response.

### Test gate
- [ ] API starts.
- [ ] OpenAPI documentation loads.
- [ ] Health/readiness endpoints work.
- [ ] Tests pass.
- [ ] Routes, schemas, services, and models are separated.

**Commit:** `feat: establish modular FastAPI foundation`

---

## Stage 5 — Authentication, registration, and role authorization

### Goal
Implement secure account lifecycle and prove role/ownership restrictions at the API layer.

### Manual steps

1. Agree the exact role names: `ADMIN`, `STAFF`, and `CUSTOMER`.
2. Decide how the first admin is provisioned. Recommended: a controlled one-time CLI/bootstrap command using environment-provided credentials, not a public admin registration page.
3. Decide local email testing. Mailpit is useful for reset links; if not installed yet, configure a development mail adapter that logs a safe reset URL locally without logging the secret token in production.

### Antigravity prompt

```text
Implement Stage 5: authentication and authorization.

Requirements:
1. Customer self-registration creates both the user account and its
   customer record in one database transaction.
2. Normalize email and enforce uniqueness at database level.
3. Password must be MORE THAN 8 characters and contain at least one
   uppercase, one lowercase and one special character, matching the brief.
4. Hash passwords using Argon2id.
5. Implement login/logout and server-side session/token invalidation.
6. Use secure HTTP-only cookies if using cookie-based sessions. Document
   the CSRF protection strategy for state-changing requests.
7. Implement forgot-password/reset-password with cryptographically
   random, one-time, expiring tokens. Persist only a token hash.
8. Only an admin can provision staff accounts.
9. Add reusable backend dependencies/policies for current user, role
   requirements and record ownership.
10. Do not trust role, user ID, customer ID, invoice amount or status
    supplied by the browser.
11. Return clear validation and authentication messages.
12. Add rate limiting or a documented local-appropriate protection for
    sensitive authentication endpoints.
13. Add security audit events without logging secrets.
14. Test duplicate registration, invalid email/password, login failure,
    logout, reset expiry/reuse, staff creation restriction, role checks,
    and cross-customer access denial.

Do not build dashboards in this stage. Prove security through API tests.
```

### Manual verification

- Register a customer with a valid password.
- Try the same email again and confirm a clear duplicate message.
- Test a password with no uppercase, no lowercase, no special character, and too few characters.
- Log in with valid and invalid credentials.
- Log out and retry a protected API request.
- Verify staff cannot create staff.
- Verify customer cannot access admin API.
- Verify Customer A cannot retrieve Customer B's records.
- If Mailpit is configured, request a reset and inspect the local inbox. Try using the reset token twice.

### Test gate
- [ ] Auth tests pass.
- [ ] Role authorization is enforced in backend code.
- [ ] Resource ownership checks are enforced in backend code.
- [ ] Passwords and reset tokens are not stored in plain text.
- [ ] Reset token expires and is one-time use.
- [ ] First admin provisioning is not publicly exposed.

**Commit:** `feat: implement authentication and role authorization`

---

## Stage 6 — Customer management

### Goal
Build customer records and staff/admin operational workflows.

### Antigravity prompt

```text
Implement Stage 6: customer management.

Backend:
- Create/list/search/filter customer records.
- Retrieve and update customer details within role permissions.
- Provide paginated collections.
- Expose authorized customer-related subscription/invoice/payment views
  when those modules exist; do not create fake data for unfinished modules.

Frontend:
- Customer list page for admin/staff.
- Customer detail page.
- Create/edit forms where allowed.
- Loading, empty, error and success states.

Enforce role permissions and ownership on every API. Validate required
fields, normalized email, and relevant contact data. Do not fetch all
customers at once. Connect to PostgreSQL through FastAPI; no mock arrays.
Add API tests and a browser test for creating/searching a customer.
```

### Manual verification

1. Create a customer as admin.
2. Search for the customer as staff.
3. Edit an allowed field.
4. Submit invalid email and missing required fields.
5. Log in as a customer and test access to another customer's record.
6. Refresh the browser and confirm changes remain persisted.

### Test gate
- [ ] Authorized customer operations work.
- [ ] Pagination/search are database-backed.
- [ ] Validation errors are understandable.
- [ ] Cross-customer access is blocked.
- [ ] Tests pass.

**Commit:** `feat: add customer management`

---

## Stage 7 — Products, variants, plans, and tax configuration

### Goal
Allow admin to configure the catalog and recurring plans.

### Antigravity prompt

```text
Implement Stage 7: product, variant, subscription plan and tax
configuration.

Product fields include name, type, sales price, cost price, notes and
active/archive state. Product variants have a name and price adjustment.
Example: a variant can add 560 to a product's base price.

Plans support daily, weekly, monthly and yearly billing, price, minimum
quantity, availability start/end dates, auto-close, pause, early closure
and renewal settings.

Tax rules include name, rate, type, active state and any approved
validity/applicability rules.

Requirements:
- Admin-only create/update/archive actions.
- Backend validation of positive monetary values and quantities, valid
  tax rates and date ranges.
- Decimal/Numeric calculations, never float for currency.
- Store price/tax snapshots when later business records are created.
- Do not retroactively modify historical invoices when catalog data
  changes.
- Staff may read only catalog information needed for operations.
- Add API tests, database tests and admin UI forms/tables.
- All UI data must come from APIs and PostgreSQL.
```

### Manual verification

- Create a product with a base sales price.
- Add a variant with a 560 price adjustment and verify final price calculation.
- Create one plan for each billing interval.
- Try invalid price, quantity, tax rate, and availability dates.
- Log in as staff and attempt to edit catalog and tax configuration.
- Change a catalog price after a test subscription/invoice snapshot exists and verify that historical records do not change.

### Test gate
- [ ] Admin configuration operations work.
- [ ] Staff cannot modify protected configuration.
- [ ] Variant price calculation is correct.
- [ ] Date/amount validation works.
- [ ] Historical snapshots remain unchanged.
- [ ] Tests pass.

**Commit:** `feat: add catalog plans variants and taxes`

---

## Stage 8 — Discount rules

### Goal
Implement fixed and percentage discounts with conditions and usage limits.

### Antigravity prompt

```text
Implement Stage 8: discount rule management.

Only admins can create/update/activate/deactivate discounts.
Support fixed amount and percentage discounts, minimum purchase amount,
minimum quantity, product-specific or whole-subscription scope, validity
start/end dates and maximum usage count.

Requirements:
- Validate percentage bounds and positive fixed amount.
- Validate date windows and usage limits.
- Build a backend eligibility/calculation service.
- Reject inactive, expired, not-yet-valid or exhausted rules.
- Never discount more than the eligible amount.
- Persist each application/redemption.
- Update usage safely inside the same transaction as invoice generation.
- A failed/rolled-back invoice must not consume a successful redemption.
- Preserve applied discount values/details in invoice snapshots.
- Add tests for every eligibility boundary and concurrent use where
  feasible with PostgreSQL integration tests.
- Add admin UI connected to real APIs.
```

### Manual verification

Create a 15% rule with minimum quantity 10 and a finite usage cap. Test quantities 9 and 10, date before start, date after expiry, and exhausted usage. Confirm that the invoice stores the discount snapshot even if the rule is later edited.

### Test gate
- [ ] Eligibility is calculated on the backend.
- [ ] Usage limits cannot be exceeded by concurrent processing.
- [ ] Applied discounts are preserved in history.
- [ ] Tests pass.

**Commit:** `feat: implement discount rules`

---

## Stage 9 — Quotation templates and quotations

### Goal
Let staff prepare quotations from reusable templates.

### Antigravity prompt

```text
Implement Stage 9: quotation templates and quotations.

Admin can create/edit/deactivate templates containing a name, description,
default plan, product lines, quantities and validity duration in days.

Staff can select a customer and template, load its predefined lines,
make permitted adjustments, review prices/taxes/discounts, and create a
quotation.

Requirements:
- Store quotations and lines in PostgreSQL.
- Generate unique quotation numbers.
- Calculate expiry from quotation date and validity duration.
- Preserve quoted product/variant/plan names, quantities, prices and
  tax details as snapshots.
- Enforce role permissions.
- Prevent confirmation after expiry unless an explicit extension rule
  is implemented and approved.
- Add list/detail views with search, filters and pagination.
- Add tests for template CRUD, quotation creation, calculations, expiry
  and confirmation.
```

### Manual verification

1. Admin creates a template.
2. Staff selects the template for a customer.
3. Confirm its line items and totals load correctly.
4. Save and view the quotation.
5. Confirm a valid quotation.
6. Try to confirm an expired quotation.
7. Verify a customer cannot access another customer's quotation.

### Test gate
- [ ] Template operations work.
- [ ] Staff can create a quotation from a template.
- [ ] Expiry and status rules work.
- [ ] Quotation snapshots are preserved.
- [ ] Tests pass.

**Commit:** `feat: add quotation templates and quotations`

---

## Stage 10 — Subscription lifecycle

### Goal
Create subscriptions and enforce their state transitions.

### Antigravity prompt

```text
Implement Stage 10: subscription management and lifecycle.

A subscription must store a unique number, customer, plan, start/expiry
dates, payment terms, next billing date, subscription lines, monetary
summary, status, creator and timestamps.

Statuses: DRAFT, QUOTATION, CONFIRMED, ACTIVE, PAUSED, CLOSED.

Requirements:
- Create a subscription from an eligible confirmed quotation.
- Implement an explicit state-transition table in code and documentation.
- Reject invalid transitions with a clear business-rule error.
- Validate plan availability, minimum quantities and dates.
- Preserve agreed product, variant, plan and price snapshots.
- Allow pause/resume only when configured by the plan.
- Record pause/resume history.
- Implement the team-approved rule for pause impact on expiry and next
  billing date.
- Support renewal/early closure according to plan configuration.
- Closed and paused subscriptions must not be billed.
- Enforce role and ownership rules in backend services.
- Add tests for each allowed/disallowed transition and date boundary.
```

### Manual verification

- Convert a valid quotation into a subscription.
- Exercise allowed transitions.
- Attempt invalid transitions.
- Pause/resume a plan that allows it.
- Attempt pause on a plan that disallows it.
- Close a subscription and verify it cannot be billed.
- Change a catalog price and verify the subscription's agreed price remains unchanged.

### Test gate
- [ ] State transitions are explicit and tested.
- [ ] Snapshots are preserved.
- [ ] Pause/resume rules are documented and consistent.
- [ ] Closed/paused subscriptions are excluded from billing.
- [ ] Tests pass.

**Commit:** `feat: implement subscription lifecycle`

---

## Stage 11 — Invoice generation and recurring billing

### Goal
Build reliable, repeatable invoice generation. This is a core evaluation feature.

### Antigravity prompt

```text
Implement Stage 11: invoice generation and billing service.

Build one reusable backend billing service. It must:
1. Find subscriptions eligible on a supplied billing date.
2. Exclude paused, closed, expired or otherwise ineligible subscriptions
   according to approved rules.
3. Calculate daily, weekly, monthly and yearly billing periods correctly.
4. Use agreed subscription snapshots, not current catalog prices.
5. Calculate line totals, taxes and valid discounts using Decimal.
6. Create invoice and invoice-line snapshots.
7. Store invoice date, due date and billing period.
8. Advance next billing date only if invoice creation succeeds.
9. Run each subscription's invoice creation in a safe transaction.
10. Make processing idempotent. A repeat run must not create a duplicate
    invoice for the same subscription and billing period.
11. Add a database unique constraint for subscription + billing period.
12. Use safe concurrency control (for example row locking) where needed.
13. Process records in batches and record per-subscription failures.
14. Make failures visible; never silently skip eligible subscriptions.
15. Implement Draft, Confirmed, Partially Paid, Paid and Cancelled states.
16. Derive overdue status from due date and positive remaining balance.
17. Provide one manual/admin trigger that calls this exact same service.

Test daily, weekly, monthly, yearly, repeated runs, concurrent attempts,
month-end dates (including 29th/30th/31st), leap years, pauses, closures,
expiry, taxes, discounts and transaction rollback. Document the billing
timezone and month-end policy. Do not create a second billing algorithm
for the frontend.
```

### Manual verification

1. Create a test subscription whose next billing date is today.
2. Run the billing command or admin trigger.
3. Inspect the invoice and invoice lines in PostgreSQL.
4. Run the billing command again for the same date.
5. Confirm there is still one invoice for that subscription/period.
6. Confirm next billing date advanced only once.
7. Test paused, closed and expired subscriptions.
8. Test a monthly subscription anchored on the 31st.
9. Inspect tax/discount/price snapshots.
10. Verify a failed transaction does not partially advance billing state.

### Test gate
- [ ] Billing is idempotent.
- [ ] PostgreSQL prevents duplicate subscription-period invoices.
- [ ] All four intervals work.
- [ ] Month-end/leap-year behavior is documented and tested.
- [ ] Tax/discount/price snapshots are correct.
- [ ] Failures are observable and retry-safe.
- [ ] Tests pass.

**Commit:** `feat: implement recurring invoice generation`

---

## Stage 12 — Payment recording and settlement

### Goal
Support full and partial payments against invoices.

### Antigravity prompt

```text
Implement Stage 12: payment recording and invoice settlement.

A payment records invoice, amount, method, date, reference, note,
recorded_by and created timestamp. Support cash, bank transfer, UPI,
card, cheque and other.

Requirements:
- One invoice can have multiple payment records.
- Amount must be positive and use Decimal/Numeric.
- Reject payments against cancelled invoices.
- Initial policy: reject overpayment; do not silently create credit.
- Record payments and update/derive balances transactionally.
- Set invoice to Partially Paid or Paid consistently.
- Customers can view their payment history but cannot create or alter
  payment records.
- Only authorized admin/staff can record payments.
- Add audit information for the actor.
- Test full payment, partial payment, multiple payments, overpayment,
  cancelled invoice, unauthorized use and concurrent payments.
```

### Manual verification

Use a ₹10,000 invoice. Record ₹4,000 and confirm ₹6,000 remains. Record ₹6,000 and confirm the invoice becomes Paid with zero outstanding. Try a further payment and confirm rejection. Try the same operation as a customer and confirm denial.

### Test gate
- [ ] Full and partial payments work.
- [ ] Balances match payment records.
- [ ] Overpayment and cancelled-invoice payment are rejected.
- [ ] Customer payment edits are blocked.
- [ ] Tests pass.

**Commit:** `feat: add payment recording and settlement`

---

## Stage 13 — Role-specific frontend workflows

### Goal
Connect the application screens to real APIs and make each role's work intuitive.

### Antigravity prompt

```text
Implement Stage 13: complete role-specific frontend workflows using the
existing FastAPI contracts. Do not invent mock API responses.

Shared UX:
- consistent sidebar/top navigation and page layout
- responsive design and accessible form labels
- loading, empty, validation, success and server-error states
- reusable tables, forms, status indicators, dialogs and pagination
- search/filter/sort where relevant

Admin workflows: dashboard, staff/users, customers, products/variants,
plans, taxes, discounts, quotation templates, subscriptions, invoices,
payments, reports, settings/audit pages where implemented.

Staff workflows: dashboard, customers, quotations, subscriptions,
invoices and payments.

Customer portal: dashboard, profile, own subscriptions, own invoices,
and own payment history.

Requirements:
- Connect every data-driven page to the backend API.
- Use a centralized API client and consistent error handling.
- Use TanStack Query for server state and React Hook Form/Zod for forms.
- Do not use static arrays as final data.
- Role-aware navigation is for usability only; backend authorization
  remains mandatory.
- Prevent direct unauthorized page access where practical and always
  handle backend 401/403 responses.
- No dead buttons, fake charts or placeholder links.
- Add Playwright tests for the critical role workflows.
```

### Manual verification

- Use separate browser sessions for admin, staff and customer.
- Check visible navigation and direct URL access.
- Create/edit records in the UI and refresh to verify database persistence.
- Test invalid form submissions.
- Test loading, empty and server error states.
- Inspect desktop and mobile widths.

### Test gate
- [ ] Admin/staff/customer workflows are present.
- [ ] UI reads and writes real backend data.
- [ ] Direct API access remains protected.
- [ ] Forms show clear validation messages.
- [ ] No dead controls or static final data remain.
- [ ] Main pages are responsive.
- [ ] Browser tests pass.

**Commit:** `feat: build role-specific frontend workflows`

---

## Stage 14 — Dashboards and reporting

### Goal
Present useful metrics that reconcile with actual database records.

### Antigravity prompt

```text
Implement Stage 14: dashboards and reporting.

Admin metrics:
- customers, active subscriptions and total subscriptions
- payments received in the selected date range
- outstanding invoice balance
- overdue invoice count
- monthly revenue trend and subscription growth
- payment status distribution
- upcoming renewals and recent operational activity

Staff dashboard:
- customers/subscriptions needing attention
- quotations awaiting action
- invoices needing action
- overdue invoices and upcoming renewals
- recent recorded payments

Customer dashboard:
- own active subscriptions
- next billing date
- own outstanding amount
- own recent invoices and payments

Define metrics explicitly. Revenue received means payments recorded in
the selected range. Outstanding means invoice amount less recorded
payments. Overdue means due date has passed and a positive balance remains.

Requirements:
- Use database aggregation queries, not full-table downloads.
- Apply date filters consistently.
- Apply customer ownership restrictions to every customer metric.
- Use pagination for detail tables.
- Add indexes based on actual filters/queries.
- Test metrics with known records and expected totals.
```

### Manual verification

Create a small set of invoices and payments with known dates and values. Calculate expected metrics by hand and compare them with dashboard values for today, this month, and a custom range. Verify the customer portal reports only that customer's records.

### Test gate
- [ ] Definitions are documented.
- [ ] All metrics match the underlying records.
- [ ] Date filters work.
- [ ] Customer metrics are isolated.
- [ ] Queries do not load entire tables.
- [ ] Tests pass.

**Commit:** `feat: add database-driven dashboards and reports`

---

## Stage 15 — Invoice documents, email, and audit trail

### Goal
Finish practical operational details with minimal third-party dependence.

### Antigravity prompt

```text
Implement Stage 15: printable invoice documents, configurable email and
audit logging.

Requirements:
- Generate a printable/downloadable invoice from persisted invoice data.
- Ensure printed values exactly match invoice snapshots in the database.
- Support configurable SMTP for password-reset and invoice emails.
- Support local Mailpit testing; do not require a third-party email API.
- Handle email failure without rolling back or corrupting invoice/payment
  records. Show an understandable failure/retry state.
- Record important audit events: staff account creation/deactivation,
  product/plan/tax/discount changes, quotation confirmation, subscription
  transitions, invoice confirmation/cancellation and payment recording.
- Audit records include actor, action, target, timestamp and safe context.
- Never log passwords, reset tokens, session secrets or unnecessary
  sensitive information.
- Add tests for document correctness, audit events and mail failure.
```

### Manual verification

1. Download/print an invoice and compare it to the database/UI.
2. Start Mailpit and send a test email.
3. Inspect the email in Mailpit's local inbox.
4. Stop Mailpit and verify the failure is visible and does not corrupt data.
5. Perform a payment and subscription transition; inspect audit events.

### Test gate
- [ ] Document reflects stored financial values.
- [ ] Email success/failure is handled.
- [ ] Audit events exist for important actions.
- [ ] Logs do not expose secrets.

**Commit:** `feat: add invoice documents and audit trail`

---

## Stage 16 — Scheduled billing execution

### Goal
Run the already tested billing service automatically.

### Important design rule
Do not create a second billing implementation. A scheduler must invoke the same tested billing service. For the initial local/demo system, a command run by Windows Task Scheduler is acceptable and avoids introducing Redis/Celery solely for the hackathon.

### Antigravity prompt

```text
Implement Stage 16: scheduled invocation of the existing billing service.

Inspect the billing service and its idempotency tests first.

Provide a documented command that accepts or derives the billing date and
calls the existing billing service. Add safe scheduling configuration and
structured run logs. Ensure duplicate protection remains enforced by the
PostgreSQL constraint and transaction-safe service.

Do not duplicate invoice calculation logic. Do not add Redis/Celery unless
there is a demonstrated requirement and the team approves it. Make the
manual admin trigger call the same service. Document timezone behavior,
start/stop, failure visibility and retry behavior. Add tests for repeated
invocation and failure recovery.
```

### Manual setup — Windows Task Scheduler

Do this only after the command works manually:

1. Open **Task Scheduler** from the Windows Start menu.
2. Select **Create Task** (not Basic Task if more control is needed).
3. Give it a clear name such as `Brightloop Daily Billing - Development`.
4. Add a daily trigger at a time when the development machine is expected to be on.
5. Set the action to start a program. Use the exact Python executable from the backend virtual environment and the exact billing command/script path supplied by the project.
6. Set **Start in** to the backend directory if the command uses relative paths.
7. Save the task. Right-click it and choose **Run** for a manual test.
8. Inspect application logs and PostgreSQL invoices.
9. Run it again and verify no duplicate invoice is created.

Do not configure an automated billing task against real customer data during development. Use seeded demo data only.

### Test gate
- [ ] Command works manually.
- [ ] Scheduler invokes the same service.
- [ ] Repeated execution is safe.
- [ ] Failures are visible and recoverable.
- [ ] Timezone and schedule are documented.

**Commit:** `feat: schedule recurring billing execution`

---

## Stage 17 — Integration, security, performance, and acceptance review

### Goal
Review the complete system against the evaluator's criteria and fix defects before the demonstration.

### Antigravity prompt

```text
Implement Stage 17: quality, security and acceptance review.

Do not add unrelated features. First inspect the entire repository and
existing tests. Prepare a findings list, then fix issues in priority order.

Review:
- coding standards, naming and modularity
- database normalization, relationships, constraints, indexes and
  migration reproducibility
- API design, validation and error handling
- authentication, role authorization and customer ownership isolation
- quotation/subscription state transitions
- tax/discount calculations and financial snapshots
- invoice idempotency, concurrency and retry safety
- payment balances and overpayment behavior
- database-backed reports and date filters
- frontend usability, consistency, responsive layout and accessibility
- environment/secrets handling, logging and audit trail
- pagination, N+1 queries, aggregation performance and query plans
- README, setup reproducibility and Git hygiene

Run backend unit tests, PostgreSQL integration tests, frontend checks,
Playwright critical journeys, and migrations against an empty database.
Report exact commands and failures. Do not claim a performance target is
met without measuring it under a documented test dataset and environment.
```

### Manual verification

- Run the full test suite from the README.
- Ask a teammate to clone the repository fresh and follow setup instructions.
- Use seeded data to test all three roles.
- Inspect database indexes and query plans for dashboard/list endpoints.
- Use browser developer tools to inspect failed requests and console errors.
- Run a basic load test only if the team has time and can describe its limits.
- Confirm no secrets or database dumps are tracked by Git.

### Test gate
- [ ] Fresh setup succeeds from README.
- [ ] Migrations work on an empty database.
- [ ] Backend, frontend and browser tests pass.
- [ ] Role isolation and billing/payment edge cases pass.
- [ ] Performance claims have evidence, not guesses.
- [ ] Team can explain important implementation decisions.

**Commit:** `test: complete integration and acceptance review`

---

## Stage 18 — Demo data, final walkthrough, and team presentation

### Goal
Demonstrate an end-to-end business journey using persisted database records.

### Antigravity prompt

```text
Implement Stage 18: repeatable development/demo seed data and final
project documentation.

Create a safe seed command that inserts representative demo records into
PostgreSQL without duplicating data each time it runs. Include:
- one development admin
- two staff users
- several customers
- products and variants
- daily, weekly, monthly and yearly plans
- tax and discount examples
- quotation templates and quotations
- subscriptions in different lifecycle states
- draft/confirmed/partially paid/paid/overdue invoices where their
  underlying dates and payment records make those states valid
- payment history

Use environment/configuration for demo credentials and clearly warn that
they are development-only. Never add a production authentication bypass.

Update README with setup, migrations, seed instructions, test commands,
architecture summary, API docs location, demo role instructions and known
limitations. Do not claim functionality that is not implemented.
```

### Manual walkthrough

1. Start PostgreSQL, backend, and frontend.
2. Apply migrations and run the demo seed command.
3. Log in as admin and create a product, plan, or discount.
4. Log in as staff and create a quotation for a customer.
5. Confirm the quotation and create/activate a subscription.
6. Trigger due invoice generation using the tested billing service.
7. Record a partial payment, then the remaining payment.
8. Log in as the customer and view their subscription, invoice and payment history.
9. Log in as admin and verify dashboard metrics update.
10. Re-run the billing command and show that no duplicate invoice is created.

### Test gate
- [ ] Demo seed command is repeatable.
- [ ] The walkthrough uses real PostgreSQL records.
- [ ] All three roles are demonstrated.
- [ ] No manual database edits are needed during the demo.
- [ ] All team members can explain their contribution and the complete flow.

**Commit:** `docs: finalize demo setup and project walkthrough`

---

# 7. Cross-stage evaluator checklist

Use this as a review sheet throughout development, not only at the end.

## Database design — highest priority

- [ ] Normalized relational design with understandable relationships.
- [ ] Primary/foreign keys and safe deletion policies.
- [ ] Unique and check constraints for important invariants.
- [ ] Monetary values use `NUMERIC`/`DECIMAL`.
- [ ] Historical invoice/quotation/subscription snapshots are preserved.
- [ ] Duplicate invoice generation is prevented by the database.
- [ ] Indexes support actual list, filter and reporting queries.
- [ ] Migrations can build a new database from scratch.

## Backend/API quality

- [ ] REST APIs have consistent routes, schemas and status codes.
- [ ] Routes remain thin; business rules live in services.
- [ ] Input validation is performed server-side.
- [ ] Errors are clear and do not leak stack traces/secrets.
- [ ] Pagination, search, filters and sorting are appropriate.
- [ ] Transactions protect multi-record business operations.

## Security

- [ ] Password hashing and secure session handling.
- [ ] Role checks are performed in backend.
- [ ] Customer ownership checks are performed in backend.
- [ ] Staff cannot create staff or alter admin-only configuration.
- [ ] Secrets are environment-configured and not committed.
- [ ] Sensitive actions are auditable.

## Frontend and usability

- [ ] Consistent color, spacing, typography and navigation.
- [ ] Admin, staff and customer see role-appropriate experiences.
- [ ] Forms give useful field-level validation feedback.
- [ ] Loading, empty, success and failure states are handled.
- [ ] Tables support search/filter/pagination where needed.
- [ ] Main workflows are responsive and keyboard accessible.
- [ ] Every visible action works; no fake controls.

## Performance and scalability

- [ ] No unbounded table fetches.
- [ ] No obvious N+1 query patterns.
- [ ] Dashboard metrics aggregate in PostgreSQL.
- [ ] Important query paths have indexes.
- [ ] Billing processes records in batches and is retry-safe.
- [ ] Any under-two-second claim is measured and documented.

## Teamwork and engineering understanding

- [ ] Every member has contributed Git commits/PRs.
- [ ] PRs are reviewed by another member.
- [ ] Team members understand database relationships and API flow.
- [ ] Every member can explain their code and testing decisions.
- [ ] Presentation is shared among team members.

---

# 8. Final instructions for the team

1. Do not skip a stage because the UI looks ready.
2. Do not build dashboards using fake numbers while the backend is unfinished.
3. Do not accept generated code without reading and testing it.
4. Do not confuse a successful frontend click with a successful database operation; verify persistence.
5. Do not patch around failed migrations or billing errors without understanding the cause.
6. Keep business rules in backend services and reinforce important rules in PostgreSQL.
7. Keep the technology stack small enough that every team member can explain it.
8. Keep `README.md`, `BUILD_GUIDE.md`, `AGENTS.md`, ERD and API docs consistent with the actual implementation.
9. When a stage fails, fix it before continuing.
10. In the presentation, show the end-to-end journey and explain the data model, API boundaries, transaction/idempotency strategy, authorization and testing approach.

**The goal is a reliable subscription-management system, not a collection of screens.**
