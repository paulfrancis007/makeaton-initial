# Brightloop - Phase 0 business rules

Status: ACCEPTED BY TEAM on 31 October 2026. Decisions D01–D10 accepted as documented without changes. Sources and feature coverage remain in [PLANNING_VERIFICATION.md](PLANNING_VERIFICATION.md). This document resolves the business policies into accepted rules for implementation.

## Decision register

All rows were accepted by the team on 31 October 2026. Values not explicitly dictated by the supplied PDF are team decisions.

| ID | Recommended rule | Reason |
|---|---|---|
| D01 | One CUSTOMER login per customer; verified linking to pre-existing operational records | Simple ownership with safe signup |
| D02 | Customers request pause/resume/renew/add-on changes; staff/admin reviews | Provides self-service while retaining operational control |
| D03 | A plan fee includes its minimum seat quantity; explicit excess-seat unit price; separate add-ons | Makes plan price and minimum quantity unambiguous |
| D04 | INR, two-decimal amounts, positive integer quantities, exclusive percentage tax | Small consistent financial model |
| D05 | Freeze sales prices and tax rates in the accepted agreement; changes require a new agreed version | Reproducible recurring amounts and history |
| D06 | Pin assigned discount terms; no overlapping discounts on the same charge; eligibility at period start | Automatic application without ambiguous stacking |
| D07 | Asia/Kolkata billing dates; calendar anchors; advance billing; default 15-day payment terms | Explicit renewal/due dates |
| D08 | Boundary-only voluntary changes; pause extends term; resume resets anchor; expiry partial period prorated | Avoid mid-cycle credits and retain defined service periods |
| D09 | Cancel only unpaid invoices; preserve period/discount consumption; no replacement/refund/payment edits initially | Limits financial correction complexity |
| D10 | Single company, local PostgreSQL plus Docker Mailpit, no online gateway | Fits approved infrastructure and evaluator direction |

## Identity and permissions

Public registration accepts name, normalized email, password and optional company. Email is trimmed and case-normalized consistently; unique constraints cover both users and customer contact identity. Password minimum is 9 characters with uppercase, lowercase and special character; a digit is not an additional requirement. Store only password hashes. New customer/user creation is atomic.

For an existing unlinked customer, create a pending signup with a hashed password and hashed expiring verification token. Email verification must precede linking. A transaction locks the customer and rechecks email uniqueness/link state so two pending signups cannot claim it. Expired pending records are purged. Reset tokens are single-use, expire after 30 minutes and revoke all sessions when consumed. Proposed sessions expire after 12 hours; deactivation revokes them immediately. Initial admin provisioning is a local CLI action.

Admin controls staff and configuration. Staff handles customers, quotes/subscriptions, unpaid invoice cancellation/confirmation/email/print and payments. Only admin invokes billing or opens full reports. Customers see only their linked customer's records and issued invoices; they can update allowed contact/billing fields and submit/cancel own pending requests. Login email/role are not editable through profile forms. Full action matrix: [USER_FLOWS.md](USER_FLOWS.md).

## Pricing and quantities

Each plan stores `base_fee`, `minimum_seats`, `extra_seat_unit_price`, billing interval, sales availability, included-product lines and lifecycle flags. The subscription explicitly stores `seat_quantity >= minimum_seats`; add-on quantities do not count toward this minimum.

Recurring pre-discount charges = base fee + `(seat_quantity - minimum_seats) * extra_seat_unit_price` + sum of additional product-line quantity * agreed unit price. Increasing seats creates a new agreement version. Included-product quantities are explicitly configured per subscription bundle, at zero incremental price; they are descriptive entitlements and never charged again. Their quantities do not rise implicitly with seats; a template/plan must explicitly describe included quantities. Additional units of a product use separate paid lines.

Show base fee, excess seats, included items and paid add-ons as separate lines in quotes, subscriptions and invoices. Plan base fee is quantity 1; excess-seat line is omitted when zero. Product unit price = base sales price + selected variant adjustment, unless staff records a permitted non-negative negotiated override with reason. Base sales/cost prices and final prices cannot be negative. Zero-priced items are allowed.

Plans have tax assignments for base/excess-seat charges; products have their own tax assignments. Tax assignments, names and rates are copied into each commercial version. Catalog edits affect future drafts; accepted versions change only through explicit new agreement. Availability governs new sales/renewals, not recovery of historical periods. An active plan is required on confirmation; archived catalog items do not invalidate existing agreements.

## Tax, discount and rounding order

