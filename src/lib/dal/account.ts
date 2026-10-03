import { prisma } from "@/lib/db";

export interface ExportRow {
  item_name: string;
  store_name: string;
  order_number: string;
  purchase_date: string;
  return_deadline: string;
  status: string;
  amount: string;
  currency: string;
  item_url: string;
  notes: string;
  return_started_at: string;
  returned_at: string;
  carrier: string;
  tracking_number: string;
  expected_refund_amount: string;
  expected_refund_date: string;
  actual_refund_amount: string;
  actual_refund_date: string;
  refund_received_at: string;
  attachment_count: string;
  created_at: string;
}

function iso(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
function stamp(d: Date | null | undefined): string {
  return d ? d.toISOString() : "";
}
function money(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}

/**
 * Full data export for one user. Only ever reads rows where userId matches, so
 * an export can never contain another account's purchases.
 */
export async function exportUserData(userId: string): Promise<{
  exportedAt: string;
  user: { email: string; timezone: string };
  items: ExportRow[];
}> {
  const user = await prisma.user.findFirstOrThrow({
    where: { id: userId },
    select: { email: true, timezone: true },
  });

  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      name: true,
      status: true,
      amountCents: true,
      currency: true,
      itemUrl: true,
      notes: true,
      returnDeadline: true,
      createdAt: true,
      order: { select: { storeName: true, orderNumber: true, purchaseDate: true } },
      return: {
        select: {
          returnStartedAt: true,
          returnedAt: true,
          carrier: true,
          trackingNumber: true,
          expectedRefundCents: true,
          expectedRefundDate: true,
          actualRefundCents: true,
          actualRefundDate: true,
          refundReceivedAt: true,
        },
      },
      _count: { select: { attachments: true } },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    user,
    items: items.map((i) => ({
      item_name: i.name,
      store_name: i.order.storeName,
      order_number: i.order.orderNumber ?? "",
      purchase_date: iso(i.order.purchaseDate),
      return_deadline: iso(i.returnDeadline),
      status: i.status,
      amount: money(i.amountCents),
      currency: i.currency ?? "",
      item_url: i.itemUrl ?? "",
      notes: i.notes ?? "",
      return_started_at: iso(i.return?.returnStartedAt),
      returned_at: iso(i.return?.returnedAt),
      carrier: i.return?.carrier ?? "",
      tracking_number: i.return?.trackingNumber ?? "",
      expected_refund_amount: money(i.return?.expectedRefundCents),
      expected_refund_date: iso(i.return?.expectedRefundDate),
      actual_refund_amount: money(i.return?.actualRefundCents),
      actual_refund_date: iso(i.return?.actualRefundDate),
      refund_received_at: stamp(i.return?.refundReceivedAt),
      attachment_count: String(i._count.attachments),
      created_at: stamp(i.createdAt),
    })),
  };
}

export function toCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]) as Array<keyof ExportRow>;
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  return lines.join("\n");
}

/** Deletes the account and every owned row. Returns storage keys to purge. */
export async function deleteAccount(userId: string): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const attachments = await tx.attachment.findMany({
      where: { userId },
      select: { storageKey: true },
    });
    // Cascades remove items, orders, returns, attachments, events, deliveries,
    // sessions and verification tokens.
    await tx.user.delete({ where: { id: userId } });
    return attachments.map((a) => a.storageKey);
  });
}
