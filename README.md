# Brightloop — Subscription Management System

Brightloop is an enterprise-grade, responsive Subscription Management System engineered for three distinct roles: **Admin**, **Staff**, and **Customer**.

It manages the complete recurring lifecycle:
> **Catalog Configuration → Quotation Templates & Quotations → Subscriptions → Recurring Billing & Invoicing → Payments & Settlement → Real-Time Analytics**

---

## Architecture Overview

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend:** Python FastAPI, Pydantic v2, Synchronous SQLAlchemy 2.x, Psycopg 3, Uvicorn, Pytest
- **Database:** PostgreSQL 16 (configured via Docker Compose) with `btree_gist` extension
- **Financial Ledger Invariant:** Pure `NUMERIC(12, 2)` currency amounts, Banker's Rounding (half-even), strict database check constraints (`chk_invoices_total_calc`), non-overlapping billing exclusion constraints (`excl_invoice_no_overlapping_periods`), row-level concurrency locking (`SELECT ... FOR UPDATE`), strict overpayment rejection, and atomic one-way payment voiding.

---

## Project Structure

```text
makeaton-initial/
├── frontend/                   # Next.js App Router application
│   ├── src/app/                # Page routes, layouts, and styles
│   │   ├── admin/              # Admin/Staff consoles (Dashboard, Invoices, Payments, etc.)
│   │   ├── portal/             # Customer self-service portal
│   │   └── login/              # Multi-role authentication & demo credentials
│   ├── src/components/         # Reusable UI components & Navbar
│   ├── src/lib/                # API client & Auth context
│   └── package.json            # Node.js dependencies
├── backend/                    # FastAPI application
│   ├── app/                    # Application source code
│   │   ├── api/v1/             # Versioned REST API endpoints
│   │   ├── core/               # Configuration settings (Pydantic Settings, Security)
│   │   ├── db/                 # Database engine & session management
│   │   ├── models/             # SQLAlchemy ORM entity models
│   │   ├── schemas/            # Pydantic validation schemas
│   │   └── services/           # Business logic, billing engine, PDF, & email
│   ├── scripts/                # Standalone CLI tools (seed_demo_data.py, run_billing.py)
│   ├── tests/                  # Pytest test suite (80 unit, integration, & security tests)
│   ├── requirements.txt        # Python backend dependencies
│   └── alembic/                # Database migrations
├── docker-compose.yml          # PostgreSQL 16 local database container
├── docs/                       # Comprehensive documentation
│   ├── database-design.md      # Authoritative database architecture
│   └── demo-walkthrough.md     # 16-step evaluator walkthrough
├── AGENTS.md                   # Persistent agent and development guidelines
├── BUILD_GUIDE.md              # 18-stage implementation blueprint
└── README.md                   # Setup and execution guide
```

---

## Local Development Setup (Windows PowerShell)

### Prerequisites
- **Node.js:** v20+ LTS
- **Python:** 3.12 or 3.13 (Virtual environment recommended)
- **Docker Desktop:** Docker engine with Docker Compose enabled

---

### 1. PostgreSQL Database Setup (Docker Compose)

Start the PostgreSQL 16 database container in the background:

```powershell
docker compose up -d
```

Verify the container is running and healthy:

```powershell
docker compose ps
```

---

### 2. Backend Setup & Startup (FastAPI)

1. Open PowerShell in the `backend/` directory:
```powershell
cd backend
```

2. Activate the virtual environment:
```powershell
.\.venv\Scripts\Activate.ps1
```

3. Run database migrations:
```powershell
.\.venv\Scripts\python -m alembic upgrade head
```

4. Seed rich demo data (idempotent):
```powershell
.\.venv\Scripts\python scripts/seed_demo_data.py
```

5. Run full automated test suite (80 tests against `brightloop_test`):
```powershell
.\.venv\Scripts\python -m pytest tests -v
```

6. Start the FastAPI development server:
```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend is now accessible:
- **Root API:** [http://localhost:8000/](http://localhost:8000/)
- **Health Check Endpoint:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- **Interactive OpenAPI Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 3. Frontend Setup & Startup (Next.js)

1. Open a new PowerShell window in the `frontend/` directory:
```powershell
cd frontend
```

2. Run Next.js production build verification:
```powershell
npm run build
```

3. Start the Next.js development server:
```powershell
npm run dev
```

The application is now running at:
- **Application Portal:** [http://localhost:3000](http://localhost:3000)
- **Login / Role Quick Switcher:** [http://localhost:3000/login](http://localhost:3000/login)

---

### 4. Scheduled Billing Runner (CLI / Task Scheduler)

Execute the idempotent recurring billing engine:

```powershell
cd backend
.\.venv\Scripts\python scripts/run_billing.py --batch-size 100
```

---

## Pre-Configured Demo Credentials

The login page (`/login`) includes quick-fill buttons for instant evaluation:

| Role | Email Address | Password | Intended Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@example.com` | `AdminPass123!` | Full control: catalog, plans, taxes, discounts, users, audit log, billing runs, voids. |
| **Operations Staff** | `staff1@example.com` | `StaffPass123!` | Operational workflows: quotations, subscriptions, invoices, payment recording. |
| **Customer (Acme)** | `customer.acme@example.com` | `CustomerPass123!` | Self-service portal: subscription status, invoice PDF downloads, payment receipts. |
| **Customer (Global Dynamics)** | `customer.global@example.com` | `CustomerPass123!` | Self-service portal: overdue receivables, past-due invoices, settlement history. |

See [docs/demo-walkthrough.md](docs/demo-walkthrough.md) for the complete 16-step evaluation walkthrough.
