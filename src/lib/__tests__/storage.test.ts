import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALLOWED_MIME,
  saveUpload,
  readUpload,
  deleteUpload,
  deleteManyUploads,
  resolveKeyPath,
  sniffContentType,
  validateUpload,
} from "@/lib/storage";

// Keep real file writes out of the repo: point storage at a scratch dir.
const ORIGINAL_UPLOAD_DIR = process.env.UPLOAD_DIR;
const scratchBase = process.env.TMPDIR ?? os.tmpdir();
const scratch = mkdtempSync(path.join(scratchBase, "rt-uploads-"));

beforeAll(() => {
  process.env.UPLOAD_DIR = scratch;
});

afterAll(async () => {
  if (ORIGINAL_UPLOAD_DIR === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = ORIGINAL_UPLOAD_DIR;
  rmSync(scratch, { recursive: true, force: true });
});

// --- tiny magic-byte fixtures -------------------------------------------------

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const gifBytes = Buffer.from("GIF89a\x01\x00\x01\x00", "binary");
const pdfBytes = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n", "ascii");
const webpBytes = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
  Buffer.from([0x00, 0x00]),
]);
const textBytes = Buffer.from("this is plain text, definitely not an image", "utf8");

describe("validateUpload", () => {
  it("accepts common image formats and PDF within the cap", () => {
    expect(validateUpload({ filename: "receipt.pdf", contentType: "application/pdf", sizeBytes: 1024 }).ok).toBe(true);
    expect(validateUpload({ filename: "photo.png", contentType: "image/png", sizeBytes: 2048 }).ok).toBe(true);
    expect(validateUpload({ filename: "photo.jpeg", contentType: "image/jpeg", sizeBytes: 2048 }).ok).toBe(true);
    expect(validateUpload({ filename: "shot.webp", contentType: "image/webp", sizeBytes: 10 }).ok).toBe(true);
    expect(validateUpload({ filename: "shot.heic", contentType: "image/heic", sizeBytes: 10 }).ok).toBe(true);
  });

  it("rejects executables and other unsupported extensions", () => {
    const exe = validateUpload({ filename: "evil.exe", contentType: "application/octet-stream", sizeBytes: 10 });
    expect(exe.ok).toBe(false);
    expect(validateUpload({ filename: "script.sh", contentType: "text/x-sh", sizeBytes: 10 }).ok).toBe(false);
    expect(validateUpload({ filename: "noext", contentType: "image/png", sizeBytes: 10 }).ok).toBe(false);
  });

  it("rejects a disallowed declared content type even with a good extension", () => {
    const res = validateUpload({ filename: "photo.png", contentType: "text/html", sizeBytes: 10 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/JPEG|PNG|PDF/i);
  });

  it("rejects oversized and empty files", () => {
    const oversized = validateUpload({ filename: "big.png", contentType: "image/png", sizeBytes: 11 * 1024 * 1024 });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.error).toMatch(/MB/i);

    expect(validateUpload({ filename: "empty.png", contentType: "image/png", sizeBytes: 0 }).ok).toBe(false);
  });
});

describe("sniffContentType", () => {
  it("detects real PNG / JPEG / GIF / WebP / PDF magic bytes", () => {
    expect(sniffContentType(pngBytes, "image/png")).toBe("image/png");
    expect(sniffContentType(jpegBytes, "image/jpeg")).toBe("image/jpeg");
    expect(sniffContentType(gifBytes, "image/gif")).toBe("image/gif");
    expect(sniffContentType(webpBytes, "image/webp")).toBe("image/webp");
    expect(sniffContentType(pdfBytes, "application/pdf")).toBe("application/pdf");
  });

  it("returns null when the contents match no allowed type", () => {
    // A .png name with text bytes must not sniff as an image.
    expect(sniffContentType(textBytes, "image/png")).toBeNull();
    expect(sniffContentType(Buffer.from([0x00, 0x01, 0x02, 0x03]), "image/png")).toBeNull();
    expect(sniffContentType(Buffer.alloc(0), "image/png")).toBeNull();
  });

  it("reports the true type so a declared-type mismatch can be caught", () => {
    // Declared jpeg but actual png: detected differs from declared -> caller rejects.
    expect(sniffContentType(pngBytes, "image/jpeg")).toBe("image/png");
    expect(sniffContentType(pngBytes, "image/jpeg")).not.toBe("image/jpeg");
  });

  it("exposes the allowed mime list without the unsupported types", () => {
    expect(ALLOWED_MIME).toContain("application/pdf");
    expect(ALLOWED_MIME).toContain("image/png");
    expect(ALLOWED_MIME).not.toContain("application/octet-stream");
    expect(ALLOWED_MIME).not.toContain("text/html");
  });
});

describe("resolveKeyPath path-traversal defense", () => {
  it("resolves a well-formed key inside the storage root", () => {
    const full = resolveKeyPath("user-abc_123");
    expect(full.startsWith(path.resolve(scratch))).toBe(true);
  });

  it("rejects traversal, absolute paths, and malformed keys", () => {
    for (const bad of [
      "../secret",
      "../../etc/passwd",
      "a/../../b",
      "/etc/passwd",
      "C:/Windows/win.ini",
      "C:\\Windows\\win.ini",
      "..",
      ".",
      "a//b",
      "a/./b",
      "",
      "bad key with spaces",
      "key\0null",
    ]) {
      expect(() => resolveKeyPath(bad), `expected reject: ${JSON.stringify(bad)}`).toThrow();
    }
  });
});

describe("saveUpload / readUpload / deleteUpload", () => {
  it("round-trips bytes without using the client filename in the key", async () => {
    const { storageKey } = await saveUpload({
      userId: "user-roundtrip",
      itemId: "item-1",
      filename: "my receipt.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes,
    });
    expect(storageKey).not.toContain("receipt");
    expect(storageKey.includes("/")).toBe(false);
    expect(resolveKeyPath(storageKey).startsWith(path.resolve(scratch))).toBe(true);

    const read = await readUpload(storageKey);
    expect(read.equals(pdfBytes)).toBe(true);

    await deleteUpload(storageKey);
    await expect(readUpload(storageKey)).rejects.toThrow();
  });

  it("tolerates deleting a missing file and rejects a traversal key on delete", async () => {
    await expect(deleteUpload("does-not-exist-key")).resolves.toBeUndefined();
    await expect(deleteUpload("../escape")).rejects.toThrow();
  });

  it("deleteManyUploads removes several objects and ignores missing ones", async () => {
    const a = await saveUpload({ userId: "u1", itemId: "i1", filename: "a.png", contentType: "image/png", bytes: pngBytes });
    const b = await saveUpload({ userId: "u1", itemId: "i1", filename: "b.png", contentType: "image/png", bytes: pngBytes });
    expect(() => statSync(resolveKeyPath(a.storageKey))).not.toThrow();

    await deleteManyUploads([a.storageKey, b.storageKey, "already-gone"]);
    expect(() => statSync(resolveKeyPath(a.storageKey))).toThrow();
    expect(() => statSync(resolveKeyPath(b.storageKey))).toThrow();
  });
});