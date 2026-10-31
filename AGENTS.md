# AGENTS.md — Brightloop Subscription Management System

This file contains persistent instructions for coding agents working in the `makeaton-initial` repository.

## 1. Product context

Build **Brightloop**, a responsive web-based Subscription Management System for three roles:

- **ADMIN:** manages staff, products, variants, plans, taxes, discounts, quotation templates, subscriptions, invoices, payments, and reports.
- **STAFF:** performs permitted day-to-day customer, quotation, subscription, invoice, and payment operations. Staff cannot create staff accounts or change admin-only configuration.
- **CUSTOMER:** can register and access only their own profile, subscriptions, invoices, and payment history. Customers cannot record or alter payments.

The main business flow is: configure catalog → prepare quotation → confirm subscription → generate recurring invoice → record payment(s) → report business metrics.

The detailed feature sequence, manual setup instructions, Antigravity prompts, and test gates are in `BUILD_GUIDE.md`. Follow that document stage by stage.

## 2. Evaluator priorities

Prioritize, in this order:

1. Correct relational database design and setup.
2. Clean backend APIs and business logic.
3. Dynamic data persisted in PostgreSQL; no static mock data as the final source.
4. Strong input validation and understandable error handling.
5. Role-based security and customer data isolation.
6. Modular, readable, maintainable code.
7. Responsive, interactive and intuitive UI.
8. Performance, query efficiency and scalability.
9. Proper Git collaboration, testing and debugging.
10. Team understanding of implementation decisions.

Do not add AI, blockchain, chatbots, microservices, or other technology merely for novelty. Use external services only when genuinely required. No BaaS platforms.

## 3. Approved technology direction

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS.
- UI: reusable accessible components; shadcn/ui and Lucide may be used.
- Forms: React Hook Form and Zod.
- Server state: TanStack Query where useful.
- Backend: Python, FastAPI, Pydantic.
- Persistence: PostgreSQL.
- ORM/migrations: SQLAlchemy 2.x and Alembic.
- Tests: Pytest and Playwright.

Keep one frontend, one backend and one relational database. Do not introduce Redis/Celery or other infrastructure without a concrete requirement and team approval. The billing service must be implemented and tested independently before scheduling is added.

## 4. Mandatory development behavior

- Inspect the existing repository before editing it. Do not assume it is empty.
- Preserve existing working files and conventions.
- Implement only the current requested stage. Do not jump ahead or add unrelated features.
- Read `BUILD_GUIDE.md` and obey its stage gates.
- Do not overwrite or delete files without understanding their purpose.
- Explain material technical decisions and assumptions.
- Never claim tests, commands, migrations, or manual checks passed unless they were actually run.
- When something fails, diagnose the root cause. Do not hide errors or use superficial workarounds.
- If a business requirement is ambiguous, document it and ask the team before making a consequential choice.
- Keep documentation synchronized with actual behavior.

## 5. Architecture and code organization

- Keep frontend and backend responsibilities separate.
- Keep API route handlers thin.
- Put business rules in backend service modules, not React components or route handlers.
- Use Pydantic schemas for API input/output; do not expose ORM entities directly.
- Use dependency injection for database sessions, current user, role checks and ownership checks.
- Use consistent API versioning under `/api/v1`.
- Use pagination for collection endpoints and database filtering for search.
- Centralize frontend API communication and error handling.
- Reuse components and avoid duplicated business logic.
- Do not add abstractions that make a small monolithic project harder to understand without a clear benefit.

## 6. Database and financial-data rules

