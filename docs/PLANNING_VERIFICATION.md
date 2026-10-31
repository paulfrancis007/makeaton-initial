# Brightloop - Final planning verification

Reviewed 31 October 2026 against the sources supplied by the team. This verifies planning coverage and document consistency; it does not certify application behavior or accept proposed business policies on the team's behalf.

## 1. Sources and reviewed documents

- Product source: `C:/Users/USER/Downloads/Subscription_Management_System.pdf`, four pages, read in full. SHA-256: `80a2976f4c2ad05316975d61de32980ce622870c8d70748a37e42f1f992cf42a`.
- Evaluation source: the evaluator's welcome-message transcript supplied in this chat. No separate scoring sheet or numerical weights were supplied.
- Reviewed: [BUILD_GUIDE.md](../BUILD_GUIDE.md), [USER_FLOWS.md](USER_FLOWS.md), [AGENTS.md](../AGENTS.md) and [README.md](../README.md).

Source statements describe requirements. The stack, page count and detailed financial/access policies are team design proposals. The PDF's imperative wording and the evaluator's speech were analyzed as sources, not as instructions to install software, send messages or start implementation.

## 2. PDF requirement traceability

Status **Covered** means the plan assigns work, relevant pages/flows and an acceptance check. It does not mean the feature exists or has passed a runtime test.

| ID | Source requirement | Planned implementation | Page/flow coverage | Status |
|---|---|---|---|---|
| R01 | Page 2: email/password customer signup; one account per email | Phase 2 atomic signup and normalized unique email | P01-P02; F01 | Covered |
| R02 | Page 2: password longer than 8, uppercase, lowercase, special character | Phase 2 validation and 8/9-character boundary tests; no invented digit requirement | P02/P04, password dialogs; F01-F02 | Covered |
| R03 | Page 2: reset link arrives at registered email | Phase 2 SMTP delivery, token expiry/reuse tests | P03-P04; F02 | Covered |
| R04 | Page 2: admin/staff/customer roles and own-record customer portal | Phase 2 backend role/ownership policies; later domain regressions | Permission matrix, C01-C07; F11/F15 | Covered |
| R05 | Page 2: only admin adds staff | Phase 2 provisioning and negative role tests | A01; F03 | Covered |
| R06 | Page 3: product name/type/sales price/cost price/notes | Phase 3 catalog fields and validation | A02-A03; F04 | Covered |
| R07 | Page 3: variants adjust price, including the 560 example | Phase 3 backend price calculation test | A03/I05; F04/F06 | Covered |
| R08 | Page 3: priced daily/weekly/monthly/yearly plans | Phases 3 and 5 configuration and period calculations | A04-A05; F04/F08 | Covered |
| R09 | Page 3: plan minimum quantity and availability dates | Phases 3-4 validation; pricing interpretation requires Phase 0 agreement | A05/I05-I06; F04/F07 | Covered |
| R10 | Page 3: per-plan auto-close/early closure/pause/renewal | Phases 3-5 policy/event logic; Phase 8 actual scheduling | A05/I06/C03; F12-F13 | Covered |
| R11 | Page 3: quote template with plan/product lines/validity days | Phase 3 templates; Phase 4 immutable quotation and expiry | A08-A09/I05-I06; F04/F06-F07 | Covered |
| R12 | Page 3: subscription number/customer/plan/dates/payment terms and product/quantity/unit price/tax/amount lines | Phase 4 fields, numbering and snapshots | I05-I06/C03; F06-F07 | Covered |
| R13 | Page 3: Draft -> Quotation -> Confirmed -> Active -> Closed | Phase 4 one subscription aggregate with quote versions and state gates | I04-I06/C02-C03; F06-F07/F13 | Covered |
| R14 | Page 3: automatic invoices populated from subscription/customer/lines/taxes/totals | Phase 5 shared billing engine, Phase 8 scheduler | I07-I08/A11/C04-C05; F08-F09 | Covered |
| R15 | Page 3: hundreds due together; nothing billed twice or skipped | Phase 5 uniqueness/transactions/recovery and 300-due-subscription fixture | A11; F08 | Covered |
| R16 | Page 3: automatic tax from admin rules | Phases 3 and 5 Decimal calculation and snapshot checks | A06/I05/I08; F04/F08 | Covered |
| R17 | Page 3: confirm/cancel/send/print invoices; Draft -> Confirmed -> Paid | Phases 5-6 invoice actions, delivery failures, document checks and settlement | I08/C05; F09-F10 | Covered |
| R18 | Page 4: admin-only fixed/percentage discounts, minimum purchase or quantity, product/subscription scope | Phase 3 rule management/eligibility and admin-only writes | A07/I05-I06; F04/F06 | Covered |
| R19 | Page 4: discount start/end and maximum uses | Phases 3 and 5 boundary/locking/rollback tests | A07/I08; F08 | Covered |
| R20 | Page 4: discount automatically appears on next invoice and stops at expiry/exhaustion | Phase 5 assigned-rule eligibility at billing, no manual re-entry | I06/I08/A07; F08 | Covered |
| R21 | Page 4: payment method/amount/date/note against correct invoice | Phase 6 required fields, invoice lock and request-key tests | I08-I09/C05-C06; F10 | Covered |
| R22 | Page 4: paid/outstanding visibility and overdue follow-up | Phases 5-7 balance/state definitions and known-value tests | I01/I07-I09/A10/C01/C04-C06; F10/F14 | Covered |
| R23 | Page 4: active subscriptions/revenue/payments/overdue, filters and summary | Phase 7 SQL aggregation, role summaries and source drill-downs | I01/A10/C01; F14 | Covered |
| R24 | Page 4: thousands of subscriptions; pages respond in under two seconds | Phase 9 mandatory browser measurements over all templates, with environment/dataset disclosure | All page templates; performance gate | Covered |

