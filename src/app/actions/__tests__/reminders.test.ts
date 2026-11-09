import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Never touch the mail provider from tests: the mailer is mocked for the whole file.
vi.mock("@/lib/mail", () => ({
  sendMail: vi.fn(),
  verifyMailTransport: vi.fn(async () => false),
}));

import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/db";
import { createPurchase, updatePurchase } from "@/lib/dal";
import { encodeOffsets, planDeadlineReminders, normalizeOffsets } from "@/lib/reminders";
import {
  buildReminderEmail,
  dispatchDueReminders,
  rescheduleAllForUser,
} from "@/lib/reminders-service";
import type { ItemStatus } from "@/lib/status";
import type { ReminderType } from "@/lib/reminders";

const sendMailMock = vi.mocked(sendMail);

const TZ = "America/Edmonton";
const EMAIL_PREFIX = "remtest_";
const DAY_MS = 86_400_000;
let seq = 0;

function uniqEmail(): string {
  return `${EMAIL_PREFIX}${Date.now()}_${seq++}@example.test`;
}

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function makeUser(over: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: uniqEmail(),
      passwordHash: "x",
      emailVerifiedAt: new Date(),
      timezone: TZ,
      reminderOffsets: encodeOffsets([7, 2, 1]),
      reminderHour: 9,
      emailRemindersOn: true,
      ...over,
    },
  });
}

async function makeItem(
  userId: string,
  opts: {
    name?: string;
    store?: string;
    status?: ItemStatus;
    deadlineISO: string;
    archivedAt?: Date | null;
    returnedAt?: string | null;
    expectedRefundDate?: string | null;
  },
) {
  const order = await prisma.order.create({
    data: { userId, storeName: opts.store ?? "Test Store", purchaseDate: dateOnly(opts.deadlineISO) },
  });
  const item = await prisma.item.create({
    data: {
      userId,
      orderId: order.id,
      name: opts.name ?? "Test Item",
      returnDeadline: dateOnly(opts.deadlineISO),
      status: opts.status ?? "OPEN",
      archivedAt: opts.archivedAt ?? null,
    },
  });
  if (opts.returnedAt || opts.expectedRefundDate) {
    await prisma.return.create({
      data: {
        userId,
        itemId: item.id,
        returnedAt: opts.returnedAt ? dateOnly(opts.returnedAt) : null,
        expectedRefundDate: opts.expectedRefundDate ? dateOnly(opts.expectedRefundDate) : null,
      },
    });
  }
  return item;
}

async function makeDue(
  userId: string,
  itemId: string,
  reminderType: ReminderType = "DEADLINE_1",
  scheduledFor = new Date(Date.now() - 60_000),
) {
  return prisma.reminderDelivery.create({
    data: { userId, itemId, reminderType, scheduledFor, status: "PENDING" },
  });
}