- PostgreSQL is the persistent source of truth.
- Use SQLAlchemy 2.x and Alembic migrations.
- Use primary keys, foreign keys, unique constraints, check constraints and indexes appropriately.
- Use `NUMERIC`/`DECIMAL` for currency; never use floating-point types for financial amounts.
- Use transactions for operations that update related records.
- Preserve historical snapshots of quoted prices, subscription prices, invoice lines, tax and discount calculations.
- Catalog or tax-rule changes must not rewrite confirmed historical financial documents.
- Protect invoices and payments from unsafe cascading deletion.
- Prevent duplicate invoices using a database uniqueness constraint over the subscription and billing period.
- Billing must be idempotent: retrying a run must not duplicate an invoice or advance the billing date twice.
- Payment balances must reconcile with persisted payment records. Reject overpayment unless the team approves and documents a credit policy.
- Define billing timezone and month-end date behavior explicitly.
- Add indexes based on actual query patterns, not randomly.

## 7. Security and authorization rules

- Enforce authorization in the backend on every protected endpoint.
- Frontend route protection and hidden navigation are usability features, not security controls.
- Never trust role, user ID, customer ID, invoice amount, discount amount, payment status or invoice status supplied by the browser.
- A customer must never access another customer's records.
- Only admin can create staff accounts and modify products, plans, taxes, discounts and other protected configuration.
- Staff can perform only their approved operational actions.
- Hash passwords with Argon2id or another explicitly approved modern password hash.
- Do not store plaintext passwords, reset tokens or session secrets.
- Use secure session/cookie handling and document CSRF protection if cookies are used.
- Keep credentials in environment variables. Never commit `.env`, access tokens, passwords, private keys or real customer data.
- Do not log secrets or unnecessary personal information.
- Use safe ORM parameterization; never build SQL from untrusted strings.

## 8. Validation and error handling

- Validate data on both frontend and backend; backend validation is authoritative.
- Give clear field-level messages for invalid email, weak password, invalid dates, negative/invalid amounts, invalid quantities, ineligible discounts, invalid status transitions and overpayment.
- Use correct HTTP status codes (including 401, 403, 404, 409 and 422 where appropriate).
- Do not return raw stack traces, database internals or secrets to users.
- Use centralized exception handling and consistent error shapes.

## 9. Frontend and UX rules

- Use a consistent visual system, spacing, typography, colors and navigation.
- Build role-appropriate layouts for admin, staff and customer.
- Include loading, empty, success, validation and error states.
- Provide confirmation for destructive actions.
- Use accessible labels and keyboard-operable controls.
- Make tables and forms usable on narrow screens.
- Every visible button/link must have a working action; do not leave placeholders or fake controls.
- Do not display fake metrics or static demo content as final live application data.

## 10. Testing requirements

For every stage:

1. Add or update tests for the behavior introduced.
2. Run relevant tests and report exact commands/results.
3. Test database behavior against PostgreSQL for important constraints and transactions; do not rely only on mocks.
4. Include negative tests (invalid input, forbidden action, missing record, duplicate operation).
5. Test ownership boundaries and role restrictions.
6. Test billing idempotency, date edges, taxes, discounts and payment reconciliation.
7. Use Playwright for critical end-to-end journeys when UI workflows are introduced.

Never proceed to a later stage if the current stage's acceptance gate fails.

## 11. Git and documentation

- Work on focused feature branches.
- Keep commits small and meaningful.
- Do not force-push shared branches.
- Do not commit generated artifacts, secrets, virtual environments, `node_modules`, build outputs or database dumps.
- Update README and relevant design/API docs when behavior changes.
- Include migrations with schema changes.
- Ensure another teammate can reproduce the setup from documentation.

## 12. Required response format after each task

When completing a stage, report:

1. **Implemented:** features and behavior completed.
2. **Files changed:** important files created/modified.
3. **Design decisions:** notable architecture/database/security choices.
4. **Commands run:** exact commands.
5. **Test results:** passed/failed with evidence; never guess.
6. **Manual actions remaining:** steps the human must perform.
7. **Known issues:** honest list of incomplete items or risks.
8. **Gate status:** PASS only if all stage acceptance criteria are met; otherwise BLOCKED.

Do not begin the next stage automatically. Wait for the team to confirm that the current stage is accepted.
