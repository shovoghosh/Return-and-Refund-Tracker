import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { encodeOffsets } from "@/lib/reminders";
import {
  buildDashboardSections,
  deleteAccount,
  exportUserData,
  listPurchases,
  toCsv,
  upsertReturnDetails,
  type ExportRow,
} from "@/lib/dal";

/**
 * Integration tests for the dashboard track. They run against the real migrated
 * database (localhost:5433 / return_tracker) with throwaway users that are
 * removed in afterEach. Nothing here touches the schema.
 */

const TZ = "America/Edmonton";
// 2026-06-10T18:00:00Z == 12:00 MDT on June 10.
const NOW = new Date("2026-06-10T18:00:00.000Z");

const createdUserIds: string[] = [];

function email(prefix: string): string {
  return `${prefix}-${randomUUID()}@dash.test`;
}

async function makeUser(tz: string = TZ, offsets: number[] = [7, 2, 1]) {
  const user = await prisma.user.create({
    data: {
      email: email("dash"),
      passwordHash: "throwaway-not-a-real-hash",
      timezone: tz,
      reminderOffsets: encodeOffsets(offsets),
      reminderHour: 9,
      emailRemindersOn: true,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function addItem(
  userId: string,
  opts: {
    name: string;
    store: string;
    deadline: string;
    orderNumber?: string | null;
    status?: "OPEN" | "RETURN_STARTED" | "RETURNED" | "REFUND_PENDING" | "REFUND_RECEIVED" | "KEPT";
    archived?: boolean;
    existingOrderId?: string | null;
  },
) {
  let orderId = opts.existingOrderId ?? null;
  if (!orderId) {
    const order = await prisma.order.create({
      data: {
        userId,
        storeName: opts.store,
        orderNumber: opts.orderNumber ?? null,
        purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    orderId = order.id;
  }
  const item = await prisma.item.create({
    data: {
      userId,
      orderId,
      name: opts.name,
      returnDeadline: new Date(`${opts.deadline}T00:00:00.000Z`),
      status: opts.status ?? "OPEN",
      ...(opts.archived ? { archivedAt: NOW } : {}),
    },
  });
  return item;
}

afterEach(async () => {
  const ids = createdUserIds.splice(0, createdUserIds.length);
  for (const id of ids) {
    await prisma.user.deleteMany({ where: { id } }).catch(() => {});
  }
});

describe("buildDashboardSections bucketing", () => {
  it("places items in the right sections and excludes archived rows by default", async () => {
    const user = await makeUser();

    const overdue = await addItem(user.id, {
      name: "Overdue sweater",
      store: "Acme",
      deadline: "2026-06-01",
    });
    const refundPending = await addItem(user.id, {
      name: "Refund pending kettle",
      store: "Borq",
      deadline: "2026-06-20",
      status: "REFUND_PENDING",
    });
    const soon = await addItem(user.id, {
      name: "Due in three days",
      store: "Cira",
      deadline: "2026-06-13",
    });
    const todayItem = await addItem(user.id, {
      name: "Due today lamp",
      store: "Dune",
      deadline: "2026-06-10",
    });
    const archived = await addItem(user.id, {
      name: "Archived blender",
      store: "Echo",
      deadline: "2026-06-30",
      archived: true,
    });

    const active = await listPurchases(user.id, TZ, { limit: 500 }, NOW);
    const activeIds = active.map((i) => i.id);
    expect(activeIds).toContain(overdue.id);
    expect(activeIds).toContain(todayItem.id);
    expect(activeIds).not.toContain(archived.id);

    const withArchived = await listPurchases(user.id, TZ, { includeArchived: true, limit: 500 }, NOW);
    expect(withArchived.map((i) => i.id)).toContain(archived.id);

    // The overdue OPEN item is displayed as EXPIRED.
    const overdueRow = active.find((i) => i.id === overdue.id)!;
    expect(overdueRow.displayStatus).toBe("EXPIRED");
    expect(overdueRow.isOverdue).toBe(true);

    const sections = buildDashboardSections(active);
    expect(sections.needsAttention.map((i) => i.id)).toContain(overdue.id);
    expect(sections.upcoming.map((i) => i.id)).toContain(soon.id);
    expect(sections.refundsPending.map((i) => i.id)).toContain(refundPending.id);
    expect(sections.deadlineToday.map((i) => i.id)).toEqual([todayItem.id]);

    // A due-today item is NOT overdue and lands in upcoming, not needs attention.
    expect(sections.upcoming.map((i) => i.id)).toContain(todayItem.id);
    expect(sections.needsAttention.map((i) => i.id)).not.toContain(todayItem.id);
    // The archived item appears in none of the sections.
    expect(sections.all.map((i) => i.id)).not.toContain(archived.id);
  });
});

describe("listPurchases search, filter, sort", () => {
  it("matches item name, store name, and order number but never another user's rows", async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    await addItem(alice.id, {
      name: "Noise cancelling headphones",
      store: "SoundHaus",
      deadline: "2026-06-20",
      orderNumber: "AL-10293",
    });
    await addItem(bob.id, {
      name: "Noise cancelling headphones",
      store: "SoundHaus",
      deadline: "2026-06-20",
      orderNumber: "BOB-77",
    });

    const byName = await listPurchases(alice.id, TZ, { search: "headphones", limit: 500 }, NOW);
    expect(byName).toHaveLength(1);
    expect(byName.every((i) => i.name.includes("headphones"))).toBe(true);

    const byStore = await listPurchases(alice.id, TZ, { search: "soundhaus", limit: 500 }, NOW);
    expect(byStore).toHaveLength(1);
    expect(byStore[0].storeName).toBe("SoundHaus");

    const byOrder = await listPurchases(alice.id, TZ, { search: "AL-10293", limit: 500 }, NOW);
    expect(byOrder).toHaveLength(1);
    expect(byOrder[0].orderNumber).toBe("AL-10293");

    // Bob's order number must never surface in Alice's results.
    const bobOnly = await listPurchases(alice.id, TZ, { search: "BOB-77", limit: 500 }, NOW);
    expect(bobOnly).toHaveLength(0);
  });

  it("filters by status and orders by nearest deadline or newest purchase", async () => {
    const user = await makeUser();

    await addItem(user.id, { name: "Kept item", store: "Acme", deadline: "2026-06-05", status: "KEPT" });
    await addItem(user.id, { name: "Open soon", store: "Acme", deadline: "2026-06-12" });
    const lateCreated = await addItem(user.id, {
      name: "Open later created",
      store: "Acme",
      deadline: "2026-06-25",
    });

    const onlyOpen = await listPurchases(user.id, TZ, { status: "OPEN", limit: 500 }, NOW);
    expect(onlyOpen).toHaveLength(2);
    expect(onlyOpen.every((i) => i.status === "OPEN")).toBe(true);

    const byDeadline = await listPurchases(user.id, TZ, { sort: "deadline", limit: 500 }, NOW);
    const deadlines = byDeadline.map((i) => i.returnDeadline);
    expect(deadlines).toEqual([...deadlines].sort());

    const byNewest = await listPurchases(user.id, TZ, { sort: "newest", limit: 500 }, NOW);
    expect(byNewest[0].id).toBe(lateCreated.id);
  });
});

describe("exportUserData", () => {
  it("returns only the caller's items", async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    await addItem(alice.id, {
      name: "Alice's lamp",
      store: "Dune",
      deadline: "2026-06-20",
    });
    await addItem(bob.id, {
      name: "Bob's secret telescope",
      store: "Zed",
      deadline: "2026-06-21",
    });

    const exportData = await exportUserData(alice.id);
    expect(exportData.user.email).toBe(alice.email);
    expect(exportData.items).toHaveLength(1);
    expect(exportData.items[0].item_name).toBe("Alice's lamp");

    const serialized = JSON.stringify(exportData);
    expect(serialized).not.toContain("telescope");
    expect(serialized).not.toContain(bob.email);
  });

  it("toCsv escapes values containing a comma and a quote", () => {
    const row: ExportRow = {
      item_id: "e9a1f0c3-1234-5678-9abc-def012345678",
      item_name: 'Widget, "deluxe" edition',
      store_name: "Acme",
      order_number: "",
      purchase_date: "2026-01-01",
      return_deadline: "2026-06-20",
      status: "OPEN",
      amount: "",
      currency: "",
      item_url: "",
      notes: "",
      return_started_at: "",
      returned_at: "",
      carrier: "",
      tracking_number: "",
      expected_refund_amount: "",
      expected_refund_date: "",
      actual_refund_amount: "",
      actual_refund_date: "",
      refund_received_at: "",
      attachment_count: "0",
      created_at: "2026-01-01T00:00:00.000Z",
    };

    const csv = toCsv([row]);
    const dataLine = csv.split("\n")[1];
    expect(csv).toContain('"Widget, ""deluxe"" edition"');
    expect(dataLine.startsWith('"Widget, ""deluxe"" edition",Acme,')).toBe(true);
  });
});

describe("deleteAccount", () => {
  it("removes the user's rows and leaves another user's data intact", async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    const aliceItem = await addItem(alice.id, {
      name: "Alice item",
      store: "Acme",
      deadline: "2026-06-20",
    });
    await upsertReturnDetails({
      userId: alice.id,
      itemId: aliceItem.id,
      returnedAt: "2026-06-11",
      carrier: "UPS",
      expectedRefundCents: 4500,
    });

    const bobItem = await addItem(bob.id, {
      name: "Bob item",
      store: "Borq",
      deadline: "2026-06-22",
    });

    // Sanity: both users have rows before deletion.
    expect(await prisma.item.count({ where: { userId: alice.id } })).toBeGreaterThan(0);
    expect(await prisma.event.count({ where: { userId: alice.id } })).toBeGreaterThan(0);

    await deleteAccount(alice.id);

    // Alice is gone, with every dependent row cascaded away.
    expect(await prisma.user.findUnique({ where: { id: alice.id } })).toBeNull();
    expect(await prisma.item.count({ where: { userId: alice.id } })).toBe(0);
    expect(await prisma.order.count({ where: { userId: alice.id } })).toBe(0);
    expect(await prisma.return.count({ where: { userId: alice.id } })).toBe(0);
    expect(await prisma.event.count({ where: { userId: alice.id } })).toBe(0);

    // Bob is untouched.
    expect(await prisma.item.count({ where: { userId: bob.id } })).toBe(1);
    expect(await prisma.order.count({ where: { userId: bob.id } })).toBe(1);
    expect(await prisma.item.findUnique({ where: { id: bobItem.id } })).not.toBeNull();
  });
});