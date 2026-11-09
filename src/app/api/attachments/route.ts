import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getEnv, maxUploadBytes } from "@/lib/env";
import { requireUserApi } from "@/lib/auth-guard";
import { recordEvent } from "@/lib/dal";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  deleteUpload,
  saveUpload,
  sniffContentType,
  validateUpload,
} from "@/lib/storage";

/**
 * Attachment upload / delete for the signed-in user.
 *
 * POST /api/attachments   multipart/form-data: itemId, kind, file
 * DELETE /api/attachments?id=<attachmentId>
 *
 * Every query is scoped to the verified session user: an attachment can never be
 * created on, read from, or deleted from an item the user does not own.
 */

const KINDS = new Set(["receipt", "return_proof"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUserApi();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  // Per-user and per-IP sliding windows. A single upload attempt consumes both.
  const byUser = rateLimit(`upload:user:${user.id}`, 30, 10 * 60 * 1000);
  const byIp = rateLimit(clientKey(req.headers, "upload", user.id), 60, 10 * 60 * 1000);
  if (!byUser.allowed || !byIp.allowed) {
    const retry = Math.max(byUser.retryAfterSeconds, byIp.retryAfterSeconds);
    return NextResponse.json(
      { error: "Too many uploads. Try again in a few minutes." },
      { status: 429, headers: { "retry-after": String(retry) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Upload a JPEG, PNG, WebP, HEIC, GIF, or PDF file.", 400);
  }

  const itemId = form.get("itemId");
  const kind = form.get("kind");
  const file = form.get("file");

  if (typeof itemId !== "string" || itemId.trim().length === 0) {
    return jsonError("Missing item.", 400);
  }
  if (typeof kind !== "string" || !KINDS.has(kind)) {
    return jsonError("Unknown attachment type.", 400);
  }
  if (!(file instanceof File)) {
    return jsonError("A file is required.", 400);
  }

  // Ownership: the item must belong to the signed-in user.
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId: user.id },
    select: { id: true },
  });
  if (!item) return jsonError("That item was not found.", 404);

  // Per-item file cap.
  const existing = await prisma.attachment.count({ where: { itemId, userId: user.id } });
  if (existing >= getEnv().MAX_FILES_PER_ITEM) {
    return jsonError(
      `You can attach up to ${getEnv().MAX_FILES_PER_ITEM} files to one item.`,
      400,
    );
  }

  const declared = (file.type || "").toLowerCase();
  const filename = file.name || "upload";
  const sizeBytes = file.size;

  if (sizeBytes > maxUploadBytes()) {
    return jsonError(`Files must be ${getEnv().MAX_UPLOAD_MB} MB or smaller.`, 400);
  }

  const preCheck = validateUpload({ filename, contentType: declared, sizeBytes });
  if (!preCheck.ok) return jsonError(preCheck.error, 400);

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return jsonError("That file could not be read.", 400);
  }

  if (bytes.byteLength === 0) return jsonError("That file is empty.", 400);
  if (bytes.byteLength > maxUploadBytes()) {
    return jsonError(`Files must be ${getEnv().MAX_UPLOAD_MB} MB or smaller.`, 400);
  }

  // Actual content must match a supported type AND the declared type.
  const detected = sniffContentType(bytes, declared);
  if (!detected) {
    return jsonError("That file's contents do not match a supported type.", 400);
  }
  if (detected !== declared) {
    return jsonError("That file's contents do not match its declared type.", 400);
  }

  const { storageKey } = await saveUpload({
    userId: user.id,
    itemId,
    filename,
    contentType: detected,
    bytes,
  });

  let attachment;
  try {
    attachment = await prisma.attachment.create({
      data: {
        userId: user.id,
        itemId,
        storageKey,
        originalFilename: filename,
        contentType: detected,
        sizeBytes: bytes.byteLength,
        kind,
      },
      select: {
        id: true,
        originalFilename: true,
        contentType: true,
        sizeBytes: true,
        kind: true,
      },
    });
  } catch (err) {
    // Never leave an orphaned file if the row could not be written.
    await deleteUpload(storageKey).catch(() => {});
    throw err;
  }

  await recordEvent({
    userId: user.id,
    itemId,
    eventType: "ATTACHMENT_ADDED",
    metadata: { filename, kind },
  });

  return NextResponse.json({ ok: true, attachment }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  let user;
  try {
    user = await requireUserApi();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id || id.trim().length === 0) return jsonError("Missing attachment id.", 400);

  // Scoped lookup: a missing id and someone else's id are indistinguishable (404).
  const attachment = await prisma.attachment.findFirst({
    where: { id, userId: user.id },
    select: { id: true, itemId: true, storageKey: true },
  });
  if (!attachment) return jsonError("That attachment was not found.", 404);

  await deleteUpload(attachment.storageKey).catch(() => {});
  await prisma.attachment.delete({ where: { id: attachment.id } });

  await recordEvent({
    userId: user.id,
    itemId: attachment.itemId,
    eventType: "ATTACHMENT_DELETED",
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}