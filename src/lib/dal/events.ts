import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Appends an audit event. Events are append-only: no update or delete path
 * exists anywhere in the app, so the history cannot be rewritten.
 *
 * SQLite (and therefore D1) has no JSON column type, so metadata is stored as
 * a JSON string and parsed on read.
 */
export async function recordEvent(params: {
  userId: string;
  itemId?: string;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const client = params.tx ?? prisma;
  await client.event.create({
    data: {
      userId: params.userId,
      itemId: params.itemId ?? null,
      eventType: params.eventType,
      metadata: JSON.stringify(params.metadata ?? {}),
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
  const rows = await prisma.event.findMany({
    where: { itemId, userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, eventType: true, metadata: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt,
  }));
}

/** Metadata is a JSON string column; malformed values degrade to an empty object. */
function parseMetadata(raw: string | null): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
