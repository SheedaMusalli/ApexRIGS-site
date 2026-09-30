# Earlier repair notes

This file describes the initial repair pass. The latest delivered workflow supersedes its old screen names: see ACCOUNTING-UPGRADE.md and FASTACCOUNTS-RESEARCH.md.

## Delivered changes

### Accounting and ERP

- Voucher retries and edits no longer add cash twice. Changing the bank reverses the old effect; deleting an unallocated voucher reverses its cash effect. The UI waits for the server before reporting success.
- Added invoice receipt form and backend transaction: validates the invoice, active bank, amount, outstanding balance and duplicate receipt IDs. Invoice, customer, cash and voucher changes are saved together; failed receipt persistence restores in-memory state.
- Prevented standalone deletion of allocated invoice receipts, their invoices and linked orders.
- Sales document writes adjust customer balances by the difference from the previous document. Repeated unchanged invoices do not add receivables twice.
- Added document identity, type, amount, quantity, discount, date, outstanding-balance and duplicate-number validation. Missing invoice updates return 404.
- Added invoice editor checks, reset payment input on edit, and routed additional payments through the receipt form.
- Corrected ERP customer/document cache keys and customer persistence; surfaced customer-sync failures.
- Fixed an invoice-preview crash when zero tax was omitted, restored the tax column header, and corrected pending-invoice counts.
- Corrected credit-normal opening balances for revenue/equity/liability accounts; stopped duplicate account codes overwriting existing accounts.

### Reports

- P&L uses recorded costs of quantities sold instead of expensing every purchase. Excludes draft/cancelled sales and handles credit-note reversals, discounts, labor and shipping.
- Excludes supplier settlements and transfers from operating expenses; categorizes expense payments by account code.
- Added date filtering, live refresh, calculated invoice aging, overdue buckets and an invoice detail table.
- Removed fabricated aging balances, growth/margin claims, fiscal dates, audit certification and automatic 29% income-tax assumptions.
- Added missing-cost/provisional-report explanations and an unreconciled balance-sheet difference. Uses recorded fixed-asset and ledger balances where available.
- Corrected aging and balance-sheet CSV exports, quoted commas/newlines, and guarded formula injection.

### Backend and storefront

- Added random server-side sessions, HttpOnly/SameSite cookies, session expiry, logout revocation, server-verified roles, owner-only account management and login throttling.
- Replaced plaintext passwords with salted scrypt hashes. Removed embedded/default passwords, prefilled fields, displayed credentials, alternate owner-unlock shortcuts and the hardcoded Track123 key.
- Scoped customer order/wishlist/alert reads to the authenticated customer. Anonymous order lookup cannot return full customer details; partial phone/order matching was removed.
- Added same-origin write checks and server session restoration rather than trusting locally stored admin flags.
- Public checkout now derives catalog/variant/custom-build prices and shipping on the server. A body field cannot grant ERP pricing privileges.
- Removed fabricated local checkout-success behavior: failures keep the cart and show an error. Tracking numbers are no longer invented; dispatch requires a real carrier-issued number.
- Added stock checks before confirmation, repeat-confirmation protection, cancellation stock restoration and linked unpaid-invoice cancellation. Paid invoices require a refund/credit workflow before cancelling.
- Product creation permits zero stock and stores supplied cost. Auto-generated invoices use catalog cost, not an assumed percentage, and do not infer payment from delivery or payment-method selection.
- API utility no longer retries 4xx failures or automatically replays writes after uncertain network errors. Caller cancellation is respected.
- Removed a fallback save path that omitted ERP collections. Unreadable data stops startup instead of being overwritten with defaults.
- Added `.env.local`, configurable port/data path, secret/data ignores, a repaired dependency lockfile and a portable production ESM build.

## Validation

- TypeScript check, production frontend/server build, and **11 automated tests** passed.
- HTTP assertions cover authorization, customer isolation, validation, voucher retry/delete behavior, persisted password hashes, partial receipts and duplicate receipts, overpayment rejection, allocated-record deletion guards, stock confirmation/cancellation retries, public price tampering and real-tracking requirements.
- Unit tests cover voucher bank changes, profit, aging, CSV escaping, password verification, HTTP retries and cancellation.
- Browser smoke test with disposable data: sign-in/session restoration, reports, invoice preview, and a PKR 40 receipt against a PKR 100 invoice. The UI showed PKR 60 outstanding and PARTIALLY_PAID.
- Live Gemini/Track123 integrations were not tested; supplied keys were not used. No GitHub repository, production database or deployment was changed.
- The frontend build still warns about a large main bundle; code splitting remains a performance task.

## Remaining work

1. **Double-entry ledger:** unify sales, purchases, inventory, cash, tax and opening balances under balanced server-side postings, period locks and audit-preserving reversals. Several ledger/admin screens still use browser storage or direct balance edits; trial-balance completeness is not established.
2. **Database/concurrency:** migrate JSON and browser-only records to a transactional database; add record versions, import/backup/restore tools and multi-user conflict handling. Some legacy purchase/inventory/settings writes remain optimistic; not every operation rolls back after failed persistence.
3. **Settlement:** complete supplier allocations, credit/debit notes, refunds, receipt reversals, credit limits, reconciliation and party statements. Historical balances and estimated costs need reconciliation; they were not silently rewritten.
4. **Reports:** P&L is a management view, not a complete accrual statement. Manual journals and historical accrual/depreciation/tax provisions are not fully integrated. Aging uses current outstanding balances at the cutoff, not reconstructed historical settlements. The balance sheet shows current records and may be out of balance.
5. **Inventory lifecycle:** unify serial, warehouse, custom-build component, assembly and returns allocation with posting. Custom-build component allocation and legacy dispatch/serial paths need additional reconciliation and tests.
6. **Operational hardening:** distributed sessions, comprehensive per-role permissions, audit identity, AI/tracking quotas, proxy-image fetch restrictions, account recovery and broader end-to-end coverage remain. Validate HTTPS/proxy behavior for the target deployment.

This is a tested repair package for the supplied archive; it does not certify every module as complete or production-ready.
