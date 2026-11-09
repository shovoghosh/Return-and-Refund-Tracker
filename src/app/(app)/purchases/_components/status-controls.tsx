"use client";

import { useActionState, useState } from "react";
import { Button, Card, Notice, StatusBadge, cx } from "@/components/ui";
import type { ItemStatus } from "@/lib/status";
import { statusChangeAction } from "@/lib/core-tracking/actions";

export interface StatusOption {
  status: ItemStatus;
  label: string;
  requiresConfirmation: boolean;
  reason?: string;
}

/**
 * Status action panel for the detail page.
 *
 * Only transitions the shared rules allow are offered. A transition that
 * requires confirmation (e.g. KEPT after the item was returned) does not fire on
 * the first click: the user is asked to confirm and told why, because the change
 * rewrites the meaning of the event history. The server re-checks all of this
 * against the stored status, so the UI is a convenience, not the authority.
 */
export function StatusControls({ itemId, options }: { itemId: string; options: StatusOption[] }) {
  const [state, formAction, pending] = useActionState(statusChangeAction, undefined);
  const [chosen, setChosen] = useState<StatusOption | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const formKey = state?.ok ? "reset" : "default";

  const formError = state && !state.ok ? state.formError : undefined;

  if (options.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">There are no further status changes available for this item.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold">Change status</h2>
        <p className="mt-1 text-xs text-muted">
          Confirming a refund is something only you can do — the app never claims money arrived on its own.
        </p>
      </div>

      {formError ? <Notice tone="error">{formError}</Notice> : null}

      {!chosen ? (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <Button
              key={opt.status}
              type="button"
              variant={opt.status === "KEPT" ? "secondary" : "primary"}
              onClick={() => {
                setChosen(opt);
                setConfirmed(false);
              }}
            >
              Mark {opt.label}
            </Button>
          ))}
        </div>
      ) : (
        <form key={formKey} action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="status" value={chosen.status} />
          {chosen.requiresConfirmation ? <input type="hidden" name="confirm" value={confirmed ? "true" : "false"} /> : null}

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Moving to</span>
            <StatusBadge status={chosen.status} label={chosen.label} />
          </div>

          {chosen.requiresConfirmation ? (
            <>
              {chosen.reason ? <Notice tone="warn">{chosen.reason}</Notice> : null}
              <label className="flex items-start gap-2 rounded-lg border border-warn-border bg-warn-bg p-3 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 size-5"
                />
                <span>Yes, change the status to {chosen.label}.</span>
              </label>
            </>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={pending || (chosen.requiresConfirmation && !confirmed)}
              className={cx(chosen.requiresConfirmation && !confirmed && "opacity-50")}
            >
              {pending ? "Saving…" : chosen.requiresConfirmation ? "Confirm change" : `Mark ${chosen.label}`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChosen(null)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}