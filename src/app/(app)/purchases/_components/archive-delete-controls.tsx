"use client";

import { useActionState, useState } from "react";
import { Archive, ArchiveRestore, ShieldAlert, Trash2 } from "lucide-react";
import { Button, Card, IconTile, Notice, cx } from "@/components/ui";
import { archiveToggleAction, deletePurchaseAction } from "@/lib/core-tracking/actions";

/**
 * Archive and delete controls. Both are destructive-ish, so they are separated
 * from the everyday status buttons and each one asks for confirmation first.
 * Deleting warns that attached files are removed too (the action purges them
 * from storage as well as the database).
 */
export function ArchiveDeleteControls({ itemId, archived }: { itemId: string; archived: boolean }) {
  const [archiveState, archiveAction, archivePending] = useActionState(archiveToggleAction, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePurchaseAction, undefined);
  const [armed, setArmed] = useState<"archive" | "delete" | null>(null);

  // Reset armed state when archive action succeeds — use a key on the form to
  // force remount instead of setState in an effect.
  const formKey = archiveState?.ok ? "reset" : "default";

  const archiveError = archiveState && !archiveState.ok ? archiveState.formError : undefined;
  const deleteError = deleteState && !deleteState.ok ? deleteState.formError : undefined;

  return (
    <Card padding="lg">
      <div className="flex items-start gap-3">
        <IconTile tone="neutral" size="lg">
          <ShieldAlert />
        </IconTile>
        <div>
          <h2 className="text-sm font-semibold">Archive &amp; delete</h2>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted">
            Archive keeps the purchase but hides it from your active list. Delete removes it and its
            files for good.
          </p>
        </div>
      </div>

      {archived ? (
        <p className="mt-3 text-sm text-muted">
          This purchase is archived, so reminders are stopped. You can restore it at any time.
        </p>
      ) : null}

      {archiveError ? <Notice tone="error" className="mt-3">{archiveError}</Notice> : null}
      {deleteError ? <Notice tone="error" className="mt-3">{deleteError}</Notice> : null}

      <div className="mt-4 flex flex-col gap-3">
        {/* Archive / unarchive */}
        {armed === "archive" ? (
          <form key={formKey} action={archiveAction} className="animate-pop flex flex-col gap-2.5 rounded-xl border border-border/70 bg-surface-2/50 p-3">
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="archived" value={archived ? "false" : "true"} />
            <p className="text-sm">
              {archived
                ? "Restore this purchase to your active list?"
                : "Archive this purchase? It stays saved but leaves your active list."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" size="sm" disabled={archivePending}>
                {archived ? <ArchiveRestore className="size-3.5" aria-hidden="true" /> : <Archive className="size-3.5" aria-hidden="true" />}
                {archivePending ? "Saving…" : archived ? "Restore purchase" : "Yes, archive"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(null)} disabled={archivePending}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setArmed("archive")}>
              {archived ? <ArchiveRestore className="size-3.5" aria-hidden="true" /> : <Archive className="size-3.5" aria-hidden="true" />}
              {archived ? "Restore purchase" : "Archive purchase"}
            </Button>
          </div>
        )}

        {/* Delete */}
        {armed === "delete" ? (
          <form action={deleteAction} className="animate-pop flex flex-col gap-2.5">
            <input type="hidden" name="itemId" value={itemId} />
            <Notice tone="warn">
              Deleting this purchase also permanently removes its attached files (receipts and
              return proof). This cannot be undone.
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" size="sm" disabled={deletePending}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                {deletePending ? "Deleting…" : "Yes, delete permanently"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(null)} disabled={deletePending}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cx("text-danger")}
              onClick={() => setArmed("delete")}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete purchase…
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
