# Brightloop - API contract outline

Status: PROPOSED Phase 0 contract, not implemented endpoints. Depends on [business-rules.md](business-rules.md) and [database-design.md](database-design.md). Prefix every route below with `/api/v1`. OpenAPI/Pydantic schemas in Phase 1 onward will formalize the fields; this document defines intended behavior and access.

## Shared contract

JSON requests/responses; currency amounts as strings, ISO dates, UTC timestamp strings, UUIDs and server-derived role/actor. Deny by default. A = admin, S = staff, C = owning customer, P = public. Any `C` operation derives customer from the session and applies ownership in the SQL query; an arbitrary customer_id never expands access. A/S endpoints still validate nested associations.

Collections: `page` default 1, `page_size` default 20/max 100, allowlisted `sort`, structured filters, stable id tie-break. Response `{items, page, page_size, total}`. Reject invalid filter/date/sort fields with 422. Search number/email prefix or documented name prefix; no raw SQL/column expressions. Detail `{...fields}`; create 201 with Location; reads/commands 200; logout 204.

Errors: `{error: {code, message, fields: [{path, message}], request_id}}`. 401 missing/expired session, 403 forbidden role, 404 absent/unavailable owned resource, 409 stale version/duplicate email/key mismatch/state conflict, 422 field/business input validation, 503 unavailable infrastructure. No raw ORM/SQL/token details. SMTP failure returns a persisted FAILED attempt with retry guidance, not a fictitious rollback of the confirmed invoice.

Mutable actions include `expected_version` and fail 409 on stale state. Accept a unique `Idempotency-Key` for draft creation, quote issue/confirm, request review, renewal/lifecycle scheduling, invoice confirmation and payment creation. Persist key + normalized request hash + result reference in the corresponding aggregate/action record, or a scoped command record as specified below. Scope keys to actor/operation; payment keys are globally unique. Replay returns original resource without new writes; a changed payload conflicts. A billing trigger can create a new run record, but period processing is idempotent independently of request keys.

## Identity, users and customers

| Method / path | Access | Input / result |
|---|---|---|
| POST /auth/register | P | name,email,password,company?; creates customer session-ready identity or generic verification-required result for existing operational customer |
| POST /auth/verify-signup | P token | consume token; verified pending identity/customer link |
| POST /auth/login | P | email,password; opaque session cookie and current-user DTO |
| POST /auth/logout | authenticated | revoke current session, clear cookie |
| GET /auth/me | A/S/C | identity/role, no password/session hash |
| GET /auth/csrf | P/session | establish/refresh CSRF context without leaking auth token |
| POST /auth/forgot-password | P | email; generic 202, whether or not account exists |
| POST /auth/reset-password | P token | token,new_password; consume and revoke all sessions |
| POST /auth/change-password | A/S/C | current_password,new_password; revoke other sessions |
| PATCH /profile | A/S/C | allowed own contact fields only; customer includes billing fields |
| GET, POST /staff | A | paginated staff list; name,email,initial_password creates STAFF only |
| PATCH /staff/{id} | A | name/contact, expected_version; no arbitrary role changes |
| POST /staff/{id}/deactivate or /reactivate | A | state command; deactivation revokes sessions |
| GET, POST /customers | A/S | search/list; create operational customer without password |
| GET, PATCH /customers/{id} | A/S | detail/contact edits; validated normalized email and link restrictions |
| GET /portal/profile | C | own customer profile |

Registration/verification exceptions must not leak pre-existing customer's record fields. Auth throttling, hashed challenge tokens and session behavior follow architecture.md. Login-email changes are not an exposed first-release operation. Existing linked customer email cannot drift from account email through operational editing.

## Catalog and templates

| Method / path | Access | Responsibility |
|---|---|---|
| GET /products; GET /products/{id} | A/S | A gets admin DTO; S gets only operational sales fields |
| POST /products; PATCH /products/{id} | A | name,type,sales_price,cost_price,notes; validated archive flags |
| POST /products/{id}/variants; PATCH /products/{id}/variants/{variantId} | A | name,adjustment; validate association/effective price |
| GET, POST /plans; GET, PATCH /plans/{id} | A/S reads; A writes | fee,minimum_seats,extra_seat_unit_price,interval,availability,payment terms,flags,included lines,tax assignments |
| GET, POST /taxes; PATCH /taxes/{id} | A/S reads; A writes | admin tax rules; assignment fields on product/plan write schemas |
| GET, POST /discounts; GET, PATCH /discounts/{id} | A/S reads; A writes | revisioned conditions, product scope and global cap |
| POST /discounts/{id}/deactivate | A | prospective date, reason; preserve assigned history |
| GET /discounts/{id}/redemptions | A | paginated committed uses |
| GET, POST /quotation-templates; GET, PATCH /quotation-templates/{id} | A/S reads; A writes | metadata/lines/validity; incomplete template inactive |
| POST /pricing/preview | A/S | selected plan,seats,lines,discount IDs,dates; authoritative estimate without redemption |

Archive via validated active-state patch with confirmation; no destructive deletion of referenced catalog. Customer add-on selection uses the restricted subscription eligibility route below, not these unrestricted catalog responses. Tax/discount configuration cannot be embedded as newly trusted rules in a pricing request.

## Subscriptions, quotations and customer requests

