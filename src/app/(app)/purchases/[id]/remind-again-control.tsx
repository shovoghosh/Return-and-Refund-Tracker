"use client";

import { useActionState } from "react";
import { BellRing } from "lucide-react";
import { Button, IconTile } from "@/components/ui";
import { scheduleRefundFollowUpAction } from "@/app/(app)/actions/reminders";

/**
 * "Remind me again" control for a refund that is REFUND_PENDING.
 *
 * One-off user-triggered follow-up (plan §2.4): a single extra
 * REFUND_FOLLOW_UP delivery is scheduled ~7 days ahead in the user's time
 * zone, instead of an endless email stream. The button is disabled
 * while the scheduling request is in flight and displays the result below.
 */
export function RemindMeAgain({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(scheduleRefundFollowUpAction, undefined);

  const message = state && !state.ok ? undefined : (state?.data?.message ?? undefined);
  const formError = state && !state.ok ? state.formError : undefined;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-2/45 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile tone="warm" size="sm">
          <BellRing />
        </IconTile>
        <div className="min-w-0">
          <p className="text-xs font-semibold">Remind me again about this refund</p>
          {formError ? <p className="mt-0.5 text-[0.65rem] text-danger">{formError}</p> : null}
          {message ? <p className="mt-0.5 text-[0.65rem] text-muted">{message}</p> : null}
          {!message && !formError ? (
            <p className="mt-0.5 text-[0.65rem] text-muted">One extra follow-up, about a week from now.</p>
          ) : null}
        </div>
      </div>
      <form action={action}>
        <input type="hidden" name="itemId" value={itemId} />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          <BellRing className="size-3.5" aria-hidden="true" />
          {pending ? "Scheduling…" : "Remind me again"}
        </Button>
      </form>
    </div>
  );
}
