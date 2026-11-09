import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEnv, maxUploadBytes } from "@/lib/env";

/**
 * Private attachment storage.
 *
 * In a deployed Worker the bytes live in the R2 bucket bound as `UPLOADS`
 * (see wrangler.jsonc): private, never web-served, reached only through this
 * module and the authenticated download route.
 *
 * `next dev` and the unit tests have no R2 binding, so the same functions fall
 * back to a private directory (UPLOAD_DIR). The API is identical either way, so
 * callers never branch on the environment.
 *
 * Files are addressed by an opaque `storageKey` that is never the user's
 * original filename and never contains a path separator.
 */

/** MIME types the product accepts. Anything else is rejected before it is saved. */
export const ALLOWED_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "application/pdf",
];

const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "gif",
  "pdf",
]);

/** A single path segment may only contain characters we ever generate. */
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Minimal R2 surface used here, so the app does not depend on Workers types. */
interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string | string[]): Promise<void>;
}

let bucketLookup: Promise<R2BucketLike | null> | null = null;

/** The R2 binding, or null when running outside Workers (dev/tests). */
function bucket(): Promise<R2BucketLike | null> {
  bucketLookup ??= (async () => {
    try {
      const { env } = await getCloudflareContext({ async: true });
      return (env as { UPLOADS?: R2BucketLike }).UPLOADS ?? null;
    } catch {
      return null;
    }
  })();
  return bucketLookup;
}

/**
 * The configured storage root for the local fallback. Reads
 * `process.env.UPLOAD_DIR` at call time so tests can point storage at a scratch
 * directory without fighting the memoised env parser.
 */
function uploadDir(): string {
  const raw = process.env.UPLOAD_DIR?.trim();
  return raw && raw.length > 0 ? raw : getEnv().UPLOAD_DIR;
}

function storageRoot(): string {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), uploadDir());
}

function hasPrefix(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[i] !== bytes[i]) return false;
  }
  return true;
}

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

/**
 * True when a storage key is one we could have generated: non-empty, no path
 * separators, no traversal. This is the single validation used by both storage
 * backends and by the download route.
 */
export function isValidStorageKey(storageKey: string): boolean {
  if (typeof storageKey !== "string") return false;
  const key = storageKey.trim();
  if (key.length === 0 || key.length > 200 || key.includes("\0")) return false;
  if (key.includes("/") || key.includes("\\")) return false;
  return SAFE_SEGMENT.test(key) && key !== "." && key !== "..";
}

/**
 * Maps a storage key to its local path for the fallback backend, throwing if the
 * key is malformed or would escape the storage root.
 */
export function resolveKeyPath(storageKey: string): string {
  if (!isValidStorageKey(storageKey)) throw new Error("Invalid storage key");

  const root = storageRoot();
  const full = path.join(root, storageKey.trim());
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.length === 0) {
    throw new Error("Invalid storage key");
  }
  return full;
}

function sanitizeSegment(value: string): string {
  const cleaned = (value ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned.length > 0 ? cleaned : "u";
}

/**
 * Validates metadata before the bytes are ever written: allowed extension,
 * allowed declared MIME type, non-empty, and within the per-file size cap.
 * Actual content is verified separately by `sniffContentType`.
 */
export function validateUpload(input: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; error: string } {
  const filename = (input.filename ?? "").trim();
  if (filename.length === 0) return { ok: false, error: "A file is required." };
  if (filename.length > 255 || filename.includes("\0")) {
    return { ok: false, error: "That file name is not supported." };
  }

  const ext = path.extname(filename).toLowerCase().replace(/^\./, "");
  if (ext.length === 0 || !ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Upload a JPEG, PNG, WebP, HEIC, GIF, or PDF file." };
  }

  if (!ALLOWED_MIME.includes(input.contentType)) {
    return { ok: false, error: "Upload a JPEG, PNG, WebP, HEIC, GIF, or PDF file." };
  }

  const size = input.sizeBytes;
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (size > maxUploadBytes()) {
    return { ok: false, error: `Files must be ${getEnv().MAX_UPLOAD_MB} MB or smaller.` };
  }

  return { ok: true };
}

/**
 * Detects the real content type from magic bytes. Returns the detected MIME when
 * it is an allowed type, or null when the bytes match nothing we accept. Callers
 * must reject when this disagrees with the declared type.
 */
export function sniffContentType(bytes: Buffer, declared: string): string | null {
  if (typeof declared !== "string") return null;
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) return null;

  let detected: string | null = null;

  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    detected = "image/png";
  } else if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    detected = "image/jpeg";
  } else if (hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38])) {
    detected = "image/gif";
  } else if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    detected = "image/webp";
  } else if (bytes.toString("ascii", 0, 4) === "%PDF") {
    detected = "application/pdf";
  } else if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12);
    if (HEIC_BRANDS.has(brand)) detected = "image/heic";
  }

  if (detected === null || !ALLOWED_MIME.includes(detected)) return null;
  return detected;
}

/**
 * Writes a file and returns the opaque key to persist on the Attachment row. The
 * key is derived from the owner id plus a random UUID and never contains the
 * user's filename.
 */
export async function saveUpload(input: {
  userId: string;
  itemId: string;
  filename: string;
  contentType: string;
  bytes: Buffer;
}): Promise<{ storageKey: string }> {
  const owner = sanitizeSegment(input.userId);
  const storageKey = `${owner}-${randomUUID()}`;

  const r2 = await bucket();
  if (r2) {
    await r2.put(storageKey, new Uint8Array(input.bytes), {
      httpMetadata: { contentType: input.contentType },
    });
    return { storageKey };
  }

  const full = resolveKeyPath(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, input.bytes, { mode: 0o600 });
  return { storageKey };
}

/** Reads a stored file's bytes. Throws when the key is invalid or the file is gone. */
export async function readUpload(storageKey: string): Promise<Buffer> {
  if (!isValidStorageKey(storageKey)) throw new Error("Invalid storage key");

  const r2 = await bucket();
  if (r2) {
    const object = await r2.get(storageKey);
    if (!object) throw new Error("File not found");
    return Buffer.from(await object.arrayBuffer());
  }

  return readFile(resolveKeyPath(storageKey));
}

/** Removes one stored file. A missing file is not an error. */
export async function deleteUpload(storageKey: string): Promise<void> {
  if (!isValidStorageKey(storageKey)) throw new Error("Invalid storage key");

  const r2 = await bucket();
  if (r2) {
    await r2.delete(storageKey);
    return;
  }

  const full = resolveKeyPath(storageKey);
  try {
    await unlink(full);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Removes many stored files (account deletion / item deletion purge). Missing
 * files are ignored; a malformed key still throws so traversal is never silently
 * attempted.
 */
export async function deleteManyUploads(keys: string[]): Promise<void> {
  const valid = keys.filter((key) => isValidStorageKey(key));
  if (valid.length !== keys.length) throw new Error("Invalid storage key");

  const r2 = await bucket();
  if (r2) {
    if (valid.length > 0) await r2.delete(valid);
    return;
  }

  await Promise.all(
    valid.map((key) => unlink(resolveKeyPath(key)).catch(() => {})),
  );
}
