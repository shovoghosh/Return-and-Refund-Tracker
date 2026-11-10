"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button, IconTile, Notice, Select } from "@/components/ui";

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
        <div className="rounded-xl border border-dashed border-border-strong/70 bg-surface-2/30 p-4 text-center">
          <Paperclip className="mx-auto size-5 text-muted" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium">No receipts or return proof yet.</p>
          <p className="mt-0.5 text-[0.65rem] text-muted">Keep the paper trail in one place.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((a) => {
            const isImage = a.contentType.startsWith("image/");
            return (
              <li
                key={a.id}
                className="group flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface/55 p-2.5 transition hover:border-border-strong"
              >
                <IconTile tone={isImage ? "sky" : "lilac"} size="sm">
                  {isImage ? <ImageIcon /> : <FileText />}
                </IconTile>
                <div className="min-w-0 flex-1">
                  <a
                    href={`/api/uploads/${a.storageKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs font-medium text-foreground underline-offset-2 hover:text-accent hover:underline"
                    title={a.originalFilename}
                  >
                    {a.originalFilename}
                  </a>
                  <p className="mt-0.5 text-[0.62rem] text-muted">
                    {a.kind === "receipt" ? "Receipt" : "Return proof"} · {formatBytes(a.sizeBytes)}
                  </p>
                </div>
                <a
                  href={`/api/uploads/${a.storageKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${a.originalFilename}`}
                  className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  aria-label={`Delete ${a.originalFilename}`}
                  className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  disabled={deletingId === a.id}
                  onClick={() => remove(a)}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {full ? (
        <p className="text-[0.68rem] leading-relaxed text-muted">
          You have reached the limit of {maxFiles} files for this purchase. Delete one to add another.
        </p>
      ) : (
        <form onSubmit={upload} className="mt-1 flex flex-col gap-3">
          <label
            htmlFor="attachment-file"
            className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-strong/70 bg-surface-2/30 px-3 py-4 text-center transition hover:border-accent/40 hover:bg-accent-soft/25"
          >
            <span className="grid size-9 place-items-center rounded-xl border border-border bg-surface text-muted transition group-hover:text-accent">
              <UploadCloud className="size-4" aria-hidden="true" />
            </span>
            <span className="mt-2 text-xs font-medium">
              {file ? file.name : "Choose a receipt or return proof"}
            </span>
            <span className="mt-0.5 text-[0.62rem] text-muted">
              JPEG, PNG, WebP, HEIC, GIF, or PDF · up to {maxUploadMb} MB
            </span>
            <input
              ref={inputRef}
              id="attachment-file"
              name="file"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/gif,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>

          <div className="flex items-end gap-2.5">
            <div className="min-w-0 flex-1">
              <label htmlFor="attachment-kind" className="sr-only">
                File type
              </label>
              <Select id="attachment-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="receipt">Receipt</option>
                <option value="return_proof">Return proof</option>
              </Select>
            </div>
            <Button type="submit" variant="secondary" size="sm" disabled={uploading || !file}>
              <UploadCloud className="size-3.5" aria-hidden="true" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
