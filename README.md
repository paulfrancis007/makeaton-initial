# Brightloop — Subscription Management System

Brightloop is an enterprise-grade, responsive Subscription Management System engineered for three distinct roles: **Admin**, **Staff**, and **Customer**.

It manages the complete recurring lifecycle:
> **Catalog Configuration → Quotation Templates & Quotations → Subscriptions → Recurring Billing & Invoicing → Payments & Settlement → Real-Time Analytics**

---

## Architecture Overview

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend:** Python FastAPI, Pydantic v2, Uvicorn, Pytest
- **Database:** PostgreSQL 16 (configured via Docker Compose)
- **Object Relational Mapper:** SQLAlchemy 2.0 & Alembic (introduced in Stage 3)

---

## Project Structure

```text
makeaton-initial/
├── frontend/                   # Next.js App Router application
│   ├── src/app/                # Page routes, layouts, and styles
│   ├── public/                 # Static assets
│   ├── package.json            # Node.js dependencies
│   ├── tsconfig.json           # TypeScript configuration
│   ├── tailwind.config.ts      # Tailwind CSS configuration
│   └── .env.example            # Frontend environment variables template
├── backend/                    # FastAPI application
│   ├── app/                    # Application source code
│   │   ├── core/               # Configuration settings (Pydantic Settings)
│   │   └── main.py             # FastAPI entry point, CORS, and health check
│   ├── tests/                  # Pytest test suite
│   ├── requirements.txt        # Python backend dependencies
│   └── .env.example            # Backend environment variables template
├── docker-compose.yml          # PostgreSQL 16 local database container
├── .gitignore                  # Git ignore rules
├── .env.example                # Root environment template
├── AGENTS.md                   # Persistent agent and development guidelines
├── BUILD_GUIDE.md              # 18-stage implementation blueprint
└── README.md                   # Setup and execution guide
```

---

## Local Development Setup (Windows PowerShell)

### Prerequisites
- **Node.js:** v20+ LTS (Tested on Node `v24.22.1`, npm `11.19.1`)
- **Python:** 3.12 or 3.13 (Tested on Python `3.13.5`)
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

To stop the database:
```powershell
docker compose down
```

---

### 2. Backend Setup & Startup (FastAPI)

1. Open PowerShell in the project root:
```powershell
cd C:\QuartusProjects\makeaton-initial\backend
```

2. Create the Python virtual environment using the existing Python installation:
```powershell
python -m venv .venv
```

3. Activate the virtual environment:
```powershell
.\.venv\Scripts\Activate.ps1
```
*(If PowerShell restricts script execution, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` in your current terminal session).*

4. Install backend dependencies:
```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

5. Run backend tests:
```powershell
$env:PYTHONPATH="."
python -m pytest tests -v
```

6. Start the FastAPI development server:
```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend is now accessible:
- **Root API:** [http://localhost:8000/](http://localhost:8000/)
- **Health Check Endpoint:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- **Interactive OpenAPI Documentation:** [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)

---

### 3. Frontend Setup & Startup (Next.js)

1. Open a new PowerShell window in the frontend directory:
```powershell
cd C:\QuartusProjects\makeaton-initial\frontend
```

2. Copy the environment template if needed:
```powershell
Copy-Item .env.example .env.local
```

3. Install frontend dependencies:
```powershell
npm install
```

4. Start the Next.js development server:
```powershell
npm run dev
```

The frontend will be running at:
- **Application Portal:** [http://localhost:3000](http://localhost:3000)

---

## Stage Verification Matrix

| Component | Target URL | Expected Output |
|---|---|---|
| **Frontend UI** | `http://localhost:3000` | Brightloop Stage 1 Foundation page with architecture status and role specifications |
| **Backend Health** | `http://localhost:8000/api/v1/health` | `{"status":"ok","service":"Brightloop API","version":"1.0.0","environment":"development"}` |
| **API Docs** | `http://localhost:8000/api/v1/docs` | Swagger UI displaying general and health endpoints |
| **PostgreSQL** | `127.0.0.1:5432` | PostgreSQL 16 ready for connections (`brightloop_dev` database, bound strictly to loopback) |
