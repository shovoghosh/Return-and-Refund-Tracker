# Decisions

Recorded as required by the build plan ("record each significant choice in a short DECISIONS.md").
Newest first.

## D11 — Hosting: Cloudflare Workers + D1 + R2 + Resend (supersedes D1, D2, D7, D8, D9)

The app had to run on Cloudflare Workers, deployed automatically from GitHub. Workers cannot
open raw Postgres or SMTP connections, cannot write to local disk, and forbid compiling
WebAssembly during a request, so several earlier decisions were replaced:

- **Adapter: OpenNext (`@opennextjs/cloudflare`), not vinext.** Cloudflare now recommends
  vinext for new Next apps, but this app already uses server actions, route handlers, and
  dynamic segments; OpenNext supports them today. OpenNext 1.20 requires Next `>=16.4.5`, so
  Next was upgraded from 16.3.8 to 16.4.5 (tests/lint/typecheck stayed green).
- **Database: Cloudflare D1 (SQLite).** Chosen over hosted Postgres because it needs no
  third-party account and keeps the deploy self-contained. The schema moved from PostgreSQL to
  SQLite: enums became `String` with unions in `src/lib/status.ts` and `src/lib/reminders.ts`,
  `@db.Date`/`@db.Char` were dropped (calendar dates are `DateTime` at UTC midnight), and
  `Event.metadata`/`User.reminderOffsets` are JSON strings parsed at the boundary.
- **Prisma must use the classic generator at the default output.** OpenNext only copies
  Prisma's `workerd` build for packages generated in `node_modules/.prisma/client`, and Next
  must treat it as external (`serverExternalPackages: ["@prisma/client", ".prisma/client"]`).
  A custom output under `src/generated` made Turbopack bundle Prisma's `.wasm?module` import,
  which globbed the whole project (768 MB trace) and produced a 13.5 MB gzipped Worker. With
  the supported layout the bundle is ~2.4 MB gzipped.
- **D1 has no interactive transactions.** `prisma.$transaction(async …)` throws on D1, so the
  DAL runs multi-step writes sequentially. This is a real weakening of atomicity; single
  statements are unaffected, and `createPurchase` remains the only flow where a partial write
  would be user-visible (an order without its item).
- **Attachments: R2** (`UPLOADS` binding). `src/lib/storage.ts` keeps the disk fallback for
  `next dev` and tests, and the download route still checks ownership before reading.
- **Email: Resend HTTP API.** `src/lib/mail.ts` posts to `api.resend.com`; nodemailer was
  removed because Workers cannot open SMTP. Empty `RESEND_API_KEY` logs to stdout for dev.
- **Reminders: Worker Cron Trigger.** `custom-worker.ts` re-exports OpenNext's fetch handler
  and adds `scheduled`, which calls `POST /api/cron/reminders` with `CRON_SECRET`. One
  implementation of the idempotent send logic, no separate deployment.
- **Tests run on the production schema.** `tests/setup.ts` applies the same DDL that ships to
  D1 to a throwaway SQLite file and injects a `better-sqlite3` adapter, so the 105 tests do not
  need a database service. `better-sqlite3` is pinned to v13 via `overrides` because v11 has no
  Node 24 prebuild and this machine has no MSVC toolchain.
- **Workers Paid is required in practice.** bcrypt cost 12 takes hundreds of milliseconds of
  CPU, far above the free plan's 10 ms per-request budget. D1 and R2 free tiers are fine.

D1's 10 GB database limit, D1's per-query limits, and the absence of interactive transactions
are the accepted trade-offs for zero-account, edge-native deployment.

## D10 — Public info pages; privacy and terms are drafts pending review

`/help`, `/contact`, `/privacy`, and `/terms` are public (no session) so a visitor can judge the
product and its data handling before signing up, as the plan requires. The support address is
`SUPPORT_EMAIL` in the environment rather than a literal in the UI, and the contact page renders
per request (`force-dynamic`) so changing the address does not require a rebuild.

The privacy and terms pages describe what the code actually does today — including the honest
caveats (backup rotation, at-most-once email, private R2 storage). They are plain-language
**drafts**: the plan calls for jurisdiction-appropriate documents reviewed before public launch,
and that review has not happened. Treat them as a starting point, not as cleared legal copy.

