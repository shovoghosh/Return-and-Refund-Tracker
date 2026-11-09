import { NextResponse, type NextRequest } from "next/server";
import { dispatchDueReminders } from "@/lib/reminders-service";

export const dynamic = "force-dynamic";

/**
 * Reminder worker endpoint. Point your scheduler/Cron at it:
 *   curl -X POST -H "Authorization: Bearer ***" https://.../api/cron/reminders
 *
 * When CRON_SECRET is set the bearer token is required (401 otherwise). When it
 * is unset — the local-dev case — the route is open so it can be curled freely.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CRON_SECRET) {
    console.warn(
      "Reminder cron endpoint hit in dev without CRON_SECRET: see the CRON_SECRET line in .env.example. " +
        "In production, set CRON_SECRET and call this endpoint with Authorization: Bearer <secret>.",
    );
  }
  try {
    const summary = await dispatchDueReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST is the real entry point; GET is a convenience for manual curls.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return run(req);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return run(req);
}