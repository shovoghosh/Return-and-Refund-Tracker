"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { scheduleRefundFollowUpAction } from "@/app/(app)/actions/reminders";

/**
 * "Remind me again" control for a refund that is REFUND_PENDING.
 *
 * One-off user-triggered follow-up (plan §2.4): a single extra
 * REFUND_FOLLOW_UP delivery is scheduled ~7 days ahead in the user's
 * time zone, instead of an endless email stream. The button is disabled
 * while the scheduling request is in flight and displays the result below.
 */
export function RemindMeAgain({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(scheduleRefundFollowUpAction, undefined);

  const message = state && !state.ok ? undefined : (state?.data?.message ?? undefined);
  const formError = state && !state.ok ? state.formError : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Remind me again about this refund</p>
        {formError && <p className="mt-0.5 text-xs text-muted text-danger">{formError}</p>}
        {message && <p className="mt-0.5 text-xs text-muted">{message}</p>}
      </div>
      <form action={action}>
        <input type="hidden" name="itemId" value={itemId} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Scheduling…" : "Remind me again"}
        </Button>
      </form>
    </div>
  );
}
