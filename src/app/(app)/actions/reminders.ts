"use server";

import { revalidatePath } from "next/cache";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth-guard";
import { scheduleRefundFollowUp } from "@/lib/reminders-service";
import { recordEvent } from "@/lib/dal/events";
import { ok, fail, type ActionResult } from "@/lib/errors";
import { getPurchase } from "@/lib/dal";

/**
 * User-triggered one-off follow-up for a pending refund (plan §2.4).
 * Instead of an endless email stream, the user taps "Remind me again" and the
 * app schedules exactly one extra REFUND_FOLLOW_UP delivery, seven days out
 * in the user's time zone. The reminders service is idempotent: a row that is
 * already PENDING for that instant is left untouched.
 *
 * Pattern matches statusChangeAction: useActionState-friendly ActionResult,
 * server-side ownership from requireUser(), revalidation, and an audit event.
 */
export async function scheduleRefundFollowUpAction(
  _prev: ActionResult<{ scheduledFor: string; message: string } | undefined> | undefined,
  formData: FormData,
): Promise<ActionResult<{ scheduledFor: string; message: string } | undefined>> {
  const user = await requireUser();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) {
    return fail({}, "Missing item.");
  }

  const item = await getPurchase(user.id, itemId, user.timezone);
  if (!item) {
    return fail({}, "That purchase could not be found.");
  }
  if (item.status !== "REFUND_PENDING") {
    return fail({}, "This item is no longer refund pending.");
  }

  const followUp = await scheduleRefundFollowUp(user.id, itemId);
  const scheduledFor = followUp.scheduledFor;

  // Human-readable scheduled-for date in the user's local time zone.
  const formatted = DateTime.fromJSDate(scheduledFor, { zone: "utc" })
    .setZone(user.timezone)
    .toFormat("ccc, LLL d, yyyy 'at' h:mm a");

  // Record the audit event now; the delivery itself is logged by the worker.
  try {
    await recordEvent({
      userId: user.id,
      itemId,
      eventType: "REMINDER_FOLLOWUP_SCHEDULED",
      metadata: { scheduledFor: scheduledFor.toISOString(), formatted },
    });
  } catch {
    // Audit logging must not fail the user's action.
  }

  revalidatePath(`/purchases/${itemId}`);
  const message = `A refund follow-up is scheduled for ${formatted}.`;
  return ok({ scheduledFor: formatted, message });
}
