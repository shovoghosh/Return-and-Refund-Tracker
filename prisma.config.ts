import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * Cloudflare D1 is the production database, and D1 is not reachable from the
 * Prisma CLI. The schema remains the source of truth: `npm run db:sql` uses
 * `prisma migrate diff` to emit SQLite DDL, and `wrangler d1 execute` applies
 * it. DATABASE_URL is only needed for local SQLite scratch work, so it has a
 * file fallback rather than being required for `prisma generate`.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
