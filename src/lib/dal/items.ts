import { prisma } from "@/lib/db";
import { recordEvent } from "./events";
import type { ItemStatus } from "@/generated/prisma/enums";
import { DateTime } from "luxon";
import { daysUntilDeadline, isOverdue, toDisplayStatus, type ItemDisplayStatus } from "@/lib/status";
import { planDeadlineReminders, planRefundReminders, normalizeOffsets } from "@/lib/reminders";

/**
 * Every function here takes userId as its first argument and includes it in the
 * WHERE clause. The client NEVER supplies ownership: it is always taken from the
 * verified session server-side. This is the single ownership choke point.
 */

export interface PurchaseListItem {
  id: string;
  name: string;
  storeName: string;
  orderNumber: string | null;
  purchaseDate: string;
  returnDeadline: string;
  status: ItemStatus;
  displayStatus: ItemDisplayStatus;
  daysRemaining: number;
  isOverdue: boolean;
  archivedAt: Date | null;
  amountCents: number | null;
  currency: string | null;
  expectedRefundDate: string | null;
  expectedRefundCents: number | null;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: Date;
}

export interface ListOptions {
  search?: string;
  status?: ItemStatus | "ALL";
  sort?: "deadline" | "newest";
  includeArchived?: boolean;
  limit?: number;
}

function toISO(d: Date | null | undefined): string | null {
  if (!d) return null;
  return DateTime.fromJSDate(d, { zone: "utc" }).toISODate();
}

function shape(
  row: {
    id: string;
    name: string;
    returnDeadline: Date;
    status: ItemStatus;
    archivedAt: Date | null;
    amountCents: number | null;
    currency: string | null;
    createdAt: Date;
    order: { storeName: string; orderNumber: string | null; purchaseDate: Date };
    return: {
      expectedRefundDate: Date | null;
      expectedRefundCents: number | null;
      trackingNumber: string | null;
      carrier: string | null;
    } | null;
  },
  timezone: string,
  now: Date,
): PurchaseListItem {
  const deadlineISO = toISO(row.returnDeadline) ?? "";
  return {
    id: row.id,
    name: row.name,
    storeName: row.order.storeName,
    orderNumber: row.order.orderNumber,
    purchaseDate: toISO(row.order.purchaseDate) ?? "",
    returnDeadline: deadlineISO,
    status: row.status,
    displayStatus: toDisplayStatus(row.status, deadlineISO, timezone, now),
    daysRemaining: daysUntilDeadline(deadlineISO, timezone, now),
    isOverdue: isOverdue(deadlineISO, timezone, now),
    archivedAt: row.archivedAt,
    amountCents: row.amountCents,
    currency: row.currency,
    expectedRefundDate: toISO(row.return?.expectedRefundDate),
    expectedRefundCents: row.return?.expectedRefundCents ?? null,
    trackingNumber: row.return?.trackingNumber ?? null,
    carrier: row.return?.carrier ?? null,
    createdAt: row.createdAt,
  };
}

const SHAPE_SELECT = {
  id: true,
  name: true,
  returnDeadline: true,
  status: true,
  archivedAt: true,
  amountCents: true,
  currency: true,
  createdAt: true,
  order: { select: { storeName: true, orderNumber: true, purchaseDate: true } },
  return: {
    select: {
      expectedRefundDate: true,
      expectedRefundCents: true,
      trackingNumber: true,
      carrier: true,
    },
  },
} as const;