| Method / path | Access | Responsibility |
|---|---|---|
| GET, POST /subscriptions | A/S | filters including quotation/pending request; create aggregate with first draft version |
| GET /subscriptions/{id} | A/S | current terms, lines, version, lifecycle and safe history |
| PATCH /subscriptions/{id}/draft | A/S | draft-only commercial fields; clone/revise issued versions through command below |
| GET /subscriptions/{id}/quotes | A/S/C owner | immutable customer-safe versions where applicable |
| POST /subscriptions/{id}/issue-quote or /revise-quote | A/S | validity and selected draft; number/expiry; immutable issued version |
| POST /subscriptions/{id}/confirm | A/S | quote_version_id, expected_version; freeze agreement, never create another subscription |
| POST /subscriptions/{id}/activate | A/S | eligible start; shared lifecycle service |
| POST /subscriptions/{id}/pause, /resume, /renew, /close, /change-addons | A/S | explicit action schema/effective date/impact consent/reason; plan/state guards |
| GET /subscriptions/{id}/invoices or /events | A/S | associated paginated history |
| GET /portal/subscriptions; GET /portal/subscriptions/{id} | C | own records and safe lines/quotes/events |
| GET /portal/subscriptions/{id}/eligible-changes | C | plan/state-allowed actions, valid dates and safe add-on options |
| POST /portal/subscriptions/{id}/change-preview | C | validate desired action/date/items; estimate, no writes |
| POST /portal/subscriptions/{id}/requests | C | create pending request with current version and accepted preview |
| GET /subscriptions/{id}/requests | A/S | pending/history; customer own history included in portal detail |
| POST /portal/subscriptions/{id}/requests/{requestId}/cancel | C | owner, pending only |
| POST /subscriptions/{id}/requests/{requestId}/approve or /reject | A/S | expected_version, reason; apply/schedule same domain action as direct staff commands |

Customer and staff changes both use the same validation/calculation service. Review rejects stale/different commercial terms; the customer submits a new request after preview. Action record unique request key/event identity prevents duplicate scheduled changes. Dates and history are never patched with an arbitrary status field.

## Invoices, payments, runs and reports

| Method / path | Access | Responsibility |
|---|---|---|
| GET /invoices; GET /invoices/{id} | A/S | list/detail including internal drafts |
| PATCH /invoices/{id}/draft-metadata | A/S | only due date/contact metadata, audit reason; cannot rewrite financial lines |
| POST /invoices/{id}/confirm or /cancel | A/S | expected_version; cancellation requires unpaid state/reason |
| GET /invoices/{id}/document | A/S | persisted draft preview or marked issued/cancelled PDF |
| POST /invoices/{id}/send | A/S | issued snapshot billing contact; persisted attempt, never arbitrary unrelated recipients |
| GET /invoices/{id}/email-attempts | A/S | safe success/failure/retry history |
| POST /invoices/{id}/payments | A/S | amount,method,date,note,reference?; Idempotency-Key required; server actor |
| GET /payments; GET /payments/{id} | A/S | paginated ledger/read-only detail |
| GET /portal/invoices; GET /portal/invoices/{id}; GET /portal/invoices/{id}/document | C | owned issued documents only; same backend ownership query for PDF |
| GET /portal/payments; GET /portal/payments/{id} | C | owned immutable payment history, customer-safe notes |
| GET /billing-runs; GET /billing-runs/{id} | A | paginated outcomes and safe failures |
| POST /billing-runs | A | as_of_date <= business today; bounded synchronous command, persist partial outcomes |
| POST /billing-runs/{id}/retry | A | retry outstanding eligible work through same service; new linked run |
| GET /dashboard | A/S | backend chooses role-appropriate metrics/queues |
| GET /portal/dashboard | C | mandatory ownership on all aggregates |
| GET /reports/summary; GET /reports/details | A | receipts date range/customer/plan; explicit current-balance definition and paginated details |
| GET /health; GET /ready | operational | liveness; database readiness with safe status, no infrastructure secrets |

Print invokes browser print against the same document representation; it is not a second financial calculation endpoint. Customer cannot send/confirm/cancel invoices or record payments. There are no financial DELETE/PATCH payment endpoints. Send retries are explicit; delivery is not guaranteed exactly once across an SMTP acceptance/connection-loss ambiguity, so UI may report unknown delivery before a deliberate retry.

## Example schema shapes

```json
{
  "plan_id": "UUID",
  "customer_id": "UUID",
  "seat_quantity": 7,
  "start_date": "2027-01-01",
  "expiry_date": "2028-01-01",
  "payment_term_days": 15,
  "lines": [{"product_id": "UUID", "variant_id": null, "quantity": 2}],
  "discount_revision_ids": ["UUID"]
}
```

Draft input contains selectors/intent; backend looks up prices, inclusion, taxes, availability and permissions. An allowed negotiated unit-price override is a separate validated field with reason. Invoice output includes `id, number, state, overdue, period_start, period_end, subtotal, discount_total, tax_total, total, paid, remaining, lines, version`; monetary fields are decimal strings. Pagination responses never serialize ORM graphs or raw internal columns.

## Coverage and future tests

P01-P04/I10/C07 use identity/profile; I02-I03 customers; A01 staff; A02-A09 catalog/templates; I04-I06/C02-C03 commercial commands/requests; I07-I09/C04-C06 invoices/payments; A11 runs; I01/A10/C01 dashboards/reports. Full page field details stay in [USER_FLOWS.md](USER_FLOWS.md).

For every introducing phase test successful operation, malformed fields, unauthenticated/forbidden role, missing IDs, nested ID mismatch, cross-customer access, stale version and duplicate commands where applicable. PostgreSQL checks back the financial races; UI hiding is never evidence of authorization.
