import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserApi } from "@/lib/auth-guard";
import { readUpload, isValidStorageKey } from "@/lib/storage";

/**
 * Serves a private attachment by its opaque storage key.
 *
 * GET /api/uploads/<storageKey>
 *
 * The lookup is scoped to the signed-in user: a guessed key belonging to someone
 * else resolves to nothing and returns 404. The local filesystem path is never
 * disclosed; the bytes are streamed with the stored content type and a
 * private, no-store cache directive.
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  let user;
  try {
    user = await requireUserApi();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { key } = await ctx.params;
  if (typeof key !== "string" || key.trim().length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Reject a malformed or traversal-shaped key before touching the database or storage.
  if (!isValidStorageKey(key)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const attachment = await prisma.attachment.findFirst({
    where: { storageKey: key, userId: user.id },
    select: { contentType: true, originalFilename: true },
  });
  if (!attachment) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readUpload(key);
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const disposition = attachment.contentType === "application/pdf" ? "attachment" : "inline";
  const safeName = (attachment.originalFilename || "file").replace(/[^\w.\- ]+/g, "_");

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": attachment.contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `${disposition}; filename="${safeName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}