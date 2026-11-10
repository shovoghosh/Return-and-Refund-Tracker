# Return Tracker

Track online purchases, get reminded before each store's return deadline, and confirm for
yourself when the refund actually arrives.

Return Tracker is a product of **MXSXLAB Inc.** Contact: **contact@mxsxlab.com**.

Runs on **Cloudflare Workers** (via OpenNext), with **D1** for data, **R2** for private
attachments, **Resend** for email, and a **Cron Trigger** for reminders.

The working name is "Return Tracker" — see `DECISIONS.md` before using it publicly.

## What it does

- Add a purchase in under 30 seconds: item name, store, purchase date, return-by date, plus
  optional order number, amount, currency, link, notes, tags, and a receipt.
- Reminders 7, 2, and 1 day before the deadline (and on the day itself), at a local hour you
  choose, in the time zone you choose. Every offset can be turned off.
- Track the return through **Open → Return started → Returned → Refund pending → Refund
  received** (or **Kept**), with carrier, tracking number, and proof.
- A dashboard split into needs attention, upcoming deadlines, refunds pending, and all
  purchases, with search, status filters, and deadline sorting.
- An in-app notification centre, a visible event history, CSV/JSON export, and account
  deletion that removes uploads too.

## What it deliberately does not do

- No inbox access, receipt scraping, or automatic order import.
- No guessing a store's return policy: the deadline is the date you entered.
- No bank or card connection, and no claim that a refund arrived. Only the user confirms it.
- No analytics or advertising scripts.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16.4 (App Router, server actions) |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (SQLite), Prisma with `@prisma/adapter-d1` |
| Attachments | R2 bucket, served through an authenticated route |
| Email | Resend HTTP API (nodemailer cannot open SMTP from Workers) |
| Reminders | Worker Cron Trigger every 5 minutes → `POST /api/cron/reminders` |

## Requirements

- **Node.js ≥ 20.9** (`.nvmrc` pins 22 for CI).
- A **Cloudflare account** with `wrangler` access.
- **Workers Paid** is recommended: password hashing (bcrypt cost 12) costs far more than the
  free plan's 10 ms CPU budget per request. D1 and R2 have free tiers.
- Optional: a **Resend** account and API key for real email delivery.

## Architecture

```
Browser ──► Worker (OpenNext: SSR, server actions, route handlers)
                │
                ├─► D1 (Prisma adapter)      users, items, returns, reminders
                ├─► R2 (binding UPLOADS)     receipts and return proof
                ├─► Resend (HTTPS)           verification + reminder email
                └─► Cron Trigger ──► POST /api/cron/reminders (self-call)
```

Every query is scoped by the `userId` taken from the session cookie; the client never supplies
ownership. D1 has no interactive transactions, so multi-step writes in `src/lib/dal` run
sequentially (see "Known limits").

## Local development

```bash
npm install            # also runs `prisma generate`
cp .env.example .env   # then set SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run d1:local       # create the local D1 schema (once, and after schema changes)
npm run dev            # http://localhost:3000 — Next dev with local D1/R2 bindings
```

`next dev` gets its bindings through `initOpenNextCloudflareForDev()` in `next.config.ts`, so
uploads go to a local R2 emulation and data to a local D1 database under `.wrangler/`. With
`RESEND_API_KEY` empty, email is printed to the terminal.

To run the actual Worker bundle locally (closer to production):

```bash
cp .dev.vars.example .dev.vars   # wrangler reads this, not .env
npm run preview                  # builds, then serves on http://localhost:8787
```

## Environment variables

Runtime values live in `.dev.vars` for `wrangler`/preview and `.env` for `next dev`/Prisma CLI.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SESSION_SECRET` | yes | — | ≥16 chars; HMAC key for session and token hashes. Rotating it signs everyone out. |
| `APP_URL` | yes in production | `http://localhost:3000` | Public origin. Used for links in emails and by the cron self-call. |
| `RESEND_API_KEY` | no | empty | Empty = log email to stdout instead of sending. |
| `EMAIL_FROM` | no | `Return Tracker <contact@mxsxlab.com>` | Must be a verified Resend sender. |
| `SUPPORT_EMAIL` | no | `contact@mxsxlab.com` | Address on the contact/privacy/terms pages. |
| `CRON_SECRET` | yes in production | empty | When set, the cron endpoint requires `Authorization: Bearer <secret>`. |
| `UPLOAD_DIR` | no | `./uploads` | Only the `next dev` disk fallback; Workers always use R2. |
| `MAX_UPLOAD_MB` | no | `10` | Per-file cap. |
| `MAX_FILES_PER_ITEM` | no | `5` | Per-item attachment cap. |
| `DATABASE_URL` | CLI only | `file:./prisma/dev.db` | Prisma CLI (`generate`, `migrate diff`). Unused at runtime. |

Bindings (not environment variables) are configured in `wrangler.jsonc`: `DB` (D1) and
`UPLOADS` (R2).

## Database and migrations

`prisma/schema.prisma` is the source of truth. Because D1 is not reachable from the Prisma
CLI, the workflow is diff → SQL → `wrangler d1 execute`:

```bash
npm run db:sql        # regenerate prisma/d1/0001_init.sql from the schema
npm run d1:local      # apply it to the local D1 database
npm run d1:remote     # apply it to the production D1 database (needs wrangler login)
```

After the first deploy, future schema changes should be captured as a new file (for example
`prisma/d1/0002_add_field.sql`) and applied in order; `0001_init.sql` creates from empty.

