import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { encodeOffsets } from "@/lib/reminders";
import {
  createPurchase,
  updatePurchase,
  changeItemStatus,
  deletePurchase,
  getPurchase,
  listPurchases,
  listItemEvents,
} from "@/lib/dal";
import { createPurchaseSchema, parseWith } from "@/lib/validation";
import { buildCreateArgs } from "@/lib/core-tracking/logic";
import type { CreatePurchaseParsed } from "@/lib/validation";

/**
 * Integration / regression coverage for the core tracking flow against the real
 * database. These are the behaviours the product spec says must never fail:
 *  - every read/write is scoped to the signed-in user (no cross-user leakage),
 *  - the four-required-field create pipeline (schema -> DAL) persists correctly,
 *  - a deadline before the purchase date is blocked unless explicitly confirmed,
 *  - status changes and deadline edits leave the correct audit trail and reminder
 *    schedule behind,
 *  - deleting an item returns its storage keys and removes the rows.
 */

const TZ = "America/Edmonton";
const NOW = new Date("2026-06-01T15:00:00.000Z");
const stamp = randomUUID().slice(0, 8);

let userA: string;
let userB: string;

async function makeUser(tag: string): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `core-${tag}-${stamp}@example.test`,
      passwordHash: "x",
      timezone: TZ,
      emailVerifiedAt: new Date(),
      reminderOffsets: encodeOffsets([7, 2, 1]),
      reminderHour: 9,
    },
  });
  return u.id;
}

/** Mirrors the create action's core path minus auth/redirect. */
async function createViaPipeline(userId: string, raw: Record<string, unknown>, now: Date = NOW) {
  const parsed = parseWith(createPurchaseSchema, raw);
  if (!parsed.ok) throw new Error(`schema rejected input: ${JSON.stringify(parsed.errors)}`);
  return createPurchase(buildCreateArgs(userId, parsed.data), now);
}

beforeAll(async () => {
  userA = await makeUser("a");
  userB = await makeUser("b");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.$disconnect();
});

describe("create pipeline (four required fields)", () => {
  it("persists the item, an order, the creation event and future reminders", async () => {
    const item = await createViaPipeline(userA, {
      name: "Bluetooth Headphones",
      storeName: "Acme Audio",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-20",
      amount: "49.99",
      currency: "usd",
    });

    const detail = await getPurchase(userA, item.id, TZ, NOW);
    expect(detail).not.toBeNull();
    expect(detail!.name).toBe("Bluetooth Headphones");
    expect(detail!.storeName).toBe("Acme Audio");
    expect(detail!.purchaseDate).toBe("2026-06-01");
    expect(detail!.returnDeadline).toBe("2026-06-20");
    expect(detail!.amountCents).toBe(4999);
    expect(detail!.currency).toBe("USD");
    expect(detail!.status).toBe("OPEN");

    const events = await listItemEvents(userA, item.id);
    expect(events.some((e) => e.eventType === "ITEM_CREATED")).toBe(true);

    const reminders = await prisma.reminderDelivery.findMany({
      where: { itemId: item.id },
      orderBy: { scheduledFor: "asc" },
    });
    expect(reminders.map((r) => r.reminderType)).toEqual(["DEADLINE_7", "DEADLINE_2", "DEADLINE_1"]);
    expect(reminders.every((r) => r.status === "PENDING")).toBe(true);
  });

  it("blocks a deadline before the purchase date unless confirmed, then allows it", async () => {
    const base = {
      name: "Late entry",
      storeName: "Acme",
      purchaseDate: "2026-06-10",
      returnDeadline: "2026-06-05",
    };
    const rejected = parseWith(createPurchaseSchema, base);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.errors.returnDeadline).toMatch(/before the purchase date/i);

    const confirmed = parseWith(createPurchaseSchema, { ...base, confirmExceptionalDeadline: true });
    expect(confirmed.ok).toBe(true);

    const created = await createViaPipeline(userA, { ...base, confirmExceptionalDeadline: true });
    const detail = await getPurchase(userA, created.id, TZ, NOW);
    expect(detail!.returnDeadline).toBe("2026-06-05");
  });
});

describe("ownership: a user cannot touch another user's items", () => {
  let victimItemId: string;

  beforeAll(async () => {
    const item = await createViaPipeline(userA, {
      name: "Owned by A",
      storeName: "Acme",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-25",
    });
    victimItemId = item.id;
  });

  it("returns null when B reads A's item", async () => {
    expect(await getPurchase(userB, victimItemId, TZ, NOW)).toBeNull();
  });

  it("does not list A's item in B's purchases", async () => {
    const bItems = await listPurchases(userB, TZ, {}, NOW);
    expect(bItems.some((i) => i.id === victimItemId)).toBe(false);
  });

  it("cannot read A's event history", async () => {
    expect(await listItemEvents(userB, victimItemId)).toEqual([]);
  });

  it("cannot edit A's item and leaves it unchanged", async () => {
    await expect(
      updatePurchase({ userId: userB, itemId: victimItemId, name: "hijacked" }),
    ).rejects.toBeInstanceOf(Response);
    const still = await getPurchase(userA, victimItemId, TZ, NOW);
    expect(still!.name).toBe("Owned by A");
  });

  it("cannot change A's status", async () => {
    await expect(
      changeItemStatus({ userId: userB, itemId: victimItemId, to: "KEPT" }),
    ).rejects.toBeInstanceOf(Response);
    const still = await getPurchase(userA, victimItemId, TZ, NOW);
    expect(still!.status).toBe("OPEN");
  });

  it("cannot delete A's item", async () => {
    await expect(deletePurchase(userB, victimItemId)).rejects.toBeInstanceOf(Response);
    expect(await getPurchase(userA, victimItemId, TZ, NOW)).not.toBeNull();
  });
});

