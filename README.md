# TaxJar

**Know what's really yours to spend.** TaxJar is a tax set-aside tracker for South African drivers, couriers and freelancers. Every time money lands in your account it works out how much to put aside for SARS, and shows a live *safe balance*.

Gig workers don't have an employer withholding tax, so many face a huge bill at year end. Existing tools are either too generic or built for accountants. TaxJar is built for the person who just wants one number.

## Features

- **Real progressive tax**: SARS 2026/27 brackets, the primary rebate and retirement annuity deduction, not a flat percentage.
- **Live safe balance** that updates as you type, before you save anything.
- **Expenses with categories** (petrol, data, repairs...) that lower taxable income, so tax is released from your pot.
- **Refunds** hand back the tax set aside on that money.
- **Tax savings tracker**: log money moved to your tax account and see if you are covered or short.
- **Provisional tax countdown** with the next due date and estimated amount.
- **Month-by-month chart**, one-tap repeat of common entries, and **undo** for removals.
- **CSV import** from a bank statement and **CSV export** for your accountant.
- **Accounts** (email and password), private data per user, live updates across tabs and devices.
- Light and dark theme, installable on a phone (PWA), print-friendly, accessible controls.

## Tech

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, plain CSS, inline SVG chart |
| Backend | Node.js, Express |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Live updates | Server-Sent Events |
| Auth | scrypt password hashes, HMAC-signed httpOnly cookie |
| Security | helmet (CSP), rate-limited login, same-origin write check, validated input |
| Tests | `node:test`, 28 tests incl. API integration tests |
| Delivery | Dockerfile, Render blueprint, GitHub Actions CI |

## How it fits together

```
Browser (React)  --fetch-->  Express API  -->  SQLite
     ^                           |
     +------ Server-Sent Events -+   (changes pushed to every open tab)

server/tax/engine.js     progressive tax maths (pure functions)
server/tax/ledger.js     totals, safe balance, previews, validation
server/tax/rules/*.json  SARS rates by tax year (picked by today's date)
```

The tax code is pure and shared. The same files run on the server and in the static demo (`npm run build:demo`), so the two cannot drift apart.

## Run it

Needs **Node.js 22 or newer**. The project's `.npmrc` turns off install scripts so the SQLite library uses its bundled prebuilt binary (no C++ compiler needed).

```bash
npm install
npm run dev                  # API on :4999, app on http://localhost:5173
npm run build && npm start   # everything on http://localhost:4999
npm test                     # 28 tests
npm run build:demo           # one-file static demo in dist-demo/
npm run backup               # safe SQLite backup (keeps the newest 14)
```

Copy `.env.example` to `.env` for production settings. `SESSION_SECRET` is **required** in production.

## Deploy

**Docker:** `docker build -t taxjar . && docker run -p 4999:4999 -e SESSION_SECRET=... -e NODE_ENV=production -v taxjar-data:/app/data taxjar`

**Render:** New > Blueprint, pick the repo (`render.yaml` creates the service and a 1 GB disk for the database). Serve over HTTPS: cookies are marked `secure` in production.

## API

| Method and path | Purpose |
|---|---|
| `POST /api/auth/signup`, `/login`, `/logout` | Accounts |
| `GET /api/state` | Everything the screen needs |
| `GET /api/events` | Live stream (SSE) |
| `PUT /api/profile` | Yearly figures, recalculates the rate |
| `POST /api/entries` | Log payment, expense, refund or saving |
| `POST /api/entries/bulk` | CSV import, all-or-nothing |
| `DELETE /api/entries/:id` | Remove an entry |
| `POST /api/preview` | "What if I logged this?", saves nothing |
| `GET /api/export.csv` | Download your data |
| `DELETE /api/account` | Delete the account and all its data |
| `GET /api/healthz` | Health check |

## Design decisions

- **Projected rate, not year-to-date.** Early in the year the rebate absorbs the first ~R99 000 of profit, so a year-to-date rate would swing wildly. The set-aside uses the rate from your projected year and a 2% safety margin; the year-to-date figure is shown as an extra reading.
- **Expense relief is computed on the total**, not per item, so it follows the brackets exactly.
- **Rates are data, not code.** Add `server/tax/rules/za-2028.json` and it takes over on 1 March 2027. If no file matches today, the app shows a warning instead of silently using old rates.
- **SQLite** is plenty for a single-server app and makes deployment trivial. Swapping to Postgres only touches `server/db.js`.

## Limits

- An estimate for an individual under 65, no medical credits, expenses assumed fully deductible. Not tax advice.
- Rates are updated by hand (SARS has no API). Verify against sars.gov.za each Budget.
- Receipt photos, bank-feed syncing and multi-currency are not built.
- No email verification or password reset yet.

MIT licensed.