SQLite has no enum or date column types: statuses are strings validated in `src/lib/status.ts`
and `src/lib/reminders.ts`, and calendar dates are stored as `DateTime` at UTC midnight.

## Attachments

Uploads are written to the R2 bucket bound as `UPLOADS`. Downloads go through
`/api/uploads/<key>`, which re-checks that the row belongs to the signed-in user before reading
the object. The bucket is never public and needs no custom domain.

## Reminders

`custom-worker.ts` wraps OpenNext's fetch handler and adds a `scheduled` handler. On the cron
schedule it calls the app's own `POST /api/cron/reminders` (with `CRON_SECRET`) — the endpoint
already owns the idempotent claim/send logic, so there is only one implementation.

Deliveries are materialised as `ReminderDelivery` rows with a unique key on
`(itemId, reminderType, scheduledFor)` and claimed with a conditional `PENDING → SENT` update,
so a retry or a second worker cannot double-send.

Test the trigger locally:

```bash
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

## Tests and checks

```bash
npm test            # vitest, 105 tests
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # OpenNext build (what Workers Builds runs)
npm run build:next  # plain `next build` for a quick check
npm run preview     # OpenNext build + workerd preview
```

Tests build a throwaway SQLite database from the same DDL that ships to D1 and inject a
`better-sqlite3` adapter (`tests/setup.ts`), so they exercise the production schema. No
database service is needed to run them.

The suite focuses on what would lose money or trust: cross-user access on every DAL function,
reminder idempotency and suppression after a status change, DST-correct scheduling, upload
validation (extension, declared type, magic bytes, size), export scoping, and account deletion
purging storage keys.

## One-time Cloudflare setup

This repository is already wired to the project's D1 database and R2 bucket (see
`wrangler.jsonc`). The commands below are what was run once, and what a fork must repeat with
its own resource names and ids.

```bash
npx wrangler login

# 1. Database — copy the printed database_id into wrangler.jsonc
npx wrangler d1 create return-tracker

# 2. Private attachment bucket
npx wrangler r2 bucket create return-tracker-uploads

# 3. Schema
npm run d1:remote

# 4. Secrets (prompted; never commit them)
npx wrangler secret put SESSION_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CRON_SECRET

# 5. Set APP_URL in wrangler.jsonc to the deployed origin, then deploy
npm run deploy
```

`SESSION_SECRET`: 32 random bytes as hex. `CRON_SECRET`: any long random string; the scheduled
handler sends it automatically.

## Deploying from GitHub (Workers Builds)

1. Push this repository to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Workers → Connect to Git**, and
   pick the repository.
3. Build settings:
   - **Build command:** `npm run build` (runs the OpenNext build; `prisma generate` runs in `postinstall`)
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/`
   - **Node version:** 22 (a `.nvmrc` is included)
4. Save the Worker. `wrangler.jsonc` supplies the D1/R2 bindings, the entry point
   (`custom-worker.ts`) and the cron schedule.
5. Add the runtime secrets under the Worker's **Settings → Variables and Secrets**
   (`SESSION_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`). `APP_URL` stays in `wrangler.jsonc`
   because it must match the deployed origin.
6. After the first successful deploy, set `APP_URL` to the real `*.workers.dev` or custom
   domain URL and redeploy. The cron self-call uses it.

Each push to the connected branch rebuilds and deploys. Migrations are **not** run by the
build; apply them deliberately with `npm run d1:remote` before or after deploying a schema
change.

## Deployment checklist

- [ ] `wrangler.jsonc` has the real D1 `database_id` and the R2 bucket name.
- [ ] `APP_URL` matches the deployed origin (`https://…`); links in email depend on it.
- [ ] `SESSION_SECRET` is fresh, random, and stored as a Worker secret.
- [ ] `CRON_SECRET` is set; the cron endpoint returns 401 without it.
- [ ] `prisma/d1` migrations have been applied to the production D1 database.
- [ ] `RESEND_API_KEY` is set and `EMAIL_FROM` uses a verified Resend sender.
- [ ] Send one real verification email and one reminder to a test account; check spam.
- [ ] Trigger the scheduled handler once and confirm a `sent`/`skipped` summary in the logs.
- [ ] Add Workers Logs/observability alerts for 5xx and for repeated reminder failures.
- [ ] Enable D1 backups (Time Travel is built in; verify retention meets your needs).
- [ ] Have the privacy and terms pages reviewed for your jurisdiction before public launch.
- [ ] Run the plan's manual checks on a narrow phone, desktop, and keyboard-only navigation.

## Known limits

- **No interactive D1 transactions.** Multi-step DAL writes run sequentially; a mid-way
  failure can leave a partial write. Single-statement writes are unaffected.
- **Rate limiting is per isolate.** `src/lib/rate-limit.ts` is in memory; a multi-instance
  deployment needs Durable Objects, KV, or Cloudflare's Rate Limiting binding for a hard limit.
- **Workers Paid for password hashing.** bcrypt cost 12 exceeds the free plan's 10 ms CPU.
- **Reminder delivery is at-most-once.** A crash between claiming and sending loses that one
  message rather than risking a duplicate.
- Day-scale reminders only (no SMS, push, or native app). No paid tier or retailer integrations.

## Documentation

- `RETURN_REFUND_TRACKER_PLAN.md` — product scope, journeys, and the phase plan.
- `DECISIONS.md` — stack, database, auth, money, deadlines, idempotency, storage, email.
