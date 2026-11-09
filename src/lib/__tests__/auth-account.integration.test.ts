import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { encodeOffsets } from "@/lib/reminders";
import { hashToken } from "@/lib/auth";
import { deleteAccount } from "@/lib/dal/account";
import {
  TOKEN_PURPOSES,
  RESET_TOKEN_TTL_MS,
  VERIFY_TOKEN_TTL_MS,
  consumeToken,
  createAccount,
  findAuthAccountByEmail,
  getAccountPreferences,
  hasVerifiedEmail,
  issueToken,
  markEmailVerified,
  rescheduleReminders,
  setPasswordAndRevokeSessions,
  updateUserSettings,
  verifyPasswordForUser,
} from "@/lib/dal/auth-account";

/**
 * Integration tests against the migrated local Postgres. Each test creates its
 * own uniquely-email'd account and deletes it afterwards, so runs never collide
 * with other tracks' data.
 */
const PREFIX = `authtrack-${Date.now()}-`;
function emailFor(tag: string): string {
  return `${PREFIX}${tag}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

const createdUserIds: string[] = [];
async function makeAccount(tag: string, password = "correct-horse-battery") {
  const email = emailFor(tag);
  const account = await createAccount({ email, password, timezone: "UTC" });
  createdUserIds.push(account.id);
  return { ...account, password };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("account creation & lookup", () => {
  it("stores a bcrypt hash, never the plaintext, and verifies correctly", async () => {
    const { id, password } = await makeAccount("hash");
    const row = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(row.passwordHash).not.toBe(password);
    expect(row.passwordHash.startsWith("$2")).toBe(true);
    expect(await verifyPasswordForUser(id, password)).toBe(true);
    expect(await verifyPasswordForUser(id, "wrong-password")).toBe(false);
  });

  it("rejects a duplicate email at the database level", async () => {
    const { email } = await makeAccount("dupe");
    await expect(createAccount({ email, password: "another-password-1", timezone: "UTC" })).rejects.toMatchObject(
      { code: "P2002" },
    );
  });

  it("normalizes reminder offsets when reading the account", async () => {
    const { id } = await makeAccount("offsets");
    await prisma.user.update({ where: { id }, data: { reminderOffsets: encodeOffsets([1, 99, 7, 7, 2]) } });
    const found = await findAuthAccountByEmail(
      (await prisma.user.findUniqueOrThrow({ where: { id } })).email,
    );
    expect(found?.reminderOffsets).toEqual([7, 2, 1]);
  });
});

describe("verification tokens", () => {
  it("consumes a token exactly once", async () => {
    const { id } = await makeAccount("verify");
    const { raw } = await issueToken(id, TOKEN_PURPOSES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS);

    const first = await consumeToken(raw, TOKEN_PURPOSES.EMAIL_VERIFY);
    expect(first).toEqual({ userId: id });
    const second = await consumeToken(raw, TOKEN_PURPOSES.EMAIL_VERIFY);
    expect(second).toBeNull();
  });

  it("never stores the raw token, only its hash", async () => {
    const { id } = await makeAccount("hash-token");
    const { raw } = await issueToken(id, TOKEN_PURPOSES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS);
    const stored = await prisma.verifyToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    expect(stored).not.toBeNull();
    const rawRow = await prisma.verifyToken.findFirst({ where: { tokenHash: raw } });
    expect(rawRow).toBeNull();
  });

  it("rejects a token used for the wrong purpose", async () => {
    const { id } = await makeAccount("wrong-purpose");
    const { raw } = await issueToken(id, TOKEN_PURPOSES.PASSWORD_RESET, RESET_TOKEN_TTL_MS);
    expect(await consumeToken(raw, TOKEN_PURPOSES.EMAIL_VERIFY)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const { id } = await makeAccount("expired");
    const past = new Date(Date.now() - 2 * VERIFY_TOKEN_TTL_MS);
    const { raw } = await issueToken(id, TOKEN_PURPOSES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS, past);
    expect(await consumeToken(raw, TOKEN_PURPOSES.EMAIL_VERIFY)).toBeNull();
  });

  it("issuing a new token invalidates the previous live one for the same purpose", async () => {
    const { id } = await makeAccount("rotate");
    const first = await issueToken(id, TOKEN_PURPOSES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS);
    const second = await issueToken(id, TOKEN_PURPOSES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS);
    expect(await consumeToken(first.raw, TOKEN_PURPOSES.EMAIL_VERIFY)).toBeNull();
    expect(await consumeToken(second.raw, TOKEN_PURPOSES.EMAIL_VERIFY)).toEqual({ userId: id });
  });
});

describe("email verification state", () => {
  it("marks verified once and reports idempotently", async () => {
    const { id } = await makeAccount("mark");
    expect(await hasVerifiedEmail(id)).toBe(false);
    expect(await markEmailVerified(id)).toBe(true);
    expect(await markEmailVerified(id)).toBe(false);
    expect(await hasVerifiedEmail(id)).toBe(true);
  });
});

describe("password change revokes sessions", () => {
  it("removes every session belonging to the user", async () => {
    const { id } = await makeAccount("sessions");
    await prisma.session.createMany({
      data: [
        { userId: id, tokenHash: hashToken("session-a"), expiresAt: new Date(Date.now() + 1000_00) },
        { userId: id, tokenHash: hashToken("session-b"), expiresAt: new Date(Date.now() + 1000_00) },
      ],
    });
    expect(await prisma.session.count({ where: { userId: id } })).toBe(2);

    await setPasswordAndRevokeSessions(id, "brand-new-password-9");
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0);
    expect(await verifyPasswordForUser(id, "brand-new-password-9")).toBe(true);
  });
});

describe("account settings persistence", () => {
  it("persists preferences and reads them back", async () => {
    const { id } = await makeAccount("settings");
    await updateUserSettings({
      userId: id,
      timezone: "Asia/Tokyo",
      reminderOffsets: [7, 2, 1, 0],
      reminderHour: 8,
      emailRemindersOn: false,
    });
    const prefs = await getAccountPreferences(id);
    expect(prefs).toMatchObject({
      timezone: "Asia/Tokyo",
      reminderOffsets: [7, 2, 1, 0],
      reminderHour: 8,
      emailRemindersOn: false,
    });
  });

  it("only writes the signed-in user's row (no cross-user writes)", async () => {
    const a = await makeAccount("iso-a");
    const b = await makeAccount("iso-b");
    await updateUserSettings({ userId: a.id, timezone: "Europe/Paris" });
    const bRow = await prisma.user.findUniqueOrThrow({ where: { id: b.id }, select: { timezone: true } });
    expect(bRow.timezone).toBe("UTC");
  });

  it("disabling reminders cancels every pending reminder for the user", async () => {
    const { id } = await makeAccount("cancel");
    const order = await prisma.order.create({
      data: { userId: id, storeName: "Test Store", purchaseDate: new Date("2026-01-01T00:00:00Z") },
    });
    const item = await prisma.item.create({
      data: {
        userId: id,
        orderId: order.id,
        name: "Test item",
        returnDeadline: new Date("2027-01-01T00:00:00Z"),
        status: "OPEN",
      },
    });
    await prisma.reminderDelivery.create({
      data: {
        userId: id,
        itemId: item.id,
        reminderType: "DEADLINE_7",
        scheduledFor: new Date("2026-12-25T09:00:00Z"),
        status: "PENDING",
      },
    });

    await updateUserSettings({ userId: id, emailRemindersOn: false });
    const remaining = await prisma.reminderDelivery.count({
      where: { userId: id, status: "PENDING" },
    });
    expect(remaining).toBe(0);

    // Re-enabling rebuilds a future schedule for open items.
    await updateUserSettings({ userId: id, emailRemindersOn: true }, new Date("2026-06-01T00:00:00Z"));
    const rebuilt = await prisma.reminderDelivery.count({ where: { userId: id, status: "PENDING" } });
    expect(rebuilt).toBeGreaterThan(0);
  });

  it("rescheduleReminders leaves other users' queues untouched", async () => {
    const a = await makeAccount("queue-a");
    const b = await makeAccount("queue-b");
    const orderB = await prisma.order.create({
      data: { userId: b.id, storeName: "B Store", purchaseDate: new Date("2026-01-01T00:00:00Z") },
    });
    const itemB = await prisma.item.create({
      data: {
        userId: b.id,
        orderId: orderB.id,
        name: "B item",
        returnDeadline: new Date("2027-01-01T00:00:00Z"),
        status: "OPEN",
      },
    });
    await prisma.reminderDelivery.create({
      data: {
        userId: b.id,
        itemId: itemB.id,
        reminderType: "DEADLINE_7",
        scheduledFor: new Date("2026-12-25T09:00:00Z"),
        status: "PENDING",
      },
    });

    await prisma.$transaction((tx) =>
      rescheduleReminders(
        tx,
        a.id,
        { timezone: "UTC", reminderOffsets: [7, 2, 1], reminderHour: 9, emailRemindersOn: false },
        new Date(),
      ),
    );
    expect(await prisma.reminderDelivery.count({ where: { userId: b.id, status: "PENDING" } })).toBe(1);
  });
});

describe("account deletion", () => {
  it("removes the user's rows and returns attachment keys to purge", async () => {
    const { id } = await makeAccount("delete");
    const order = await prisma.order.create({
      data: { userId: id, storeName: "Delete Store", purchaseDate: new Date("2026-01-01T00:00:00Z") },
    });
    const item = await prisma.item.create({
      data: {
        userId: id,
        orderId: order.id,
        name: "To delete",
        returnDeadline: new Date("2027-01-01T00:00:00Z"),
        status: "OPEN",
      },
    });
    await prisma.attachment.create({
      data: {
        userId: id,
        itemId: item.id,
        storageKey: `key-${id}`,
        originalFilename: "receipt.pdf",
        contentType: "application/pdf",
        sizeBytes: 10,
        kind: "receipt",
      },
    });

    const keys = await deleteAccount(id);
    expect(keys).toEqual([`key-${id}`]);
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.item.count({ where: { userId: id } })).toBe(0);
  });
});
