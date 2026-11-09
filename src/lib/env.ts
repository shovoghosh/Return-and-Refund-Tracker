import { z } from "zod";

const schema = z.object({
  // Only the Prisma CLI needs a connection string; the app reads D1 through a
  // binding, so this is optional at runtime.
  DATABASE_URL: z.string().optional().default(""),
  APP_URL: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  // Resend HTTP API key. Empty means "log the email to stdout" (local dev).
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Return Tracker <reminders@example.com>"),
  SUPPORT_EMAIL: z.string().default("support@example.com"),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  MAX_FILES_PER_ITEM: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const maxUploadBytes = () => getEnv().MAX_UPLOAD_MB * 1024 * 1024;
