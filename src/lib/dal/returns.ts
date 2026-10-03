import { prisma } from "@/lib/db";
import { recordEvent } from "./events";
import { DateTime } from "luxon";

function dateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00.000Z`);
}

function toISO(d: Date | null | undefined): string | null {
  if (!d) return null;
  return DateTime.fromJSDate(d, { zone: "utc" }).toISODate();
}

export interface ReturnDetailsArgs {
  userId: string;
  itemId: string;
  returnStartedAt?: string | null;
  returnedAt?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  expectedRefundCents?: number | null;
  expectedRefundDate?: string | null;
  actualRefundCents?: number | null;
  actualRefundDate?: string | null;
  notes?: string | null;
}

/**
 * Upserts the single active return record for an item. When the return date or
 * expected refund date changes, pending refund reminders are rebuilt; the
 * suggested check-in is returned so the UI can label it as a user-editable
 * reminder rather than a retailer promise.
 */
export async function upsertReturnDetails(args: ReturnDetailsArgs, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id: args.itemId, userId: args.userId },
      select: { id: true, status: true, archivedAt: true, return: { select: { id: true } } },
    });
    if (!item) throw new Response("Not found", { status: 404 });

    const data = {
      ...(args.returnStartedAt !== undefined ? { returnStartedAt: dateOnly(args.returnStartedAt) } : {}),
      ...(args.returnedAt !== undefined ? { returnedAt: dateOnly(args.returnedAt) } : {}),
      ...(args.carrier !== undefined ? { carrier: args.carrier } : {}),
      ...(args.trackingNumber !== undefined ? { trackingNumber: args.trackingNumber } : {}),
      ...(args.expectedRefundCents !== undefined ? { expectedRefundCents: args.expectedRefundCents } : {}),
      ...(args.expectedRefundDate !== undefined ? { expectedRefundDate: dateOnly(args.expectedRefundDate) } : {}),
      ...(args.actualRefundCents !== undefined ? { actualRefundCents: args.actualRefundCents } : {}),
      ...(args.actualRefundDate !== undefined ? { actualRefundDate: dateOnly(args.actualRefundDate) } : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    };

    const rec = await tx.return.upsert({
      where: { itemId: args.itemId },
      create: { userId: args.userId, itemId: args.itemId, ...data },
      update: data,
    });

    await recordEvent({
      userId: args.userId,
      itemId: args.itemId,
      eventType: "RETURN_DETAILS_UPDATED",
      metadata: {
        carrier: rec.carrier ?? null,
        trackingNumber: rec.trackingNumber ?? null,
        expectedRefundDate: toISO(rec.expectedRefundDate),
      },
      tx,
    });

    return rec;
  });
}