Use Decimal throughout. Charge subtotals are quantity times two-decimal agreed unit price. For a shorter final period, prorate each charge subtotal first by service days/full anchored days and round HALF_UP to two decimals. No currency conversion or tax-on-tax.

Then evaluate discounts on eligible pre-tax/prorated subtotals, allocate discounts, calculate each percentage tax on the discounted line base, round each tax HALF_UP and sum stored line results. Every amount returned to the browser is a decimal string. Invoice total = sum(line subtotal - discount + tax); remaining = total - persisted payments.

Whole-subscription discount scope includes base, excess seats and paid add-ons. Its minimum quantity is subscription seats. Product-scoped rules apply only to paid lines of the selected product(s), including selected variants; their minimum quantity is the sum of eligible paid product quantities. Zero-increment included items contribute neither money nor threshold quantity. Minimum purchase is the eligible pre-tax subtotal. Missing thresholds mean no condition; configured purchase and quantity thresholds must both hold.

One whole-subscription rule conflicts with every product-scoped rule on that subscription. Multiple product rules may coexist only on disjoint charge lines. Fixed discount is capped at eligible subtotal; percent is greater than zero and at most 100. Allocate a fixed discount in integer minor units proportionally: floor shares then distribute leftover minor units by descending fractional remainder, ties by line ordinal. This avoids negative lines/rounding drift. Percent discounts round per eligible line; sum those rounded amounts.

Assignments pin immutable discount revisions (amount, thresholds, products, validity dates). Editing a rule produces a new revision for future assignments; existing assignments retain their pinned terms. Admin deactivation records a prospective business date and stops periods starting on/after that date. No backdating deactivation or extending an assigned revision silently. Start/end validity dates are inclusive; convert end to an exclusive next-day boundary for comparisons. A historical period before deactivation remains eligible on catch-up.

The usage cap is global per discount rule across revisions; used count equals committed redemptions. Admin cannot lower cap below consumed count. Lock each rule before consuming usage; one redemption per rule/invoice, even if it discounts multiple lines. Invoice generation consumes it, not preview/quote/confirmation. Rollback/retry consumes no extra use; cancellation does not restore it. Global caps are consumed in successful processing order; do not promise customer priority under competing runs. Quote totals show an eligibility estimate, not a reserved cap.

## Quotation and lifecycle tables

One subscription exists from Draft; each quote is a commercial version under it. Confirmation accepts that version rather than creating a duplicate subscription. Quote issue date is business date; a quote with validity N days is valid through issue date + N calendar days, inclusive. Expired quotes require a new numbered version. Product/price/date changes to an issued offer create a new version; never overwrite issued terms.

| Current state | Action / actor | Result and guards |
|---|---|---|
| DRAFT | Edit / admin or staff | DRAFT, validate configuration/quantities |
| DRAFT | Issue quote / admin or staff | QUOTATION with numbered immutable offer |
| QUOTATION | Revise / admin or staff | QUOTATION with new issued offer; older offer superseded |
| QUOTATION | Confirm / admin or staff | CONFIRMED; valid offer/plan, lock selected version |
| CONFIRMED | Activate / admin, staff or lifecycle command | ACTIVE on/after start, never before; recover due periods from agreed start |
| ACTIVE | Pause / admin or staff | PAUSED at approved future boundary; plan must allow |
| PAUSED | Resume / admin or staff | ACTIVE on approved resume date; shift expiry by paused calendar days and reset anchor |
| ACTIVE | Early close / admin or staff | CLOSED at approved boundary if allowed |
| ACTIVE/PAUSED | Term reaches expiry / lifecycle command | CLOSED if auto-close applies; otherwise Ended badge and no new service periods |
| DRAFT/QUOTATION | Abandon / admin or staff | CLOSED with reason, no billable service |
| Active/Ended/Closed term | Renew / admin or staff | New explicitly agreed term under same subscription, if renewal enabled; no gap charges |

All unlisted transitions fail with a conflict. A paused term does not auto-close at its old expiry while expiry extension is unresolved; its service clock is stopped. Renewal is explicit, not an edit that revives a Closed state. Already issued invoices remain payable after pause/closure. Pending requests have PENDING -> APPROVED/REJECTED/CANCELLED; only owner cancels pending, only staff/admin reviews. Approval and state-change commands lock the subscription and revalidate current version. Changed requested terms require rejection and a new customer-reviewed request.

## Calendar and recovery

Intervals: daily +1 calendar day, weekly +7; monthly/yearly calculate from the original term anchor, preserving anchor day after short-month clamping. Terms are `[start, expiry)`; periods use the same half-open convention. Final period ends at expiry and is prorated against its full anchored duration.