## D9 — Local database control moved into `scripts/db.mjs` (removed in D11)

D2's raw `pg_ctl` commands did not survive `npm run` on Windows: npm executes scripts through
`cmd.exe`, where the MSYS path `/c/Program Files/...` is not resolvable, so `npm run db:start`
failed with "The system cannot find the path specified". The scripts now call a small Node helper
that resolves `pg_ctl` itself (matching `.pgdata/PG_VERSION` first, since a newer server cannot
open an older data directory, then any complete install, then `PATH`), and that does not pipe
stdio — a started `postgres` inherits pg_ctl's handles, so a pipe would never close and the
command would hang after the server was already up.

## D1 — Stack: Next.js 16 (App Router) + Prisma 6 + PostgreSQL (superseded by D11)

Chosen because it satisfies every MVP requirement with the simplest maintained
option: server routes for auth/ownership, a relational store with real
constraints for the ownership rules, and a single language across UI and server.
Tailwind v4 is used directly rather than a design system, per the plan's
instruction not to spend the first phase on a large design system.

## D2 — Database: dedicated local cluster on port 5433 (removed in D11)

The host already runs PostgreSQL 15 on 5432, but the `postgres` superuser
password is not available and the existing `portfolio` role cannot create
databases. Rather than guess credentials on the user's cluster, a dedicated
cluster was initialised with `initdb` and runs on **port 5433** (data dir
`.pgdata/`, ignored by git). Production uses a managed Postgres with
`DATABASE_URL`.

Start/stop the dev cluster:
```
npm run db:start
npm run db:stop
```
(Both wrap `scripts/db.mjs`; see D9 for why.) Note: keep the server log OUTSIDE the data
directory — a log file inside PGDATA causes a Windows sharing violation during crash recovery.
The helper writes `.pgdata-server.log` at the repository root, which is git-ignored.

## D3 — Auth: custom email/password with hashed server sessions

The plan allows "a maintained authentication library/service". A small custom
implementation was chosen over NextAuth because the ownership model needs every
query scoped to a server-derived user id anyway, and the verification / reset
flows must be rate-limited and idempotent in ways that are easier to control
directly.

- Passwords: bcrypt, cost 12.
- Sessions: 32-byte random token in an httpOnly, SameSite=Lax cookie; only a
  SHA-256 HMAC (`SESSION_SECRET` as key) is stored, so a database leak cannot
  hand out live sessions.
- Verification and reset tokens: same hashed-token approach, single-use, expiring.

## D4 — Money as integer minor units

`amountCents` / `expectedRefundCents` / `actualRefundCents` are `Int` throughout.
Binary floating point is never used for money, as the plan requires. The UI parses
"12.34" to 1234 at the edge.

## D5 — Deadlines as calendar dates, reminders as UTC instants

`returnDeadline`, `purchaseDate`, and the refund dates are `@db.Date`: they are
retailer/calendar concepts, not instants. Reminder `scheduledFor` values are
absolute UTC instants computed from the user's time zone and a local send hour,
so the local send time stays fixed across DST changes. "Expired" is computed for
display and is never persisted.

## D6 — Reminder idempotency via a unique key plus conditional claim

`ReminderDelivery` has a unique key on `(itemId, reminderType, scheduledFor)`.
The worker claims a row with a conditional update (`where status = PENDING`) and
only sends when that update reports exactly one affected row, so a retried or
concurrent worker cannot double-send. Cancelled and sent rows are retained as the
audit trail.

## D7 — Attachments: private local disk behind an authenticated proxy (superseded by R2 in D11)

Files are stored under `UPLOAD_DIR` with opaque, traversal-proof keys and are
never exposed as a public path; the browser fetches them through
`/api/uploads/<key>`, which re-checks ownership against the session. Content type
is verified by magic bytes, not by extension. This mirrors the plan's
"short-lived signed URLs or an authenticated proxy" requirement and swaps to S3
later without touching callers.

## D8 — In-process facades for mail and rate limiting (mail superseded by Resend in D11)

`src/lib/mail.ts` logs to stdout when `SMTP_HOST` is unset, which keeps reminder
behaviour observable in local development without a provider. The rate limiter is
an in-process sliding window; a multi-instance deployment must swap it for a
shared store. Both are single-file swaps.
