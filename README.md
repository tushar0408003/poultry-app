# Sales Ledger — Supplier Sales & Payment Management

A simple mobile app for a wholesale supplier who sells by weight (KG) to shops:
record a sale in seconds, take cash/online payments (in full, in part, or later),
see what every shop owes, and get daily / weekly / monthly reports.

```
backend/   NestJS 12 + MongoDB (Mongoose 9) REST API, JWT auth
mobile/    Expo SDK 58 + React Native 0.88 app (React Navigation, React Query, RHF + Zod)
docs/      API reference
```

---

## 1. Design decisions (read this first)

### Money is stored as integer paise, weight as integer grams
`₹200.50` is stored as `20050` (sale weight is stored in kg as entered). Integers are exact in
JavaScript and in MongoDB `$sum`, so totals never drift (no `0.1 + 0.2` errors).
The sale total is entered directly (there is no per-kg rate). Input is
parsed from its decimal *string*, never `x * 100`. The API itself speaks plain
rupees and kg (`"totalAmount": 10000`). The mobile app uses the same integer
math, so the live totals on the form always match what the server saves.
This was chosen over `Decimal128`, which is awkward in JS and in aggregations.

### Payments are the source of truth
Every rupee received is a separate `payments` record, never overwritten.
Each sale also keeps cached `cashPaid / onlinePaid / totalPaid / remaining` values,
for fast lists and filters. These are **recalculated from the payment records in the
same transaction** as every payment change.

| Source        | Created when                                                        | Payment date      |
|---------------|---------------------------------------------------------------------|-------------------|
| `SALE_ENTRY`  | Cash/online entered on the Add Sale form                            | = sale date       |
| `COLLECTION`  | A later payment (per sale, or a lump sum split across old sales)    | the day received  |

### Sales date vs. payment date (reports)
* **Sales** in a period = sales whose *sale date* is in the period.
* **Collections** in a period = payments whose *payment date* is in the period,
  for sales of any date. ₹2,000 received today for last week's sale counts in today's collection,
  not today's sales.
* **Outstanding balance** = the unpaid amount across *all* sales, right now.
  Reports also show "of this period's sales, ₹X is still unpaid".

### Dates are calendar dates
Sale/payment dates are `YYYY-MM-DD` (stored as 00:00 UTC of that day), so a sale on 3 Nov
is always reported on 3 Nov whatever the server's timezone. "Today" is
decided in IST (`BUSINESS_TZ_OFFSET_MINUTES=330`). Weeks run Monday–Sunday.

