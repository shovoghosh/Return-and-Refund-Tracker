"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice, Select } from "@/components/ui";

export interface AttachmentSummary {
  id: string;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  kind: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Private receipt / return-proof uploads. Files are posted to the authenticated
 * API route, never linked publicly: every download goes back through
 * /api/uploads/<key>, which re-checks that the signed-in user owns the file.
 */
export function AttachmentControls({
  itemId,
  attachments,
  maxFiles,
  maxUploadMb,
}: {
  itemId: string;
  attachments: AttachmentSummary[];
  maxFiles: number;
  maxUploadMb: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("receipt");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const full = attachments.length >= maxFiles;

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.set("itemId", itemId);
      body.set("kind", kind);
      body.set("file", file);

      const res = await fetch("/api/attachments", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "That file could not be uploaded.");
        return;
      }

      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("That file could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(attachment: AttachmentSummary) {
    if (!window.confirm(`Delete ${attachment.originalFilename}? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(attachment.id);
    try {
      const res = await fetch(`/api/attachments?id=${encodeURIComponent(attachment.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "That file could not be deleted.");
        return;
      }
      router.refresh();
    } catch {
      setError("That file could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Notice tone="error">{error}</Notice> : null}

      {attachments.length === 0 ? (
        <p className="text-sm text-muted">No receipts or return proof attached yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <a
                  href={`/api/uploads/${a.storageKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-medium text-accent underline underline-offset-2"
                >
                  {a.originalFilename}
                </a>
                <span className="mt-0.5 block text-xs text-muted">
                  {a.kind === "receipt" ? "Receipt" : "Return proof"} · {formatBytes(a.sizeBytes)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-danger"
                disabled={deletingId === a.id}
                onClick={() => remove(a)}
              >
                {deletingId === a.id ? "Deleting…" : "Delete"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="text-xs text-muted">
          You have reached the limit of {maxFiles} files for this purchase. Delete one to add another.
        </p>
      ) : (
        <form onSubmit={upload} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field
              label="Add a receipt or return proof"
              htmlFor="attachment-file"
              hint={`JPEG, PNG, WebP, HEIC, GIF, or PDF · up to ${maxUploadMb} MB.`}
            >
              <input
                ref={inputRef}
                id="attachment-file"
                name="file"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/gif,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-fg"
              />
            </Field>

            <Field label="Type" htmlFor="attachment-kind">
              <Select
                id="attachment-kind"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="receipt">Receipt</option>
                <option value="return_proof">Return proof</option>
              </Select>
            </Field>
          </div>

          <div>
            <Button type="submit" variant="secondary" disabled={uploading || !file}>
              {uploading ? "Uploading…" : "Upload file"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
