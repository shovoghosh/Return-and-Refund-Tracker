"use client";

import { useActionState, useState } from "react";
import { Button, Card, Notice, cx } from "@/components/ui";
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
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Archive &amp; delete</h2>

      {archived ? (
        <p className="text-sm text-muted">
          This purchase is archived, so it is hidden from your active list and reminders are stopped.
        </p>
      ) : null}

      {archiveError ? <Notice tone="error">{archiveError}</Notice> : null}
      {deleteError ? <Notice tone="error">{deleteError}</Notice> : null}

      {/* Archive / unarchive */}
      {armed === "archive" ? (
        <form key={formKey} action={archiveAction} className="flex flex-col gap-2">
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="archived" value={archived ? "false" : "true"} />
          <p className="text-sm">
            {archived
              ? "Restore this purchase to your active list?"
              : "Archive this purchase? It stays saved but leaves your active list."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" disabled={archivePending}>
              {archivePending ? "Saving…" : archived ? "Restore purchase" : "Yes, archive"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setArmed(null)} disabled={archivePending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button type="button" variant="secondary" onClick={() => setArmed("archive")}>
            {archived ? "Restore purchase" : "Archive purchase"}
          </Button>
        </div>
      )}

      {/* Delete */}
      {armed === "delete" ? (
        <form action={deleteAction} className="flex flex-col gap-2">
          <input type="hidden" name="itemId" value={itemId} />
          <Notice tone="warn">
            Deleting this purchase also permanently removes its attached files (receipts and return proof).
            This cannot be undone.
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={deletePending}>
              {deletePending ? "Deleting…" : "Yes, delete permanently"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setArmed(null)} disabled={deletePending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button
            type="button"
            variant="ghost"
            className={cx("text-danger")}
            onClick={() => setArmed("delete")}
          >
            Delete purchase…
          </Button>
        </div>
      )}
    </Card>
  );
}