export async function listPurchases(
  userId: string,
  timezone: string,
  options: ListOptions = {},
  now: Date = new Date(),
): Promise<PurchaseListItem[]> {
  const search = options.search?.trim();
  const where = {
    userId,
    ...(options.includeArchived ? {} : { archivedAt: null }),
    ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { order: { storeName: { contains: search, mode: "insensitive" as const } } },
            { order: { orderNumber: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.item.findMany({
    where,
    select: SHAPE_SELECT,
    orderBy:
      options.sort === "newest" ? [{ createdAt: "desc" }] : [{ returnDeadline: "asc" }, { createdAt: "desc" }],
    take: options.limit ?? 500,
  });

  return rows.map((r) => shape(r, timezone, now));
}

export interface PurchaseDetail extends PurchaseListItem {
  itemUrl: string | null;
  notes: string | null;
  returnStartedAt: string | null;
  returnedAt: string | null;
  actualRefundCents: number | null;
  actualRefundDate: string | null;
  refundReceivedAt: Date | null;
  returnNotes: string | null;
  attachments: Array<{
    id: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
    kind: string;
    createdAt: Date;
  }>;
}

/** Loads one item for its owner, or null. Cross-user reads are impossible. */
export async function getPurchase(
  userId: string,
  itemId: string,
  timezone: string,
  now: Date = new Date(),
): Promise<PurchaseDetail | null> {
  const row = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: {
      ...SHAPE_SELECT,
      itemUrl: true,
      notes: true,
      attachments: {
        select: {
          id: true,
          originalFilename: true,
          contentType: true,
          sizeBytes: true,
          kind: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      return: {
        select: {
          expectedRefundDate: true,
          expectedRefundCents: true,
          actualRefundCents: true,
          actualRefundDate: true,
          refundReceivedAt: true,
          notes: true,
          returnStartedAt: true,
          returnedAt: true,
          trackingNumber: true,
          carrier: true,
        },
      },
    },
  });
  if (!row) return null;

  const base = shape(row, timezone, now);
  return {
    ...base,
    itemUrl: row.itemUrl,
    notes: row.notes,
    returnStartedAt: toISO(row.return?.returnStartedAt),
    returnedAt: toISO(row.return?.returnedAt),
    actualRefundCents: row.return?.actualRefundCents ?? null,
    actualRefundDate: toISO(row.return?.actualRefundDate),
    refundReceivedAt: row.return?.refundReceivedAt ?? null,
    returnNotes: row.return?.notes ?? null,
    attachments: row.attachments,
  };
}

export interface CreatePurchaseArgs {
  userId: string;
  name: string;
  storeName: string;
  purchaseDate: string; // YYYY-MM-DD
  returnDeadline: string; // YYYY-MM-DD
  orderNumber?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  itemUrl?: string | null;
  notes?: string | null;
}

function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * Creates an order + item in one transaction and schedules future reminders.
 * Reminders are materialised as rows immediately so the worker only has to find
 * due rows (and idempotency comes from the unique key).
 */
export async function createPurchase(args: CreatePurchaseArgs, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: args.userId,
        storeName: args.storeName,
        orderNumber: args.orderNumber ?? null,
        purchaseDate: dateOnly(args.purchaseDate),
      },
    });

    const item = await tx.item.create({
      data: {
        userId: args.userId,
        orderId: order.id,
        name: args.name,
        amountCents: args.amountCents ?? null,
        currency: args.currency ?? null,
        itemUrl: args.itemUrl ?? null,
        notes: args.notes ?? null,
        returnDeadline: dateOnly(args.returnDeadline),
        status: "OPEN",
      },
    });

    await recordEvent({
      userId: args.userId,
      itemId: item.id,
      eventType: "ITEM_CREATED",
      metadata: { name: item.name, store: order.storeName },
      tx,
    });

    const user = await tx.user.findUniqueOrThrow({
      where: { id: args.userId },
      select: { timezone: true, reminderOffsets: true, reminderHour: true },
    });
    const planned = planDeadlineReminders({
      deadlineISO: args.returnDeadline,
      timezone: user.timezone,
      offsets: normalizeOffsets(user.reminderOffsets),
      hour: user.reminderHour,
      now,
      status: "OPEN",
    });
    for (const p of planned) {
      await tx.reminderDelivery.upsert({
        where: {
          itemId_reminderType_scheduledFor: {
            itemId: item.id,
            reminderType: p.type,
            scheduledFor: p.scheduledFor,
          },
        },
        create: {
          userId: args.userId,
          itemId: item.id,
          reminderType: p.type,
          scheduledFor: p.scheduledFor,
          status: "PENDING",
        },
        update: { status: "PENDING", lastError: null },
      });
    }

    return item;
  });
}

export interface UpdatePurchaseArgs {
  userId: string;
  itemId: string;
  name?: string;
  storeName?: string;
  orderNumber?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  itemUrl?: string | null;
  notes?: string | null;
  returnDeadline?: string;
  archived?: boolean;
}

/**
 * Partial update. Changing the deadline or archiving both require the pending
 * reminder schedule to be recalculated: unsent rows are cancelled and rebuilt
 * from scratch, while already-sent rows are kept for audit.
 */
