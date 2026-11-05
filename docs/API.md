# API reference

Base URL: `http://<host>:3000`. JSON in, JSON out.
Money is in **rupees** (max 2 decimals) and weight in **kg** (max 3 decimals). Dates are `YYYY-MM-DD`.
Every endpoint except `POST /auth/login` and `GET /health` needs `Authorization: Bearer <accessToken>`.

### Errors
```json
{ "statusCode": 400, "error": "BAD_REQUEST", "message": "Total payment (₹11,000) cannot be more than the sale amount (₹10,000)", "path": "/sales", "timestamp": "..." }
```
`message` can be a string or a list of strings. Codes: `400` validation/business rule, `401` not logged in,
`404` not found, `409` conflict (duplicate shop, customer has sales), `429` too many login attempts.

---

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/login` | `{ username, password }` | `{ accessToken, user: { id, username } }` (limit 10/min) |
| GET | `/auth/me` | | `{ id, username }` |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` (min 8) | `{ accessToken }`. Older tokens stop working |

## Customers
| Method | Path | Notes |
|---|---|---|
| POST | `/customers` | `{ shopName*, ownerName?, phone?, address? }`. 409 if the shop name exists (case/space-insensitive) |
| GET | `/customers?search=` | All customers (search matches shop, owner, phone), with `stats` |
| GET | `/customers/:id` | Customer + `stats` |
| PATCH | `/customers/:id` | Any of the create fields |
| DELETE | `/customers/:id` | 409 if the customer has sales |

`stats`: `{ salesCount, totalWeight, totalSales, totalPaid, outstandingBalance, lastSaleDate }`

## Sales
**POST `/sales`**
```json
{ "customerId": "…", "saleDate": "2026-11-03", "weight": 50, "ratePerKg": 200,
  "cashReceived": 2000, "onlineReceived": 3000, "onlineReference": "UPI123", "notes": "" }
```
`saleDate` defaults to today (IST). `cashReceived`/`onlineReceived` default to 0 and become payment records.
Rules: weight > 0, rate > 0, payments ≥ 0, cash + online ≤ total, no future dates.

Response (also returned by GET/PATCH `/sales/:id`):
```json
{ "id": "…", "customerId": "…", "customer": { "id": "…", "shopName": "…", "ownerName": "", "phone": "" },
  "saleDate": "2026-11-03", "weight": 50, "ratePerKg": 200, "totalAmount": 10000,
  "cashReceived": 2000, "onlineReceived": 3000, "totalPaid": 5000, "remainingBalance": 5000,
  "status": "PARTIAL", "notes": "", "createdAt": "…", "updatedAt": "…",
  "payments": [ { "id": "…", "amount": 2000, "paymentMode": "CASH", "paymentDate": "2026-11-03", "source": "SALE_ENTRY", … } ] }
```
`cashReceived` / `onlineReceived` / `totalPaid` include all payments for the sale, later ones too.

| Method | Path | Notes |
|---|---|---|
| GET | `/sales` | Query: `search, customerId, date, from, to, status=PAID\|PARTIAL\|UNPAID, page=1, limit=20 (≤100)`. Returns `{ items, total, page, limit, hasMore }`, newest first |
| GET | `/sales/:id` | Sale + full payment history |
| PATCH | `/sales/:id` | Any create field. `cashReceived`/`onlineReceived` replace the amounts received *at the time of sale*. Rejected if the new total < amount already paid, or the new date is after an existing later payment |
| DELETE | `/sales/:id` | Deletes the sale and its payments atomically → `{ deleted, paymentsDeleted }` |

## Payments
| Method | Path | Notes |
|---|---|---|
| POST | `/payments` | `{ saleId, amount, paymentMode: CASH\|ONLINE, paymentDate?, transactionReference? }` → `{ payment, sale }`. Rejected if amount > balance, date before the sale or in the future |
| POST | `/payments/allocate` | `{ customerId, amount, paymentMode, paymentDate?, transactionReference? }`: lump sum split over the oldest unpaid sales (dated on/before `paymentDate`) → `{ payments, totalAllocated }` |
| GET | `/payments` | Query: `customerId, paymentMode, date, from, to, page, limit`, filtered by **payment date** |
| GET | `/payments/:saleId` | All payments of one sale, oldest first |
| GET | `/payments/customer/:customerId` | Paginated payment history of a customer |
| DELETE | `/payments/:id` | Removes a wrong entry and restores the sale's balance → `{ deleted, sale }` |

## Reports
| Path | Period |
|---|---|
| `GET /reports/daily?date=` | that day (default today) |
| `GET /reports/weekly?date=` | Monday–Sunday week containing `date` |
| `GET /reports/monthly?date=` | calendar month containing `date` |
| `GET /reports/custom?from=&to=` | inclusive range, max 731 days |

```json
{ "kind": "week", "from": "2026-11-02", "to": "2026-11-08",
  "sales":       { "count": 12, "totalWeight": 640.5, "totalAmount": 128100, "paidSoFar": 101000, "stillUnpaid": 27100 },
  "collections": { "count": 15, "cash": 70000, "online": 41000, "total": 111000 },
  "currentOutstanding": { "amount": 45200, "customers": 6, "sales": 9 },
  "previous":   { "from": "2026-10-26", "to": "2026-11-01", "sales": { … }, "collections": { … } },
  "comparison": { "totalWeight": 12.5, "totalSales": 8.1, "totalCollected": -3.4 },
  "series": { "granularity": "day", "points": [ { "label": "2026-11-02", "weight": 90, "sales": 18000, "cash": 9000, "online": 6000, "collected": 15000 } ] } }
```
* `sales`: by **sale date**. `paidSoFar` / `stillUnpaid` show how much of *these* sales is paid today.
* `collections`: by **payment date**, for sales of any date.
* `currentOutstanding`: unpaid across **all** sales right now (not limited to the period).
* `comparison`: % change vs the previous period (`null` when the previous value was 0).
* `series`: daily points for ranges ≤ 62 days, otherwise monthly (`"label": "2026-11"`).

## Dashboard
`GET /dashboard/summary?date=` (default today)
```json
{ "date": "2026-11-03", "isToday": true,
  "day": { "totalWeight": 120, "totalSales": 24000, "salesCount": 4, "cashReceived": 12000, "onlineReceived": 6000, "totalReceived": 18000 },
  "currentOutstanding": { "amount": 45200, "customers": 6, "sales": 9 },
  "week": { /* PeriodSummary */ }, "month": { /* PeriodSummary */ },
  "recentSales": [ /* 8 latest sales on/before date */ ], "recentPayments": [ /* 5 latest payments */ ] }
```
`cashReceived` / `onlineReceived` are payments **dated that day**, including payments for older sales.

## Settings
| Method | Path | Notes |
|---|---|---|
| GET | `/settings` | `{ businessName, defaultPurchaseRate, defaultSaleRate, updatedAt }` (defaults on first use) |
| PATCH | `/settings` | Any of `businessName`, `defaultPurchaseRate`, `defaultSaleRate` (₹, 0 = none). Default rates only pre-fill forms |

## Audit
`GET /audit?entity=&entityId=&page=&limit=`: change history, newest first.
`entity`: customer, supplier, purchase, sale, payment, expense, stock, settings.
Each item: `{ id, entity, entityId, action: CREATE|UPDATE|DELETE, before, after, changedFields, username, at }`
(snapshots are in stored units: paise / grams).

## Health
`GET /health` → `{ "status": "ok", "database": "connected" }` (no auth)
