# Poultry Business Manager: Architecture (Phase 1)

Status: **agreed design, to be implemented in phases 2–9.**
This replaces the "Sales Ledger" design described in the README where the two differ.
The README will be updated in Phase 9.

---

## 1. What exists today (analysis)

| Area | Current state | Keep / change |
|---|---|---|
| Backend | NestJS 12, Mongoose 9, class-validator, JWT auth (single admin, bcrypt, token versioning), global guard, throttling, global exception filter | **Keep**; extend |
| Layering | controller → service → repository, mappers for API shapes, DTOs | **Keep** the same pattern for new modules |
| Money / weight | Integer **paise** / integer **grams**, BigInt multiplication, half-up rounding, string-based parsing (`common/money.ts`) | **Keep** (meets the "integer paise" requirement; no Decimal128) |
| Dates | Calendar dates `YYYY-MM-DD` stored as 00:00 UTC, "today" in IST (`common/dates.ts`, `BusinessClock`) | **Keep** |
| Transactions | `TransactionService.run()`; falls back to no transaction on standalone MongoDB | **Keep**; production must use a replica set (see §8) |
| Customers | `shopName`, `ownerName`, `phone`, `address`; hard delete blocked if sales exist | **Change**: `name`, `phone`, `address`, `openingBalance`, `notes`, `isActive` |
| Sales | Sale + cached paid/remaining; cash/online on the sale form become payment records | **Change**: add `costPaise` (COGS) and FIFO bill status; payments no longer belong to a sale |
| Payments | Every payment **must** reference a sale; FIFO split of lump sums; no advance; modes CASH/ONLINE | **Change**: payments belong to the **customer account**; modes CASH/UPI/BANK/OTHER; advance allowed |
| Reports / dashboard | Sales + collections by day/week/month/custom, series, comparison | **Extend** with purchases, stock, COGS, expenses, profit, and customer/supplier reports |
| Suppliers, purchases, expenses, inventory, audit, settings | Not present | **New** |
| Mobile | Expo SDK 58, RN 0.88, **React Navigation** (tabs + native stack), React Query, RHF + Zod, axios, SecureStore session, shared `ui.tsx` components, integer money math mirrored from the backend | **Keep the stack**; add screens. (`mobile/AGENTS.md` mentions Expo Router, but the app is built on React Navigation; migrating it is out of scope.) |
| Tests | Backend: vitest unit (27) + e2e against real MongoDB (37). Mobile: jest (14). All passing at the start of the work | **Keep**, extend per phase |
| Data | Local DB has no business data (only the admin user) | Schemas can change **without a migration** |

---

## 2. Decisions taken with the owner

1. **Account ledger with advances.** Payments are made to the customer's account, not to a bill.
   `Balance = Opening balance + Σ Sales − Σ Payments`, always computed from the records and never carried forward by hand.
   A negative balance is a credit, shown as "Advance ₹X".
   Bill-wise status (Paid / Partial / Unpaid) is still shown, worked out by applying payments to the opening balance first and then to the oldest bills.
2. **Inventory is for tracking only.** Sales are **never blocked** by stock, and there are no extra prompts.
   Stock may go negative, for example when a sale is entered before its purchase. The numbers fix themselves when the backdated purchase is entered.
3. **Weight loss has two entry methods:** a manual **loss entry** (kg + reason) and an end-of-day **closing stock count**. The difference against book stock becomes a loss automatically.

---

## 3. Collections

All money is integer **paise** (`…Paise`) and all weight is integer **grams** (`…Grams`).
The API speaks rupees and kg, exactly as it does today. Every collection has `createdAt` / `updatedAt`.
Transaction dates (`purchaseDate`, `saleDate`, `paymentDate`, `expenseDate`, `date`) are calendar dates, and **reports always filter on these dates, never on createdAt**.

| Collection | Fields | Indexes |
|---|---|---|
| `users` | username (unique), passwordHash, tokenVersion | username |
| `settings` *(single document)* | businessName, defaultPurchaseRatePaise, defaultSaleRatePaise | – |
| `suppliers` | name, nameKey (normalised, **unique**), phone, address, notes, isActive | nameKey, name, phone |
| `customers` | name, nameKey (**unique**), phone, address, openingBalancePaise (signed), notes, isActive | nameKey, name, phone |
| `purchases` | supplierId→suppliers, purchaseDate, farmWeightGrams, receivedWeightGrams, ratePaise, totalAmountPaise, weightDifferenceGrams, notes | {supplierId, purchaseDate}, {purchaseDate} |
| `sales` | customerId→customers, saleDate, weightGrams, ratePaise, totalAmountPaise, **paidPaise** (FIFO-derived, cache), notes. COGS is read from the sale's `SALE_OUT` inventory row (single source of truth) | {customerId, saleDate}, {saleDate} |
| `payments` | customerId→customers, amount in rupees (>0), paymentMode CASH/UPI/BANK/OTHER, paymentDate, referenceNumber, notes, saleId? (only set when the payment was taken on the sale form, for display) | {customerId, paymentDate}, {paymentDate}, {paymentMode, paymentDate} |
| `expenses` | expenseDate, category (TRANSPORT, LABOUR, FEED, RENT, ELECTRICITY, FUEL, SALARY, MAINTENANCE, OTHER), amountPaise, paymentMode, notes | {expenseDate}, {category, expenseDate} |
| `inventoryTransactions` | date, type PURCHASE_IN / SALE_OUT / LOSS / STOCK_COUNT, sourceId (purchase/sale id), quantityGrams (input), countedGrams (STOCK_COUNT only), reason, **derived:** deltaGrams, valuePaise, balanceGrams, balanceValuePaise | {date, typeOrder, createdAt, _id}, {sourceId} (unique, sparse), {type, date} |
| `auditLogs` | entity, entityId, action CREATE/UPDATE/DELETE, before, after, userId, username, at | {entity, entityId, at}, {at} |