describe("status changes: audit trail and reminder suppression", () => {
  it("walks the forward flow recording each transition, and confirms refunds explicitly", async () => {
    const item = await createViaPipeline(userA, {
      name: "Return flow item",
      storeName: "Acme",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-20",
    });

    await changeItemStatus({ userId: userA, itemId: item.id, to: "RETURN_STARTED" }, NOW);

    // Deadline reminders are no longer relevant once the return has started.
    const pending = await prisma.reminderDelivery.findMany({
      where: { itemId: item.id, status: "PENDING" },
    });
    expect(pending).toEqual([]);

    await changeItemStatus({ userId: userA, itemId: item.id, to: "RETURNED" }, NOW);
    await changeItemStatus({ userId: userA, itemId: item.id, to: "REFUND_PENDING" }, NOW);
    await changeItemStatus({ userId: userA, itemId: item.id, to: "REFUND_RECEIVED" }, NOW);

    const detail = await getPurchase(userA, item.id, TZ, NOW);
    expect(detail!.status).toBe("REFUND_RECEIVED");

    const events = await listItemEvents(userA, item.id);
    const statusEvents = events.filter((e) => e.eventType === "STATUS_CHANGED");
    expect(statusEvents).toHaveLength(3); // RETURN_STARTED, RETURNED, REFUND_PENDING
    // The final move is recorded as a user confirmation, never as automatic detection.
    expect(events.some((e) => e.eventType === "REFUND_CONFIRMED")).toBe(true);
    // The confirmation is recorded because the USER marked it — the app never
    // asserts a refund arrived on its own (no automatic detection path exists).
    const confirmed = events.find((e) => e.eventType === "REFUND_CONFIRMED");
    expect(confirmed!.metadata).toMatchObject({ to: "REFUND_RECEIVED" });
  });

  it("does not overwrite existing notes when no note is supplied with the status change", async () => {
    const item = await createViaPipeline(userA, {
      name: "Notes item",
      storeName: "Acme",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-20",
      notes: "Keep this note",
    });
    await changeItemStatus({ userId: userA, itemId: item.id, to: "RETURN_STARTED" }, NOW);
    const detail = await getPurchase(userA, item.id, TZ, NOW);
    expect(detail!.notes).toBe("Keep this note");
  });
});

describe("editing a deadline reschedules reminders and logs the change", () => {
  it("cancels old pending reminders and schedules new ones", async () => {
    const item = await createViaPipeline(userA, {
      name: "Deadline edit item",
      storeName: "Acme",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-20",
    });

    await updatePurchase({ userId: userA, itemId: item.id, returnDeadline: "2026-07-10" }, NOW);

    const detail = await getPurchase(userA, item.id, TZ, NOW);
    expect(detail!.returnDeadline).toBe("2026-07-10");

    const events = await listItemEvents(userA, item.id);
    const changed = events.find((e) => e.eventType === "DEADLINE_CHANGED");
    expect(changed).toBeTruthy();
    expect(changed!.metadata).toMatchObject({ from: "2026-06-20", to: "2026-07-10" });

    const cancelled = await prisma.reminderDelivery.count({
      where: { itemId: item.id, status: "CANCELLED" },
    });
    expect(cancelled).toBeGreaterThan(0);
    const pending = await prisma.reminderDelivery.findMany({
      where: { itemId: item.id, status: "PENDING" },
    });
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((r) => r.scheduledFor.getTime() > NOW.getTime())).toBe(true);
  });
});

describe("delete returns storage keys and removes rows", () => {
  it("purges the item and its attachments, and returns the storage keys to clean up", async () => {
    const item = await createViaPipeline(userA, {
      name: "Delete me",
      storeName: "Acme",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-20",
    });
    await prisma.attachment.create({
      data: {
        userId: userA,
        itemId: item.id,
        storageKey: `test-${randomUUID()}`,
        originalFilename: "receipt.pdf",
        contentType: "application/pdf",
        sizeBytes: 1234,
        kind: "receipt",
      },
    });

    const keys = await deletePurchase(userA, item.id);
    expect(keys).toHaveLength(1);
    expect(await getPurchase(userA, item.id, TZ, NOW)).toBeNull();
    expect(await prisma.attachment.count({ where: { itemId: item.id } })).toBe(0);
  });
});

// Keep the parsed type in the public surface so a schema-shape change is caught.
const _typeCheck: CreatePurchaseParsed | null = null;
void _typeCheck;