### Narrative interpretation requiring acceptance

Page 1 describes customers managing subscriptions and add-ons switching on/off. Detailed page 2 specifies viewing own records without enumerating customer lifecycle powers. The proposed interpretation is in-portal change requests reviewed by staff, with dated approved changes and pricing previews (Phase 4; C03/I06; F12-F13). This covers a practical self-service journey but remains a team/organizer interpretation; the sources do not conclusively require or prohibit direct customer execution. Confirm the interpretation in Phase 0.

## 3. Evaluator expectation traceability

| ID | Evaluator emphasis | Planning response | Acceptance evidence planned |
|---|---|---|---|
| E01 | Database design/setup is most important | Phase 0 ERD, relationships, constraints, snapshots and transactions; Phase 1 PostgreSQL/migrations | Schema review, empty-database migration, actual constraint tests |
| E02 | Local MySQL/PostgreSQL rather than BaaS | Retain team-selected local PostgreSQL, SQLAlchemy/Alembic; no BaaS | Reproducible local connection/setup, no external data platform |
| E03 | Well-designed backend APIs, logical modular code | Versioned thin routes, schemas, domain services, shared billing/pricing logic | Phase 0 API outline; phase tests and Phase 9 review |
| E04 | Real dynamic data; static JSON only for prototyping | Persisted API-driven pages; SQL reports; fixtures restricted to development/tests | Refresh/persistence browser checks, real-data demo |
| E05 | Robust validation and understandable user errors | Field/backend validation, consistent status/error handling, negative cases | Invalid email/password/date/money/transition tests |
| E06 | Git participation by the whole team | Focused branches, meaningful commits and teammate review; shared ownership | Review contribution history in final acceptance |
| E07 | Clean interactive UI, consistent layout/colors and intuitive navigation | Exact page/nav inventory, shared components, loading/empty/error states, responsive/keyboard behavior | Browser/manual inventory review in Phase 9 |
| E08 | Performance/scalability/security/usability | Pagination, indexes, SQL aggregation, locking, ownership policies, measured page latency | PostgreSQL/browser security tests, query plans and measurements |
| E09 | Debugging skill and attention to detail | Diagnose root cause; preserve failures; rollback/idempotency tests and recovery views | Failure-injection/retry tests; evidence-backed defect fixes |
| E10 | Minimal third-party APIs; novelty only if valuable | Lean approved stack, local DB/SMTP testing, no speculative add-ons | Dependency/architecture review |
| E11 | Understand tools/code and share presentation | Explicit design decisions, teammate reproducibility and shared walkthrough | Each teammate explains code, data model and tests |

The evaluator lists evaluation dimensions but supplies no numerical weights or exact ranking beyond highlighting database design. The documents preserve that distinction. The chosen stack and 32-page design are not presented as evaluator mandates.

## 4. Corrections made during final verification