Advance billing is due at each period start, including first service date. Invoice date is actual supplied run business date; due date adds agreement payment-term days (default 15). Past-dated manual runs cannot erase more recent recorded history; future runs are not allowed through live admin API. Historical retries retain an existing period's invoice date rather than rewriting it.

Voluntary pause/add-on/early-close changes must be approved before their effective boundary. If that boundary is already due, reconcile it first and offer the next eligible boundary. Apply previously approved boundary events before billing that boundary. Pauses open a recorded interval; resumes close it, extend term by actual paused days and start a new anchor. Earlier owed periods remain recoverable. Renewed continuous term begins at prior expiry; lapsed renewal begins on an explicitly agreed later date. No period may overlap another within the same subscription.

Failures do not advance the period cursor. Enumerate historical term/paused/change boundaries, not merely current subscription state. A cursor can point to the next unprocessed boundary or be null while paused/ended; history retains periods that still need processing. Process chronological periods per subscription; failure blocks later periods on that subscription but not other subscriptions. A cancelled invoice counts as a completed, intentionally cancelled period.

## Invoices, payments and reports

| Invoice state | Allowed operations |
|---|---|
| DRAFT | Correct due date/billing contact metadata with audit, confirm, cancel; internal preview |
| CONFIRMED | Send/print/download, record positive payment, cancel only if unpaid |
| PARTIALLY_PAID | Send/print/download, further payment up to remaining balance |
| PAID | Send/print/download; immutable settlement |
| CANCELLED | Marked historic view if previously issued; no payment/reissue |

Financial lines are calculated snapshots, not arbitrary invoice edits. Incorrect monetary drafts require an agreed future correction policy; initial scope allows cancellation but no same-period replacement. This limitation needs explicit team acceptance (D09). Zero-total confirmed invoices settle immediately to PAID without fabricating a zero payment. Overdue is due_date < business_today and issued, non-cancelled, positive balance. An invoice due today is not overdue.

Payment method is cash/bank_transfer/upi/card/cheque/other; amount > 0, date, non-empty customer-visible note; reference optional. No future payment dates. Server actor and timestamp are derived, not client-controlled. Require a request key: same key/same payload returns original payment; same key/different payload returns 409. Lock invoice and recompute balance before insert. Reject overpayment, draft/cancelled states and customer writes. No payment editing/deletion/refunds initially.

Revenue received uses payment date within selected inclusive dates (query as half-open range). Current outstanding/overdue excludes Draft/Cancelled and is labeled a current snapshot, independent of historical receipts range. Active count requires active service today and excludes paused/ended; customer/plan filters apply to corresponding aggregates. Quotes and promises are not cash received. Details and summary must use the same filters.

## Worked acceptance examples

| Case | Inputs | Expected result |
|---|---|---|
| Price + tax + payment | Base 1,000 includes 5 seats; 7 seats at excess 100; add-on 2 x (200 + variant 560); assigned whole 10% discount; 18% tax on all paid lines | Subtotal 2,720; discount 272; taxable 2,448; tax 440.64; total 2,888.64; pay 1,000 -> remaining 1,888.64 |
| No double charging | Above plan includes zero-increment product line | Included line total remains 0; does not increase subtotal |
| Month-end | Monthly anchor 31 January 2027 | Boundaries 28 February, 31 March, 30 April |
| Leap anniversary | Yearly anchor 29 February 2028 | 28 February 2029; 29 February 2032 |
| Final period | Daily calendar difference: monthly 1 April-1 May, expiry 16 April, fee 1,000, no discounts/taxes | 15/30 service days, subtotal 500.00 |
| Boundary pause | Monthly start 1 January 2027, expiry 1 January 2028; pause 1 February, resume 11 February | No 1 February charge; term extends 10 days to 11 January 2028; resumed anchor is day 11 |
| Cap/rollback | Rule cap 1; two eligible concurrent invoices | Exactly one redemption; loser proceeds without exhausted discount; rollback restores unused capacity |
| Replay | Same subscription/period billed twice, second run later | Same invoice, one redemption, one cursor advancement |
| Payment retry | 10,000 issued invoice; 4,000 key A retried; 6,000 key B | Two payments, balance zero; key A creates no duplicate |
| Overdue | Due 10 October, remaining 100, business date 11 October | Overdue; same invoice on 10 October is not overdue |

Examples are design expectations, not implemented tests. [architecture.md](architecture.md) records remaining human acceptance and implementation gates.