Rules enforced by DTO validation and schema validators:
* Weights > 0 (max 3 decimals), rates > 0, amounts > 0 (max 2 decimals). Opening balance may be negative (an advance).
* No future transaction dates. No negative or NaN values. Upper bounds keep values inside safe-integer range.
* Purchase `totalAmount = receivedWeight × rate`, `weightDifference = farmWeight − receivedWeight`. The difference can be negative (a scale gain) and is shown as-is.
* Sale `totalAmount = weight × rate`. Every rate is stored on the transaction itself, so changing defaults in Settings never alters history.
* Multiple sales per customer per day are allowed (no uniqueness on customer + date).
* Customers and suppliers with transactions cannot be hard-deleted. They are **deactivated** instead: hidden from pickers, still in reports.

---

## 4. Inventory & profit (weighted average cost)

There is one stock pool (live birds, in kg). Every stock movement is an `inventoryTransactions` row, ordered by
`(date, typeOrder, createdAt, _id)` with `typeOrder`: PURCHASE_IN = 1, SALE_OUT = 2, LOSS = 3, STOCK_COUNT = 4
(a closing count is the last event of its day).

**Replay.** The derived columns are recomputed by replaying rows in order, starting from the last row before the change, whenever a
purchase, sale, loss or count is created, edited or deleted. This runs **in the same DB transaction** as the change.
Editing an old entry therefore corrects every later cost, loss and profit figure automatically (business rule 8).

Moving weighted average, tracked by **value** so no rounding drift accumulates:

| Event | Quantity | Value |
|---|---|---|
| PURCHASE_IN | `+received` | `+ totalAmount` |
| SALE_OUT | `−weight` | `− round(balanceValue × weight / balanceQty)` = the sale's COGS |
| LOSS | `−kg` | same proportional value → **weight-loss cost** |
| STOCK_COUNT | `counted − bookBalance` | negative difference = loss at average cost; positive = gain at average cost |

When stock is ≤ 0, an outgoing movement is costed at the last known average rate (tracking only, never blocked).
A later purchase adds its full value, so total cost is always conserved:
`Σ purchases = Σ COGS + Σ weight-loss cost + closing stock value` (unit-tested).
Implementation: pure engine `inventory/costing.ts` + DB replay `inventory/inventory-ledger.service.ts`.
If no purchase exists at all, cost is ₹0 and the report flags "cost not available".

**Profit for a period** (by transaction date):
```
Sales revenue        = Σ sales.totalAmount
Cost of goods sold   = − Σ valuePaise of SALE_OUT rows
Gross profit         = Revenue − COGS
Weight-loss cost     = Σ value of LOSS + STOCK_COUNT shortfalls (gains reduce it)
Expenses             = Σ expenses.amount
Net profit           = Gross profit − Weight-loss cost − Expenses
```
Weight loss is reported **as its own line** (kg and ₹) and is not hidden inside COGS. Transit loss (farm − received weight) is
shown in kg only, because the supplier is paid on received weight and it has no cost effect.
Profit is never "today's sales − today's purchases".

---

## 5. Customer ledger

* **Balance** (any date) = `opening + Σ sales(saleDate ≤ d) − Σ payments(paymentDate ≤ d)`, computed with an aggregation.
* **Statement** (`from`–`to`): opening as of `from`, then each sale (debit) and payment (credit) in date order with a running balance, then the closing balance.
* **Bill status (FIFO)**: after any sale or payment change for a customer, their `sales.paidPaise` cache is recomputed in the same
  transaction. Total payments cover the opening balance first, then the oldest bills. This keeps Paid / Partial / Unpaid filters fast.
* "Received now" on the sale form still exists. It creates a normal payment dated on the sale date with `saleId` set.

---

## 6. Audit trail

