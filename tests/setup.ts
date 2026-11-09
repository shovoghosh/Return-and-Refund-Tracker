// Shared test bootstrap.
//
// 1. Loads .env so SESSION_SECRET and other settings exist for the suite.
// 2. Builds a throwaway SQLite database from the exact DDL that is applied to
//    Cloudflare D1 (prisma/d1/*.sql), so tests exercise the same schema shape
//    that production runs on.
// 3. Injects a better-sqlite3 Prisma adapter, because the app's default adapter
//    is the Cloudflare D1 binding and there is no Workers runtime here.
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { setPrismaAdapterFactory } from "@/lib/db";

function loadEnvFile(path: string) {
  try {
    const text = readFileSync(path, "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env file: defaults below still let the suite run.
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

// Deterministic secret for session/token hashing in tests.
process.env.SESSION_SECRET ??= "test-session-secret-value-32chars-min";

// One database per test file. Vitest re-runs setupFiles for every file, and a
// shared file cannot be re-created on Windows while the previous Prisma
// connection still holds it. Files live under the OS temp directory and are
// left for the OS to reclaim.
const dbPath = join(tmpdir(), "return-tracker-tests", `${process.pid}-${randomUUID()}.db`);
mkdirSync(dirname(dbPath), { recursive: true });

const ddl = readFileSync(resolve(process.cwd(), "prisma", "d1", "0001_init.sql"), "utf8");
const raw = new Database(dbPath);
raw.exec(ddl);
raw.close();

const adapter = new PrismaBetterSQLite3({ url: dbPath });
setPrismaAdapterFactory(() => adapter);