export async function updatePurchase(args: UpdatePurchaseArgs, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.item.findFirst({
      where: { id: args.itemId, userId: args.userId },
      select: {
        id: true,
        userId: true,
        name: true,
        returnDeadline: true,
        status: true,
        archivedAt: true,
        orderId: true,
        order: { select: { storeName: true, orderNumber: true } },
        return: { select: { returnedAt: true, expectedRefundDate: true } },
      },
    });
    if (!existing) throw new Response("Not found", { status: 404 });

    const prevDeadlineISO = toISO(existing.returnDeadline) ?? "";
    const deadlineChanged =
      args.returnDeadline !== undefined && args.returnDeadline !== prevDeadlineISO;
    const archiveChanged =
      args.archived !== undefined && Boolean(existing.archivedAt) !== args.archived;

    if (args.storeName !== undefined || args.orderNumber !== undefined) {
      await tx.order.update({
        where: { id: existing.orderId },
        data: {
          ...(args.storeName !== undefined ? { storeName: args.storeName } : {}),
          ...(args.orderNumber !== undefined ? { orderNumber: args.orderNumber } : {}),
        },
      });
      if (args.orderNumber !== undefined && args.orderNumber !== existing.order.orderNumber) {
        await recordEvent({
          userId: args.userId,
          itemId: args.itemId,
          eventType: "ORDER_NUMBER_CHANGED",
          metadata: { from: existing.order.orderNumber ?? null, to: args.orderNumber ?? null },
          tx,
        });
      }
    }

    const item = await tx.item.update({
      where: { id: args.itemId },
      data: {
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.amountCents !== undefined ? { amountCents: args.amountCents } : {}),
        ...(args.currency !== undefined ? { currency: args.currency } : {}),
        ...(args.itemUrl !== undefined ? { itemUrl: args.itemUrl } : {}),
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
        ...(deadlineChanged && args.returnDeadline ? { returnDeadline: dateOnly(args.returnDeadline) } : {}),
        ...(archiveChanged ? { archivedAt: args.archived ? now : null } : {}),
      },
    });

    if (deadlineChanged && args.returnDeadline) {
      await recordEvent({
        userId: args.userId,
        itemId: args.itemId,
        eventType: "DEADLINE_CHANGED",
        metadata: { from: prevDeadlineISO, to: args.returnDeadline },
        tx,
      });
    }
    if (archiveChanged) {
      await recordEvent({
        userId: args.userId,
        itemId: args.itemId,
        eventType: args.archived ? "ITEM_ARCHIVED" : "ITEM_UNARCHIVED",
        metadata: {},
        tx,
      });
    }
    await recordEvent({ userId: args.userId, itemId: args.itemId, eventType: "ITEM_UPDATED", metadata: {}, tx });

    if (deadlineChanged || archiveChanged) {
      await tx.reminderDelivery.updateMany({
        where: { itemId: args.itemId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: args.userId },
        select: { timezone: true, reminderOffsets: true, reminderHour: true },
      });
      const newDeadline = toISO(item.returnDeadline) ?? "";
      const planned = planDeadlineReminders({
        deadlineISO: newDeadline,
        timezone: user.timezone,
        offsets: normalizeOffsets(user.reminderOffsets),
        hour: user.reminderHour,
        now,
        status: item.status,
        archivedAt: item.archivedAt,
      });
      for (const p of planned) {
        await tx.reminderDelivery.upsert({
          where: {
            itemId_reminderType_scheduledFor: {
              itemId: args.itemId,
              reminderType: p.type,
              scheduledFor: p.scheduledFor,
            },
          },
          create: {
            userId: args.userId,
            itemId: args.itemId,
            reminderType: p.type,
            scheduledFor: p.scheduledFor,
            status: "PENDING",
          },
          update: { status: "PENDING", lastError: null, attemptCount: 0 },
        });
      }
      const refund = planRefundReminders({
        expectedRefundDateISO: toISO(existing.return?.expectedRefundDate),
        returnedAt: existing.return?.returnedAt ?? null,
        timezone: user.timezone,
        hour: user.reminderHour,
        now,
        status: item.status,
        archivedAt: item.archivedAt,
      });
      for (const p of refund.reminders) {
        await tx.reminderDelivery.upsert({
          where: {
            itemId_reminderType_scheduledFor: {
              itemId: args.itemId,
              reminderType: p.type,
              scheduledFor: p.scheduledFor,
            },
          },
          create: {
            userId: args.userId,
            itemId: args.itemId,
            reminderType: p.type,
            scheduledFor: p.scheduledFor,
            status: "PENDING",
          },
          update: { status: "PENDING", lastError: null, attemptCount: 0 },
        });
      }
    }

    return item;
  });
}