Every create, update and delete of a purchase, sale, payment, expense, stock entry, customer, supplier or setting writes an `auditLogs` row
holding the before/after snapshot and the user, in the same transaction. The UI shows this as "History" on a record.
Transactions are hard-deleted (so reports stay simple), but the audit log keeps the deleted snapshot.

---

## 7. API (all JSON, rupees/kg, `Authorization: Bearer`)

| Module | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password` (existing) |
| Settings | `GET /settings`, `PATCH /settings` |
| Suppliers | `POST /suppliers`, `GET /suppliers?search=&active=`, `GET/PATCH/DELETE /suppliers/:id`, `POST /suppliers/:id/deactivate` / `activate`, `GET /suppliers/:id/purchases` |
| Purchases | `POST /purchases`, `GET /purchases?supplierId=&from=&to=&page=`, `GET/PATCH/DELETE /purchases/:id` |
| Customers | `POST /customers`, `GET /customers?search=&active=`, `GET/PATCH/DELETE /customers/:id`, `POST /customers/:id/deactivate` / `activate`, `GET /customers/:id/ledger?from=&to=` |
| Sales | `POST /sales` (optional `payment: {amount, mode, reference}`), `GET /sales?customerId=&from=&to=&status=&search=&page=`, `GET/PATCH/DELETE /sales/:id` |
| Payments | `POST /payments`, `GET /payments?customerId=&mode=&from=&to=&page=`, `GET/PATCH/DELETE /payments/:id` |
| Expenses | `POST /expenses`, `GET /expenses?category=&from=&to=&page=`, `GET/PATCH/DELETE /expenses/:id`, `GET /expenses/categories` |
| Inventory | `GET /inventory/stock?date=`, `GET /inventory/movements?from=&to=&type=`, `POST /inventory/losses`, `POST /inventory/stock-counts`, `PATCH/DELETE /inventory/:id` (loss/count only) |
| Dashboard | `GET /dashboard/summary?date=` |
| Reports | `GET /reports/summary?period=day\|week\|month\|custom&date=&from=&to=`, `GET /reports/customer-sales`, `GET /reports/customer-outstanding`, `GET /reports/supplier-purchases`, `GET /reports/payment-collections` (all take the date range) |
| Audit | `GET /audit?entity=&entityId=` |
| Health | `GET /health` |

Dashboard (for the chosen day): purchase (farm) weight, received weight, sold weight, purchase amount, sales revenue,
cash collection, online collection (UPI + Bank + Other), total customer outstanding, current stock, gross profit, expenses, recent transactions.

---

## 8. Consistency & transactions

Every write that touches more than one document runs inside `TransactionService.run()`: the entry, its inventory row, the inventory replay,
the customer FIFO recompute and the audit log.
**MongoDB must run as a replica set for this to be atomic.** Atlas does this by default; locally, use a single-node replica set (README §3).
The local MongoDB is currently standalone. A new env flag `REQUIRE_TRANSACTIONS=true` (default in production) makes the API refuse to start without one.

---

## 9. Mobile app

Same stack and patterns: `api/endpoints.ts` (HTTP only) → `api/hooks.ts` (React Query) → screens, with shared components in `components/ui.tsx`.

Bottom tabs (5): **Home · Purchases · Sales · Customers · More**
* **Home**: today's figures (§7), big quick-action buttons (Add Purchase, Add Sale, Receive Payment, Add Customer, Add Supplier), recent transactions.
* **Purchases**: list + filters, add/edit/delete, supplier picker with "add new".
* **Sales**: list + filters/status, add/edit/delete, optional "received now".
* **Customers**: search by name/mobile, balance badges, detail with ledger statement, Receive Payment, deactivate.
* **More**: Suppliers, Payments, Expenses, Stock (current stock, loss entry, closing count), Reports, Settings (business name, default rates, change password, logout).

UI rules: large touch targets (≥ 52 px), ₹ Indian grouping, "kg" on every weight, confirmation dialogs for every delete,
loading / empty / error states on every screen, no decorative animation.

---

## 10. Phase plan

| Phase | Scope |
|---|---|
| 2 ✅ | Shared infra: audit module, settings, inventory schema + replay engine, request context, `REQUIRE_TRANSACTIONS`. (Customer/sale/payment schema changes move to phases 4–5, together with their services, so every phase stays green.) |
| 3 | Suppliers + purchases (API + e2e) |
| 4 | Customers (new fields, deactivate) + sales with COGS (API + e2e) |
| 5 | Account-based payments, FIFO bill status, ledger statement (API + e2e) |
| 6 | Losses, stock counts, stock endpoints, profit calculation (API + e2e) |
| 7 | Expenses, dashboard, all reports (API + e2e) |
| 8 | Mobile: navigation, all screens, API layer |
| 9 | Full test pass, bug fixing, README/API docs update |

Out of scope unless requested: supplier payments/payables, multiple products/bird types, multi-user roles, offline mode.
