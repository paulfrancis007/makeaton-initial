# AGENTS.md - Brightloop Subscription Management System

Persistent instructions for coding agents working in `makeaton-initial`.

## 1. Scope and sources

Build a responsive subscription management web application for ADMIN, STAFF and CUSTOMER.

- Product source: the supplied four-page Subscription Management System PDF.
- Evaluation source: the evaluator's welcome message supplied by the team. It emphasizes database design most strongly, backend APIs, local relational persistence, dynamic data, input validation, readable modular code, performance, security, usability, debugging, Git participation and shared understanding.
- Team stack: Next.js App Router, React, TypeScript, Tailwind CSS, FastAPI, Pydantic, PostgreSQL, SQLAlchemy 2.x, Alembic, Pytest and Playwright. React Hook Form/Zod support forms; TanStack Query may manage server state. Accessible shadcn/ui primitives and Lucide icons may be used.
- PostgreSQL is the final source of truth. Use one frontend, one backend and one database. Keep third-party APIs minimal and use local SMTP testing for email. BaaS platforms and novelty infrastructure are outside the agreed approach.

Before planning or implementing a phase, read [BUILD_GUIDE.md](BUILD_GUIDE.md) for sequencing, business defaults and acceptance gates. Before changing navigation, pages, forms, permissions or user actions, read [docs/USER_FLOWS.md](docs/USER_FLOWS.md) for the 32-page inventory and complete role journeys. These files replace the previous 19-stage guide; phase numbering is now 0-9.

The evaluator does not prescribe this exact stack or a complete ranked scoring rubric. The database emphasis and the other named evaluation criteria are confirmed; the chosen stack is a team decision.

## 2. Working process

1. Inspect the repository, current branch, changed files and relevant code before editing. Preserve working conventions and user changes.
2. Implement only the phase requested by the team. Planning tasks may update documentation without starting application implementation.
3. Review the phase's dependencies and required tests. Keep later-phase checks explicitly deferred until their prerequisite exists.
4. Document consequential ambiguities. Proposed business defaults in BUILD_GUIDE.md require Phase 0 team acceptance before implementation; a planning document is not evidence of acceptance.
5. Add the behavior, its applicable tests, and synchronized documentation. Diagnose failures rather than hiding them.
6. Run the required checks and report actual commands/results. Mark acceptance PASS only with all required evidence; otherwise mark BLOCKED and identify the missing evidence.
7. Stop after the requested phase and wait for team acceptance before implementing the next one.

Do not claim commands, tests, migrations, performance measurements or manual checks succeeded unless actually performed. Documentation-only work needs document checks, not invented application tests.

## 3. Architecture

- Version API routes under `/api/v1`. Use thin route handlers, Pydantic input/output schemas and domain service modules.
- Inject database sessions, current-user dependencies, role policies and ownership checks.
- Keep financial calculations, state transitions, permissions and billing in the backend. The browser submits intent and identifiers; the backend authorizes those identifiers and computes authoritative values.
- Centralize frontend API/error handling. Use reusable accessible components and form validation; backend validation remains authoritative.
- Use PostgreSQL filtering, stable sorting and pagination for collections. Aggregate dashboard metrics in SQL instead of downloading entire tables.
- Organize domains around identity, customers, catalog/pricing, quotations/subscriptions, billing/invoices, payments and reporting. Avoid abstractions or infrastructure without a concrete need.
- Test the billing service before adding scheduling. CLI, admin trigger and scheduler call the same implementation.

## 4. Data and financial invariants

- Use SQLAlchemy 2.x and Alembic. Include migrations with schema changes. Reinforce important rules with primary/foreign keys, unique/check constraints and query-driven indexes.
- Use NUMERIC/Decimal for money; transmit monetary values as decimal strings. Use transactions for related writes.
- Preserve quoted/agreed prices and issued invoice customer/company, line, tax and discount snapshots. Later configuration/profile changes must not rewrite historical documents.
- Archive referenced catalog records; protect subscriptions, invoices and payments from unsafe cascading deletion.
- Enforce one invoice per subscription and billing-period identity with a database uniqueness constraint. Billing retries/concurrent runs must neither duplicate periods nor advance the billing cursor twice.
- Recover eligible missed periods using historical activity and period dates. Excluding a currently expired or closed subscription must not erase legitimate unbilled historical periods.
- Consume limited discount usage only in the same committed transaction as its invoice. Keep previews and failed/repeated billing from consuming extra usage.
- Reconcile balances with persisted payments. Serialize payment writes per invoice and enforce a unique payment request key. Reject non-positive payments, payments against draft/cancelled invoices, and overpayment under the initial policy.
- Define timezone, month-end anchors, rounding, pause/renewal, cancellation and period boundaries using the accepted rules in BUILD_GUIDE.md.

## 5. Security and validation

- Enforce backend authorization on every protected endpoint, including documents, exports, reports and nested resources. Customer queries must be scoped to the authenticated customer's records.
- Only admin provisions staff and changes catalog, tax, discount and template configuration. Staff has the operational permissions listed in docs/USER_FLOWS.md.
- Customers cannot record/alter payments or confirm/cancel invoices. Customer change requests do not directly change financial records.
- Derive identity and role from the authenticated session. Validate submitted resource IDs, plan eligibility and all requested actions; never trust client totals or statuses.
- Hash passwords with Argon2id. Enforce the brief's password rule: at least 9 characters, one uppercase, one lowercase and one special character.
- Use expiring/revocable sessions; store hashes of bearer session, reset and account-verification tokens. Use HttpOnly cookies with appropriate Secure/SameSite settings when cookies carry authentication, and document local development handling and CSRF protection. Rate-limit sensitive authentication actions appropriately.
- Send reset links through configured email/local Mailpit. Keep reset URLs, passwords and session secrets out of logs.
- Keep credentials in ignored local environment files; examples contain placeholders only. Never commit secrets or real customer data.
- Use parameterized ORM queries. Return consistent errors and appropriate 401/403/404/409/422 responses without database details or stack traces.
- Give actionable field-level messages for invalid email/password, dates, amounts, quantities, discounts and transitions.
- Use role-appropriate response schemas; customer responses exclude product cost prices, internal notes and operational metadata.

## 6. UX and tests

- Follow the page inventory: 4 public, 10 shared operational, 11 admin-only and 7 customer page templates. Tabs, dialogs and document downloads are not extra pages.
- Every visible action must work. Provide loading, empty, success, validation, error and retry states; preserve user input on recoverable failures.
- Use consistent layout/color/spacing, accessible labels, keyboard controls, responsive tables/forms and confirmation for destructive or consequential actions.
- Live application content comes from persisted data. Static fixtures are for development/tests only.
- Test introduced behavior and negative cases in each phase. Activate financial integration regressions when invoices/payments exist; do not make earlier gates depend on future modules.
- Test important constraints, concurrency, rollback and ownership against PostgreSQL. Use Playwright as UI workflows become available.
- Measure representative browser pages with thousands of subscriptions against the PDF's under-two-second target. Record dataset, environment, concurrency, timings and limits; API timing alone is not a page-load result.

## 7. Git and handoff

Use focused feature branches and small meaningful commits. Every member contributes changes, reviews and presentation understanding. Do not force-push shared branches. Keep virtual environments, node_modules, build outputs, temporary files and database dumps out of Git.

After a phase report: **Implemented; Files changed; Design decisions; Commands run; Test results; Manual actions remaining; Known issues; Gate status.** Update README and relevant guides when behavior changes. Another teammate must be able to reproduce setup from the documented commands.