### Business-logic problems found in the requirements, and how they're handled
| Problem | Resolution |
|---|---|
| Cash/online on the sale form vs. a separate payment system | They become `SALE_ENTRY` payment records, so one ledger holds everything |
| Editing a sale's amount below what's already paid | Rejected with a clear message (`Total payment ₹7,000 cannot be more than sale amount ₹6,000`) |
| Editing cash/online on an old sale | Replaces only the `SALE_ENTRY` amounts. Later collections are untouched |
| Moving a sale date after one of its payments | Rejected. `SALE_ENTRY` payments move with the sale date |
| Changing a sale's customer | All of that sale's payments move to the new customer atomically |
| Deleting a sale | Its payments are deleted in the same transaction (the app's confirmation lists them) |
| A wrongly typed payment | `DELETE /payments/:id` removes it and restores the balance (extra endpoint) |
| Shops pay "against their account", not per bill | `POST /payments/allocate` splits a lump sum over the oldest unpaid sales (FIFO), one record per sale (extra endpoint) |
| Overpayment / advance payment | Not allowed anywhere (no advance workflow) |
| Two payments at the same moment | Transactions + write conflicts → the loser retries and is re-validated (tested) |
| Deleting a customer with history | Blocked (409), so no sale is ever orphaned |
| Duplicate shops ("Sharma Store" vs "sharma  store") | Prevented with a normalised unique key |
| Future-dated sales/payments, payment before the sale date | Rejected |
| A total price of ₹0 | Rejected |
| "Customer name required if customer-wise tracking" | Always on: every sale needs a customer, but a new shop can be added from the sale form by typing its name |

### Transactions
Multi-document writes (sale + payments, payment + sale totals) run in MongoDB
transactions, which need a **replica set**. On a standalone server the API still works
and logs a warning. Every input is validated before the first write, so only a
crash mid-request could leave a partial update. **Use a replica set in production**
(MongoDB Atlas is one by default; for a local install see §3).

---

## 2. Database

```
customers 1 ──< sales 1 ──< payments
    1 ────────────────────────< payments   (customerId denormalised for per-customer history)
```

| Collection | Fields | Indexes |
|---|---|---|
| `customers` | shopName, shopNameKey (normalised, **unique**), ownerName, phone, address, createdAt, updatedAt | shopNameKey, shopName |
| `sales` | customerId, saleDate, weight (kg, double), totalAmountPaise, cashPaid, onlinePaid, totalPaid, remaining (all paise), notes, createdAt, updatedAt | {customerId, saleDate}, {saleDate, createdAt}, remaining |
| `payments` | saleId, customerId, amountPaise, paymentMode (CASH/ONLINE), paymentDate, transactionReference, source (SALE_ENTRY/COLLECTION), createdAt | saleId, {customerId, paymentDate}, {paymentDate, createdAt} |
| `users` | username (unique), passwordHash (bcrypt, 12 rounds), tokenVersion | username |

Invariant, enforced in code and covered by tests:
`sale.totalPaidPaise = Σ payments.amountPaise` and `remainingPaise = totalAmountPaise − totalPaidPaise ≥ 0`.

---

## 3. Setup

### Requirements
* Node.js **22.12+** (NestJS 12 is ESM-only; the API is compiled to CommonJS and relies on `require(esm)`)
* MongoDB 7+ (local or Atlas)
* For Android builds: a free Expo account (EAS cloud build), or Android Studio for local builds

### MongoDB
**Option A: MongoDB Atlas (easiest for production).** Create a free cluster, add a database user,
allow your server's IP, and copy the connection string into `MONGODB_URI`. Transactions work out of the box.

**Option B: local MongoDB as a single-node replica set (recommended locally).**
1. Open `C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg` as Administrator and add:
   ```yaml
   replication:
     replSetName: rs0
   ```
2. Restart the service in an **Administrator** PowerShell: `Restart-Service MongoDB`
3. From `backend/`: `node scripts/init-replica-set.js`
4. Set `MONGODB_URI=mongodb://127.0.0.1:27017/supplier_ledger?replicaSet=rs0`

**Option C: local standalone MongoDB.** Works with no changes (`mongodb://127.0.0.1:27017/supplier_ledger`),
but without transactions.

### Backend
```bash
cd backend
npm install
cp .env.example .env        # then edit: JWT_SECRET, ADMIN_PASSWORD, MONGODB_URI
npm run start:dev           # http://localhost:3000  (GET /health to check)
```
On first start the admin user is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
Production: `npm run build && npm run start:prod`, behind HTTPS (e.g. Nginx/Caddy, or a PaaS such as Render/Railway).

### Mobile app
```bash
cd mobile
npm install
cp .env.example .env        # set EXPO_PUBLIC_API_URL (see below)
npx expo run:android        # builds a development app on an emulator / USB-connected phone
# or, without Android Studio:
npx eas-cli@latest build --profile development --platform android
npx expo start              # then open the installed dev app
```
`EXPO_PUBLIC_API_URL`:
* Android emulator → backend on this PC: `http://10.0.2.2:3000`
* Phone on the same Wi-Fi: `http://<PC LAN IP>:3000` (find it with `ipconfig`; allow port 3000 in Windows Firewall)
* Production: `https://api.your-domain.com`

> The app uses native modules (secure storage, date picker), so use a development build
> as above rather than the Expo Go app.

---

## 4. Android release build

The build settings are in `mobile/eas.json`. First set `EXPO_PUBLIC_API_URL` for the `preview` /
`production` profiles to your real server.

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview      # installable .apk to share/sideload
npx eas-cli@latest build --platform android --profile production   # .aab for the Google Play Store
npx eas-cli@latest submit --platform android                       # optional: upload to Play Console
```
EAS creates and keeps the signing keystore for you. For a local build instead:
`npx expo prebuild -p android && cd android && ./gradlew assembleRelease` (needs Android Studio + JDK 17).

Before publishing:
* Bump `expo.version` / `expo.android.versionCode` in `app.json` on every release.
* Replace the placeholder icons in `mobile/assets/`.
* `usesCleartextTraffic` is enabled in `app.json` so the app can reach a LAN backend over plain HTTP.
  If your API is HTTPS-only, remove the `expo-build-properties` entry.

---

## 5. Tests

```bash
cd backend
npm test                     # unit: money math, rounding, dates/weeks/months (27 tests)
npm run test:e2e             # API + real MongoDB: every business rule above (37 tests)
#   uses mongodb://127.0.0.1:27017/supplier_ledger_e2e by default (DROPPED each run)
#   MONGODB_URI_TEST="mongodb://127.0.0.1:27017/supplier_ledger_e2e?replicaSet=rs0" npm run test:e2e
#   also runs the concurrent-payment test (replica set only)

cd mobile
npm test                     # client money math + sale form validation (14 tests)
npm run typecheck && npx expo lint
```

---

## 6. Using the app

* **Dashboard:** today's weight, sales, cash, online, total received, and outstanding across all shops.
  Pick a date to see another day. Shows this week, this month, recent sales and payments.
  The 👥 icon opens **Customers**.
* **Add Sale:** pick or type a shop, enter weight and total price. Received and balance update as you type.
  "Full cash" / "Full online" / "Not paid" fill the payment in one tap.
  After saving, the date stays filled in for the next sale.
* **Transactions:** search, filter by date / customer / Paid-Partial-Unpaid. Tap a sale to see its payment history,
  **Add payment**, **Edit**, or **Delete**.
* **Reports:** Daily / Weekly / Monthly / Custom, with sales and collection charts and a comparison with the previous period.
* **Customer profile:** totals, outstanding, sales and payment history, and **Receive payment** (a lump sum applied to the oldest bills first).

See [docs/API.md](docs/API.md) for the REST API.
#   p o u l t r y - a p p  
 