beforeEach(() => {
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ delivered: true, providerMessageId: "msg-1", devLogged: false });
});

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("dispatchDueReminders", () => {
  it("sends a due reminder exactly once and never again on retry", async () => {
    const user = await makeUser();
    const item = await makeItem(user.id, { deadlineISO: "2099-01-01" });
    await makeDue(user.id, item.id, "DEADLINE_1");

    const first = await dispatchDueReminders(new Date());
    expect(first.sent).toBe(1);
    expect(first.failed).toBe(0);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const row = await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } });
    expect(row.status).toBe("SENT");
    expect(row.sentAt).not.toBeNull();
    expect(row.attemptCount).toBe(1);
    expect(row.providerMessageId).toBe("msg-1");

    // A worker retry must find nothing to send.
    const second = await dispatchDueReminders(new Date());
    expect(second.sent).toBe(0);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(await prisma.reminderDelivery.count({ where: { itemId: item.id, status: "SENT" } })).toBe(1);
  });

  it("does not send a reminder whose scheduledFor is in the future", async () => {
    const user = await makeUser();
    const item = await makeItem(user.id, { deadlineISO: "2099-01-01" });
    await makeDue(user.id, item.id, "DEADLINE_2", new Date(Date.now() + 3 * DAY_MS));

    const summary = await dispatchDueReminders(new Date());
    expect(summary.sent).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
    const row = await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } });
    expect(row.status).toBe("PENDING");
  });

  it("cancels a reminder for an item that is now returned, kept, or archived", async () => {
    const user = await makeUser();
    const returned = await makeItem(user.id, { deadlineISO: "2099-01-01", status: "RETURNED" });
    const kept = await makeItem(user.id, { deadlineISO: "2099-01-01", status: "KEPT" });
    const archived = await makeItem(user.id, { deadlineISO: "2099-01-01", archivedAt: new Date() });
    await makeDue(user.id, returned.id);
    await makeDue(user.id, kept.id);
    await makeDue(user.id, archived.id);

    const summary = await dispatchDueReminders(new Date());
    expect(summary.sent).toBe(0);
    expect(summary.cancelled).toBe(3);
    expect(sendMailMock).not.toHaveBeenCalled();

    for (const item of [returned, kept, archived]) {
      const row = await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } });
      expect(row.status).toBe("CANCELLED");
    }
  });

  it("marks a row FAILED with the error and an incremented attempt count when sendMail throws", async () => {
    const user = await makeUser();
    const item = await makeItem(user.id, { deadlineISO: "2099-01-01" });
    await makeDue(user.id, item.id, "DEADLINE_1");
    sendMailMock.mockRejectedValue(new Error("smtp down"));

    const summary = await dispatchDueReminders(new Date());
    expect(summary.failed).toBe(1);
    expect(summary.sent).toBe(0);

    const row = await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } });
    expect(row.status).toBe("FAILED");
    expect(row.attemptCount).toBe(1);
    expect(row.lastError).toBe("smtp down");
    expect(row.sentAt).toBeNull();
  });

  it("retries a FAILED row once its exponential backoff expires, then sends it exactly once", async () => {
    const user = await makeUser();
    const item = await makeItem(user.id, { deadlineISO: "2099-01-01" });
    const scheduled = new Date(Date.now() - 2 * DAY_MS); // due long ago
    await prisma.reminderDelivery.create({
      data: { userId: user.id, itemId: item.id, reminderType: "DEADLINE_1", scheduledFor: scheduled, status: "FAILED", attemptCount: 1, lastError: "smtp down" },
    });

    // Before backoff (60 min) has elapsed for attempt 1, no retry.
    const pre = await dispatchDueReminders(scheduled);
    expect(pre.sent).toBe(0);
    expect(pre.failed).toBe(0);
    expect(pre.retried).toBe(0);
    expect((await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } })).status).toBe("FAILED");
    expect(sendMailMock).not.toHaveBeenCalled();

    // Advance past the 60-minute backoff and re-run: the row is revived to PENDING
    // (attemptCount 2) and sent by the normal claim path.
    sendMailMock.mockClear();
    sendMailMock.mockResolvedValue({ delivered: true, providerMessageId: "msg-2", devLogged: false });
    const post = await dispatchDueReminders(new Date(scheduled.getTime() + 61 * 60 * 1000));
    expect(post.sent).toBe(1);
    expect(post.failed).toBe(0);
    expect(post.retried).toBe(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const row = await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } });
    expect(row.status).toBe("SENT");
    expect(row.attemptCount).toBe(2);
    expect(row.sentAt).not.toBeNull();
    expect(row.providerMessageId).toBe("msg-2");
  });

  it("respects the exponential backoff: attempt 1 -> 60m, attempt 2 -> 4h, attempt 3+ -> 24h, attempt 4 is the ceiling", async () => {
    // Mail is configured to throw for this whole test so every revive cycles back to
    // FAILED with an incremented attemptCount, which lets us watch the backoff ladder.
    sendMailMock.mockRejectedValue(new Error("transient"));

    const user = await makeUser();
    const item = await makeItem(user.id, { deadlineISO: "2099-01-01" });
    const base = new Date(Date.now() - 2 * DAY_MS);
    const makeFailed = async (attempt: number) =>
      await prisma.reminderDelivery.create({
        data: { userId: user.id, itemId: item.id, reminderType: "DEADLINE_1", scheduledFor: base, status: "FAILED", attemptCount: attempt, lastError: "transient" },
      });

    const t60 = new Date(base.getTime() + 60 * 60 * 1000); // 60 min past
    const t4h = new Date(base.getTime() + 4 * 60 * 60 * 1000); // 4 h past
    const t24h = new Date(base.getTime() + 24 * 60 * 60 * 1000); // 24 h past

    // Attempt 1: no retry before 60m.
    await makeFailed(1);
    let summary = await dispatchDueReminders(new Date(t60.getTime() - 60 * 60 * 1000));
    expect(summary.retried).toBe(0);
    expect((await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } })).attemptCount).toBe(1);

    // At 60m it revives (attemptCount unchanged = 1), the claim increments to 2 and mail
    // throws -> FAILED with attemptCount 2.
    summary = await dispatchDueReminders(t60);
    expect(summary.retried).toBe(1);
    expect((await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } })).attemptCount).toBe(2);

    // Attempt 2: no retry before 4h.
    summary = await dispatchDueReminders(new Date(t4h.getTime() - 60 * 60 * 1000));
    expect(summary.retried).toBe(0);

    // At 4h -> revival, claim increments to 3, fail -> attemptCount 3.
    summary = await dispatchDueReminders(t4h);
    expect(summary.retried).toBe(1);
    expect((await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } })).attemptCount).toBe(3);

    // Attempt 3: no retry before 24h.
    summary = await dispatchDueReminders(new Date(t24h.getTime() - 60 * 60 * 1000));
    expect(summary.retried).toBe(0);

    // At 24h -> revival, claim increments to 4, fail -> attemptCount 4, then dead.
    summary = await dispatchDueReminders(t24h);
    expect(summary.retried).toBe(1);
    expect((await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } })).attemptCount).toBe(4);

    // Any later run: still FAILED, no retry.
    summary = await dispatchDueReminders(new Date(t24h.getTime() + DAY_MS));
    expect(summary.retried).toBe(0);
    expect((await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } })).status).toBe("FAILED");

    sendMailMock.mockRejectedValue(new Error("smtp down"));
  });

  it("never retries a row that has already reached attemptCount 4 (hard ceiling)", async () => {
    const user = await makeUser();
    const item = await makeItem(user.id, { deadlineISO: "2099-01-01" });
    await prisma.reminderDelivery.create({
      data: { userId: user.id, itemId: item.id, reminderType: "DEADLINE_1", scheduledFor: new Date(Date.now() - 2 * DAY_MS), status: "FAILED", attemptCount: 4, lastError: "dead" },
    });

    const post = await dispatchDueReminders(new Date(Date.now() + 30 * DAY_MS));
    expect(post.retried).toBe(0);
    expect(post.sent).toBe(0);
    expect((await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } })).status).toBe("FAILED");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("does not email a reminder until the account's address is verified", async () => {
    const user = await makeUser({ emailVerifiedAt: null });
    const item = await makeItem(user.id, { deadlineISO: "2099-01-01" });
    await makeDue(user.id, item.id, "DEADLINE_1");

    const summary = await dispatchDueReminders(new Date());
    expect(summary.sent).toBe(0);
    expect(sendMailMock).not.toHaveBeenCalled();
    const row = await prisma.reminderDelivery.findFirstOrThrow({ where: { itemId: item.id } });
    expect(row.status).toBe("PENDING");
  });

  it("keeps the email SUBJECT free of the item name and store (privacy)", async () => {
    const user = await makeUser();
    const item = await makeItem(user.id, {
      name: "Secret Widget 9000",
      store: "Secret Store XYZ",
      deadlineISO: "2099-01-01",
    });
    await makeDue(user.id, item.id, "DEADLINE_1");

    await dispatchDueReminders(new Date());
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const message = sendMailMock.mock.calls[0][0];

    expect(message.subject.toLowerCase()).not.toContain("secret widget 9000");
    expect(message.subject.toLowerCase()).not.toContain("secret store xyz");
    expect(message.subject.toLowerCase()).not.toContain("order");
    // The body may name them, and must carry the link back into the app.
    expect(message.text).toContain("Secret Widget 9000");
    expect(message.text).toContain(`/purchases/${item.id}`);
  });
});