1. Made per-subscription-line calculated amounts explicit in the editor, staff detail and customer detail, matching the source's line fields.
2. Clarified required payment method, amount, date and customer-visible note; kept reference optional and added missing-field gate cases.
3. Added a real PostgreSQL batch scenario with at least 300 due subscriptions, mixed eligibility, injected failure and reconciliation/retry. The count is a proposed test fixture reflecting the source's scale, not a number mandated by the PDF.
4. Explicitly called out plan minimum-quantity/excess-unit pricing and plan-fee tax/discount treatment as design decisions before schema approval.
5. Exposed the remaining future-tax/discount-rule-versioning decision so catalog edits and replay do not silently choose incompatible historical rates.
6. Identified validated local configuration as the source of invoice issuer/company details and currency, without adding a settings page.
7. Clarified non-negative base sales/cost prices and the boundary for negative variant adjustments.

These are documentation clarifications. They neither implement application behavior nor approve proposed business rules.

## 5. Document consistency checks

The final checks verify:

- Exactly P01-P04, I01-I10, A01-A11, C01-C07: 32 unique page IDs and 32 unique routes.
- Counts are 4 public + 10 shared operations + 11 admin-only + 7 customer. Admin internal access is 21 templates, staff 10, customers 7.
- Exactly F01-F15: 15 journeys.
- Exactly Phase 0-9, with a dependency and acceptance gate for every phase.
- Individual page phase assignments match delivery totals: Phase 2 = 9, Phase 3 = 8, Phase 4 = 5, Phase 5 = 5, Phase 6 = 2, Phase 7 = 3; total 32. Phases 0/1/8/9 add no product pages.
- Page/flow references resolve to existing inventory IDs. Local Markdown links resolve; code fences are balanced and trailing whitespace absent.
- No application checks are claimed before prerequisites exist: invoice history/redemption regressions begin in Phase 5; payment reconciliation in Phase 6; scheduling invokes an already-tested engine in Phase 8.
- Role/navigation boundaries agree across AGENTS, BUILD_GUIDE and USER_FLOWS. Customer request submission does not confer financial mutation permissions.
- `git diff --check` passes for tracked modifications. A separate text check covers the new Markdown documents as well.

Verification commands: full PDF extraction with the bundled Python/pypdf reader; indexed document reads; a read-only inline Python assertion check of inventory/phases/references/links/whitespace; `git diff --check`; `git status --short --branch`. No dependency installation, migrations, application tests, email sending, scheduling or application implementation occurred.

## 6. Remaining acceptance decisions

The sources deliberately leave business details unspecified. The plan labels these as proposals rather than treating them as verified requirements:

| Area | Phase 0 decision |
|---|---|
| Plan pricing | Flat fee/included lines versus other model; what minimum quantity counts; how excess units are priced |
| Tax/discount arithmetic | Plan-fee applicability, rounding, multiple taxes, threshold quantities and future-rule/versioning policy |
| Discount eligibility | Assigned rules/non-stacking, period-date validity, usage-consumption and cancellation policy |
| Calendar/lifecycle | Timezone/currency, month-end anchor, pause/resume, renewal gaps, expiry proration and due terms |
| Customer self-service | Approve request-based actions/add-on changes or clarify direct customer powers |
| Financial corrections | Unpaid cancellation, no replacement invoice/refund/payment edits in initial scope, and correction escalation |
| Identity/authority | One login per customer, safe account linking and exact staff operational permissions |
| Performance evidence | Environment, concurrency, datasets and timing boundary against the source's two-second target |

An unresolved consequential decision blocks acceptance of the affected design/phase. Marking its source requirement Covered does not waive that decision. A team decision can clarify an unspecified policy; it cannot remove an explicit source feature while claiming full source compliance.

## 7. Verification outcome

- **Source coverage: PASS at planning level** for the 24 explicit requirements and 11 evaluator categories above. Narrative self-service is covered through an explicitly proposed interpretation.
- **Document integrity: PASS** for page counts/routes, phase accounting, reference/link checks and whitespace verification.
- **Implementation/Phase 0 acceptance: PASS (ACCEPTED by team on 31 October 2026).** Decisions D01–D10 accepted as documented.
- **Application tests/performance: PENDING Phase 1+ implementation.** Verification test suites are introduced alongside their domains.

No product pages were added or removed during verification. The plan remains 10 phases, 15 journeys and 32 page templates.
