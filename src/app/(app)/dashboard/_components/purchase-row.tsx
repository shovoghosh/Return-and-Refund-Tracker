import Link from "next/link";
import {
  Archive,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Hourglass,
  Package,
  RotateCcw,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Badge, IconTile, StatusBadge } from "@/components/ui";
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

const STATUS_ICONS: Record<string, { icon: LucideIcon; tone: "accent" | "warm" | "sky" | "moss" | "lilac" | "danger" | "neutral" }> = {
  OPEN: { icon: Package, tone: "sky" },
  RETURN_STARTED: { icon: RotateCcw, tone: "warm" },
  RETURNED: { icon: Truck, tone: "lilac" },
  REFUND_PENDING: { icon: Hourglass, tone: "warm" },
  REFUND_RECEIVED: { icon: BadgeCheck, tone: "moss" },
  KEPT: { icon: Archive, tone: "neutral" },
  EXPIRED: { icon: TriangleAlert, tone: "danger" },
};

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
  const meta = STATUS_ICONS[item.displayStatus] ?? STATUS_ICONS.OPEN;
  const StatusIcon = meta.icon;
  const urgent = item.displayStatus === "EXPIRED" || item.daysRemaining === 0;

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <Link
        href={`/purchases/${item.id}`}
        className="group flex items-start gap-3 rounded-xl px-2.5 py-3.5 transition-colors duration-200 hover:bg-surface-2/65 sm:px-3"
      >
        <IconTile tone={meta.tone} size="md" className="mt-0.5">
          <StatusIcon />
        </IconTile>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
                  {item.name}
                </span>
                {item.archivedAt ? (
                  <Badge tone="neutral" icon={<Archive className="size-3" aria-hidden="true" />}>
                    Archived
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.72rem] text-muted">
                <span>{item.storeName}</span>
                {item.orderNumber ? (
                  <>
                    <span aria-hidden="true" className="size-1 rounded-full bg-border-strong" />
                    <span>Order {item.orderNumber}</span>
                  </>
                ) : null}
                {money ? (
                  <>
                    <span aria-hidden="true" className="size-1 rounded-full bg-border-strong" />
                    <span className="font-semibold text-foreground-soft">{money}</span>
                  </>
                ) : null}
              </div>
            </div>
            <StatusBadge status={item.displayStatus} label={STATUS_LABELS[item.displayStatus]} />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="chip">
              <CalendarDays className="size-3 text-muted" aria-hidden="true" />
              {item.isOverdue ? "Was due " : "Return by "}
              <span className="font-semibold text-foreground-soft">{deadline}</span>
            </span>
            {daysText(item.daysRemaining) ? (
              <span
                className={
                  urgent
                    ? "text-[0.7rem] font-semibold text-danger"
                    : item.daysRemaining <= 7
                      ? "text-[0.7rem] font-medium text-warn"
                      : "text-[0.7rem] text-muted"
                }
              >
                {daysText(item.daysRemaining)}
              </span>
            ) : null}
          </div>

          {showRefund && refundDate ? (
            <div className="mt-2 rounded-lg border border-border/70 bg-surface-2/50 px-2.5 py-1.5 text-[0.7rem] leading-relaxed text-muted">
              Refund expected{" "}
              <span className="font-semibold text-foreground-soft">{refundDate}</span>
              {item.expectedRefundCents !== null
                ? ` (${formatMoney(item.expectedRefundCents, item.currency)})`
                : ""}{" "}
              — a reminder you set, not a promise from the store.
            </div>
          ) : null}
        </div>

        <ChevronRight
          aria-hidden="true"
          className="mt-2 size-4 shrink-0 text-border-strong transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </Link>
    </li>
  );
}
