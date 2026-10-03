import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Appends an audit event. Events are append-only: no update or delete path
 * exists anywhere in the app, so the history cannot be rewritten.
 */
export async function recordEvent(params: {
  userId: string;
  itemId: string;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const client = params.tx ?? prisma;
  await client.event.create({
    data: {
      userId: params.userId,
      itemId: params.itemId,
      eventType: params.eventType,
      metadata: params.metadata ?? {},
    },
  });
}

export interface ItemEvent {
  id: string;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
}

/** Newest-first event history for one item, scoped to the owner. */
export async function listItemEvents(userId: string, itemId: string, limit = 200): Promise<ItemEvent[]> {
  return prisma.event.findMany({
    where: { itemId, userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, eventType: true, metadata: true, createdAt: true },
  });
}
