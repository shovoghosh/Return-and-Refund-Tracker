// Shared test bootstrap. Loads .env so DATABASE_URL / SESSION_SECRET are present
// for integration tests, and exposes helpers used across the suite.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    // No .env file: unit tests that do not touch the DB still run.
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

// Deterministic secret for session/token hashing in tests.
process.env.SESSION_SECRET ??= "test-session-secret-value-32chars-min";