describe("plan + scheduling", () => {
  it("buildReminderEmail always leaves item/store out of the subject", () => {
    const email = buildReminderEmail({
      id: "d1",
      userId: "u1",
      itemId: "i1",
      reminderType: "DEADLINE_TODAY",
      scheduledFor: new Date(),
      attemptCount: 0,
      itemName: "Ultra Secret Lamp",
      storeName: "Hidden Store",
      deadlineISO: "2026-08-01",
      expectedRefundDateISO: null,
      returnedAtISO: null,
      status: "OPEN",
      archivedAt: null,
      timezone: TZ,
      email: "a@b.test",
      emailRemindersOn: true,
      emailVerified: true,
    });
    expect(email.subject).not.toContain("Ultra Secret Lamp");
    expect(email.subject).not.toContain("Hidden Store");
    expect(email.text).toContain("Ultra Secret Lamp");
    expect(email.text).toContain("TODAY IS THE DEADLINE");
  });

  it("cancels old PENDING rows and rebuilds them at the new dates when the deadline changes", async () => {
    const now = new Date("2026-06-01T15:00:00.000Z");
    const user = await makeUser();
    const item = await createPurchase(
      {
        userId: user.id,
        name: "Deadline Item",
        storeName: "Store A",
        purchaseDate: "2026-05-01",
        returnDeadline: "2026-08-01",
      },
      now,
    );

    const before = await prisma.reminderDelivery.findMany({ where: { itemId: item.id, status: "PENDING" } });
    expect(before.length).toBe(3);

    await updatePurchase({ userId: user.id, itemId: item.id, returnDeadline: "2026-09-01" }, now);

    const cancelled = await prisma.reminderDelivery.count({ where: { itemId: item.id, status: "CANCELLED" } });
    expect(cancelled).toBe(3);

    const pending = await prisma.reminderDelivery.findMany({ where: { itemId: item.id, status: "PENDING" } });
    const expected = planDeadlineReminders({
      deadlineISO: "2026-09-01",
      timezone: TZ,
      offsets: [7, 2, 1],
      hour: 9,
      now,
      status: "OPEN",
      archivedAt: null,
    });
    expect(pending.length).toBe(expected.length);
    const pendingSet = new Set(pending.map((p) => `${p.reminderType}@${p.scheduledFor.toISOString()}`));
    for (const e of expected) {
      expect(pendingSet.has(`${e.type}@${e.scheduledFor.toISOString()}`)).toBe(true);
    }
    // No stale rows from the old deadline survive as PENDING.
    const oldSet = new Set(
      before.map((b) => `${b.reminderType}@${b.scheduledFor.toISOString()}`),
    );
    for (const p of pending) {
      expect(oldSet.has(`${p.reminderType}@${p.scheduledFor.toISOString()}`)).toBe(false);
    }
  });

  it("rescheduleAllForUser is idempotent", async () => {
    const now = new Date("2026-06-01T15:00:00.000Z");
    const user = await makeUser();
    await createPurchase(
      { userId: user.id, name: "A", storeName: "S", purchaseDate: "2026-05-01", returnDeadline: "2026-08-01" },
      now,
    );
    await createPurchase(
      { userId: user.id, name: "B", storeName: "S", purchaseDate: "2026-05-01", returnDeadline: "2026-07-15" },
      now,
    );

    const first = await rescheduleAllForUser(user.id, now);
    const afterFirst = await prisma.reminderDelivery.findMany({ where: { userId: user.id, status: "PENDING" } });

    const second = await rescheduleAllForUser(user.id, now);
    const afterSecond = await prisma.reminderDelivery.findMany({ where: { userId: user.id, status: "PENDING" } });

    expect(first.created).toBe(6);
    expect(second.created).toBe(6);
    expect(afterFirst.length).toBe(6);
    expect(afterSecond.length).toBe(6);
    const key = (r: { reminderType: string; scheduledFor: Date }) =>
      `${r.reminderType}@${r.scheduledFor.toISOString()}`;
    expect(new Set(afterSecond.map(key))).toEqual(new Set(afterFirst.map(key)));
  });

  it("respects the user's reminder offsets when scheduling", async () => {
    const now = new Date("2026-06-01T15:00:00.000Z");
    const user = await makeUser({ reminderOffsets: encodeOffsets([2]) });
    await createPurchase(
      { userId: user.id, name: "A", storeName: "S", purchaseDate: "2026-05-01", returnDeadline: "2026-08-01" },
      now,
    );
    await rescheduleAllForUser(user.id, now);
    const pending = await prisma.reminderDelivery.findMany({ where: { userId: user.id, status: "PENDING" } });
    expect(pending.map((p) => p.reminderType)).toEqual(["DEADLINE_2"]);
    expect(normalizeOffsets([2])).toEqual([2]);
  });
});