/**
 * Records a status change and reshapes the reminder queue in the same
 * transaction, so a status change can never leave a stale deadline reminder
 * scheduled (the spec's "changing status suppresses no-longer-relevant
 * reminders" requirement).
 */
export async function changeItemStatus(
  args: { userId: string; itemId: string; to: ItemStatus; note?: string | null },
  now: Date = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.item.findFirst({
      where: { id: args.itemId, userId: args.userId },
      select: {
        id: true,
        status: true,
        returnDeadline: true,
        archivedAt: true,
        return: { select: { returnedAt: true, expectedRefundDate: true } },
      },
    });
    if (!existing) throw new Response("Not found", { status: 404 });

    const item = await tx.item.update({
      where: { id: args.itemId },
      data: {
        status: args.to,
        ...(args.note !== undefined ? { notes: args.note } : {}),
      },
    });

    await recordEvent({
      userId: args.userId,
      itemId: args.itemId,
      eventType: args.to === "REFUND_RECEIVED" ? "REFUND_CONFIRMED" : "STATUS_CHANGED",
      metadata: { from: existing.status, to: args.to },
      tx,
    });

    await tx.reminderDelivery.updateMany({
      where: { itemId: args.itemId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    const user = await tx.user.findUniqueOrThrow({
      where: { id: args.userId },
      select: { timezone: true, reminderOffsets: true, reminderHour: true },
    });
    const deadlineISO = toISO(item.returnDeadline) ?? "";

    const planned = planDeadlineReminders({
      deadlineISO,
      timezone: user.timezone,
      offsets: normalizeOffsets(user.reminderOffsets),
      hour: user.reminderHour,
      now,
      status: item.status,
      archivedAt: item.archivedAt,
    });
    const refund = planRefundReminders({
      expectedRefundDateISO: toISO(existing.return?.expectedRefundDate),
      returnedAt: existing.return?.returnedAt ?? null,
      timezone: user.timezone,
      hour: user.reminderHour,
      now,
      status: item.status,
      archivedAt: item.archivedAt,
    });

    for (const p of [...planned, ...refund.reminders]) {
      await tx.reminderDelivery.upsert({
        where: {
          itemId_reminderType_scheduledFor: {
            itemId: args.itemId,
            reminderType: p.type,
            scheduledFor: p.scheduledFor,
          },
        },
        create: {
          userId: args.userId,
          itemId: args.itemId,
          reminderType: p.type,
          scheduledFor: p.scheduledFor,
          status: "PENDING",
        },
        update: { status: "PENDING", lastError: null, attemptCount: 0 },
      });
    }

    return item;
  });
}

/** Hard delete. Attachments rows cascade; storage objects are removed by the caller. */
export async function deletePurchase(userId: string, itemId: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id: itemId, userId },
      select: { orderId: true, attachments: { select: { storageKey: true } } },
    });
    if (!item) throw new Response("Not found", { status: 404 });
    const keys = item.attachments.map((a) => a.storageKey);

    await tx.item.delete({ where: { id: itemId } });

    // Remove the parent order once its last item is gone.
    const remaining = await tx.item.count({ where: { orderId: item.orderId } });
    if (remaining === 0) await tx.order.delete({ where: { id: item.orderId } });

    return keys;
  });
}

export interface DashboardSections {
  needsAttention: PurchaseListItem[];
  upcoming: PurchaseListItem[];
  refundsPending: PurchaseListItem[];
  all: PurchaseListItem[];
  deadlineToday: PurchaseListItem[];
}

/**
 * The four dashboard sections. "Needs attention" holds overdue open items and
 * returns whose tracking has gone quiet; "refunds pending" holds everything the
 * user has shipped but not yet confirmed money for.
 */
export function buildDashboardSections(
  items: PurchaseListItem[],
  now: Date = new Date(),
): DashboardSections {
  const overdue = items.filter((i) => i.displayStatus === "EXPIRED");
  const refundsPending = items.filter((i) => i.status === "REFUND_PENDING");
  const upcoming = items
    .filter((i) => i.status === "OPEN" && !i.isOverdue)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  const deadlineToday = items.filter((i) => i.status === "OPEN" && i.daysRemaining === 0);

  return {
    needsAttention: [...overdue, ...refundsPending.filter((r) => !overdue.includes(r))],
    upcoming,
    refundsPending,
    all: items,
    deadlineToday,
  };
}
