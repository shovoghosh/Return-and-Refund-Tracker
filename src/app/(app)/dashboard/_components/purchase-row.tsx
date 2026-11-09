import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { STATUS_LABELS, formatDeadline } from "@/lib/status";
import type { PurchaseListItem } from "@/lib/dal";

/**
 * One purchase row. Always shows, in plain language:
 *  - the return deadline as an explicit date ("Return by October 12, 2026"),
 *  - how many local days remain (text, not colour alone),
 *  - the status as a labelled badge,
 *  - and, kept clearly separate, the expected refund date (never conflated with
 *    the return deadline).
 */
export function formatMoney(cents: number | null, currency: string | null): string | null {
  if (cents === null || cents === undefined) return null;
  const value = cents / 100;
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code ?? "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)}${code ? ` ${code}` : ""}`;
  }
}

export function daysText(days: number): string {
  if (Number.isNaN(days)) return "";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days > 1) return `${days} days left`;
  const past = Math.abs(days);
  return past === 1 ? "1 day past the deadline" : `${past} days past the deadline`;
}

export function PurchaseRow({
  item,
  timezone,
  showRefund = false,
}: {
  item: PurchaseListItem;
  timezone: string;
  showRefund?: boolean;
}) {
  const deadline = formatDeadline(item.returnDeadline, timezone);
  const money = formatMoney(item.amountCents, item.currency);
  const refundDate = item.expectedRefundDate
    ? formatDeadline(item.expectedRefundDate, timezone)
    : null;

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/purchases/${item.id}`}
        className="flex flex-col gap-2 rounded-lg px-2 py-3 transition hover:bg-accent/5 sm:px-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-foreground">{item.name}</span>
          <StatusBadge status={item.displayStatus} label={STATUS_LABELS[item.displayStatus]} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{item.storeName}</span>
          {item.orderNumber ? <span>Order {item.orderNumber}</span> : null}
          {money ? <span className="font-medium text-foreground">{money}</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-foreground">
            {item.isOverdue ? "Return deadline was " : "Return by "}
            <span className="font-medium">{deadline}</span>
          </span>
          {daysText(item.daysRemaining) ? (
            <span className="text-muted">{daysText(item.daysRemaining)}</span>
          ) : null}
        </div>

        {showRefund && refundDate ? (
          <div className="text-xs text-muted">
            Refund expected <span className="font-medium text-foreground">{refundDate}</span>
            {item.expectedRefundCents !== null
              ? ` (${formatMoney(item.expectedRefundCents, item.currency)})`
              : ""}{" "}
            — a reminder you set, not a promise from the store.
          </div>
        ) : null}
      </Link>
    </li>
  );
}