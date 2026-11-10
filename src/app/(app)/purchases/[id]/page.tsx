import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  ExternalLink,
  History,
  Link2,
  Package,
  Paperclip,
  Pencil,
  RotateCcw,
  StickyNote,
  Truck,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { getPurchase, listItemEvents } from "@/lib/dal";
import { describeEvent } from "@/lib/events";
import { rescheduleAllForUser } from "@/lib/reminders-service";
import {
  allowedNextStatuses,
  canTransition,
  formatDeadline,
  STATUS_LABELS,
} from "@/lib/status";
import {
  Badge,
  Card,
  IconTile,
  LinkButton,
  Notice,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { StatusControls, type StatusOption } from "../_components/status-controls";
import { ArchiveDeleteControls } from "../_components/archive-delete-controls";
import { RemindMeAgain } from "./remind-again-control";
import { ReturnDetailsForm } from "./return-details-form";
import { AttachmentControls } from "./attachment-controls";
import { describeDeadline, formatMoney, statusLabel } from "@/lib/core-tracking/logic";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Purchase — Return Tracker" };

function formatWhen(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

const FLOW = [
  { status: "OPEN", label: "Added", icon: Package },
  { status: "RETURN_STARTED", label: "Started", icon: RotateCcw },
  { status: "RETURNED", label: "Shipped", icon: Truck },
  { status: "REFUND_PENDING", label: "Pending", icon: Wallet },
  { status: "REFUND_RECEIVED", label: "Received", icon: CreditCard },
] as const;

function StatusTimeline({ status }: { status: string }) {
  if (status === "KEPT") {
    return (
      <p className="mt-4 rounded-xl border border-border/70 bg-surface-2/50 px-3 py-2.5 text-[0.72rem] leading-relaxed text-muted">
        Kept — no return is in progress for this item.
      </p>
    );
  }

  const current = Math.max(
    0,
    FLOW.findIndex((step) => step.status === status),
  );

  return (
    <ol className="flex w-full items-start" aria-label="Return progress">
      {FLOW.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        const Icon = step.icon;
        return (
          <li key={step.status} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                aria-hidden="true"
                className={`h-px flex-1 ${index === 0 ? "opacity-0" : complete || active ? "bg-accent/40" : "bg-border"}`}
              />
              <span
                className={`relative grid size-8 shrink-0 place-items-center rounded-full border text-[0.65rem] transition ${
                  active
                    ? "border-accent bg-accent text-accent-fg shadow-[0_0_0_4px_var(--ring)]"
                    : complete
                      ? "border-accent/30 bg-accent-soft text-accent"
                      : "border-border bg-surface text-muted"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span
                aria-hidden="true"
                className={`h-px flex-1 ${index === FLOW.length - 1 ? "opacity-0" : complete ? "bg-accent/40" : "bg-border"}`}
              />
            </div>
            <span
              className={`mt-2 max-w-full truncate px-0.5 text-center text-[0.58rem] font-medium sm:text-[0.65rem] ${
                active ? "text-accent" : complete ? "text-foreground-soft" : "text-muted"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function WeekRing({ days }: { days: number }) {
  const remaining = Math.max(0, Math.min(7, days));
  const points = Array.from({ length: 7 }, (_, index) => {
    const angle = (index / 7) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 60 + Math.cos(angle) * 44,
      y: 60 + Math.sin(angle) * 44,
      filled: index < remaining,
    };
  });

  return (
    <div className="relative mx-auto grid size-32 shrink-0 place-items-center sm:mx-0 sm:size-36">
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={point.filled ? 4 : 2.5}
            fill={point.filled ? "var(--accent)" : "var(--border-strong)"}
            opacity={point.filled ? 1 : 0.55}
          />
        ))}
      </svg>
      <div className="relative text-center">
        <p className="font-display text-3xl font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-4xl">
          {days < 0 ? Math.abs(days) : days}
        </p>
        <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
          {days < 0 ? "days past" : days === 0 ? "due today" : "days left"}
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 py-2.5">
      {icon ? <span className="mt-0.5 shrink-0 text-muted">{icon}</span> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <dt className="w-36 shrink-0 text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted">
          {label}
        </dt>
        <dd className="min-w-0 text-sm text-foreground-soft">{children}</dd>
      </div>
    </div>
  );
}

/**
 * Purchase detail. Shows the deadline as both an explicit date and a day count,
 * the item/return/refund facts, the status actions allowed by the shared rules,
 * the attachment list, and the append-only event history.
 */
export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const now = new Date();

  const item = await getPurchase(user.id, id, user.timezone, now);
  if (!item) notFound();

  // A missing reminders service (partial parallel build) must not break the page.
  try {
    await rescheduleAllForUser(user.id, now);
  } catch {
    // Intentionally ignored: rendering the read model is the priority here.
  }

  const events = await listItemEvents(user.id, item.id);
  const archived = Boolean(item.archivedAt);

  const statusOptions: StatusOption[] = allowedNextStatuses(item.status).map((status) => {
    const check = canTransition(item.status, status);
    return {
      status,
      label: STATUS_LABELS[status],
      requiresConfirmation: check.requiresConfirmation,
      reason: check.reason,
    };
  });

  const deadlineText =
    item.displayStatus === "EXPIRED"
      ? `${Math.abs(item.daysRemaining)} day${Math.abs(item.daysRemaining) === 1 ? "" : "s"} past the deadline`
      : item.daysRemaining === 0
        ? "Today is the last day to return"
        : `${item.daysRemaining} day${item.daysRemaining === 1 ? "" : "s"} left to start a return`;

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-up">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>

      <PageHeader
        eyebrow={item.storeName}
        title={item.name}
        subtitle={
          <span className="flex flex-col gap-0.5">
            <span>{describeDeadline(item.returnDeadline, user.timezone, now)}</span>
            {item.orderNumber ? <span className="text-xs">Order {item.orderNumber}</span> : null}
          </span>
        }
        action={
          <LinkButton href={`/purchases/${item.id}/edit`} variant="secondary">
            <Pencil className="size-4" aria-hidden="true" />
            Edit purchase
          </LinkButton>
        }
      />

      {archived ? (
        <Notice tone="warn" title="Archived purchase">
          This purchase is hidden from your active list and reminders are paused. Restore it below to
          bring it back.
        </Notice>
      ) : null}

      {item.displayStatus === "EXPIRED" ? (
        <Notice tone="warn" title="Deadline passed">
          The return deadline has passed, but you can still update or correct this item.
        </Notice>
      ) : null}

      {item.status === "OPEN" && item.daysRemaining === 0 ? (
        <Notice tone="warn" title="Last day">
          Today is the last day to return this item. Check the store&apos;s own cutoff before assuming
          midnight.
        </Notice>
      ) : null}

      <Card padding="lg" className="relative overflow-hidden border-accent/15">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-accent/10 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-accent-2/10 blur-3xl"
        />
        <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.displayStatus} label={statusLabel(item.displayStatus)} />
              {item.archivedAt ? <Badge tone="neutral">Archived</Badge> : null}
            </div>
            <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
              Return deadline
            </p>
            <p className="mt-1 font-display text-[2.1rem] font-semibold leading-none tracking-[-0.04em] sm:text-[2.7rem]">
              {formatDeadline(item.returnDeadline, user.timezone)}
            </p>
            <p
              className={`mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium ${
                item.displayStatus === "EXPIRED"
                  ? "text-danger"
                  : item.daysRemaining === 0
                    ? "text-warn"
                    : "text-muted"
              }`}
            >
              <CalendarDays className="size-4" aria-hidden="true" />
              {deadlineText}
            </p>

            <div className="mt-5">
              <StatusTimeline status={item.status} />
            </div>
          </div>
          <WeekRing days={item.daysRemaining} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col gap-5">
          <Card padding="lg">
            <div className="flex items-center gap-2.5">
              <IconTile tone="accent" size="sm">
                <Package />
              </IconTile>
              <h2 className="text-sm font-semibold">The purchase</h2>
            </div>
            <dl className="mt-3 divide-y divide-border/70">
              <Row label="Store" icon={<Package className="size-4" aria-hidden="true" />}>
                {item.storeName}
              </Row>
              <Row label="Purchase date" icon={<CalendarDays className="size-4" aria-hidden="true" />}>
                {formatDeadline(item.purchaseDate, user.timezone)}
              </Row>
              <Row label="Return deadline" icon={<CalendarDays className="size-4" aria-hidden="true" />}>
                {formatDeadline(item.returnDeadline, user.timezone)}
              </Row>
              {item.orderNumber ? (
                <Row label="Order number" icon={<Link2 className="size-4" aria-hidden="true" />}>
                  {item.orderNumber}
                </Row>
              ) : null}
              {item.amountCents !== null ? (
                <Row label="Amount" icon={<CreditCard className="size-4" aria-hidden="true" />}>
                  {formatMoney(item.amountCents, item.currency)}
                </Row>
              ) : null}
              {item.itemUrl ? (
                <Row label="Item link" icon={<ExternalLink className="size-4" aria-hidden="true" />}>
                  <a
                    href={item.itemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
                  >
                    {item.itemUrl}
                  </a>
                </Row>
              ) : null}
              {item.notes ? (
                <Row label="Notes" icon={<StickyNote className="size-4" aria-hidden="true" />}>
                  <span className="whitespace-pre-line">{item.notes}</span>
                </Row>
              ) : null}
            </dl>
          </Card>

          <Card padding="lg">
            <div className="flex items-center gap-2.5">
              <IconTile tone="moss" size="sm">
                <Wallet />
              </IconTile>
              <h2 className="text-sm font-semibold">Return &amp; refund</h2>
            </div>
            <dl className="mt-3 divide-y divide-border/70">
              {item.returnStartedAt ? (
                <Row label="Return started" icon={<RotateCcw className="size-4" aria-hidden="true" />}>
                  {formatDeadline(item.returnStartedAt, user.timezone)}
                </Row>
              ) : null}
              {item.returnedAt ? (
                <Row label="Returned" icon={<Truck className="size-4" aria-hidden="true" />}>
                  {formatDeadline(item.returnedAt, user.timezone)}
                </Row>
              ) : null}
              {item.carrier ? (
                <Row label="Carrier" icon={<Truck className="size-4" aria-hidden="true" />}>
                  {item.carrier}
                </Row>
              ) : null}
              {item.trackingNumber ? (
                <Row label="Tracking" icon={<Link2 className="size-4" aria-hidden="true" />}>
                  <span className="break-all font-mono text-[0.8rem]">{item.trackingNumber}</span>
                </Row>
              ) : null}
              {item.expectedRefundCents !== null ? (
                <Row label="Expected refund" icon={<Wallet className="size-4" aria-hidden="true" />}>
                  {formatMoney(item.expectedRefundCents, item.currency)}
                  {item.expectedRefundDate
                    ? ` by ${formatDeadline(item.expectedRefundDate, user.timezone)}`
                    : ""}
                </Row>
              ) : null}
              {item.actualRefundCents !== null ? (
                <Row label="Actual refund" icon={<CreditCard className="size-4" aria-hidden="true" />}>
                  {formatMoney(item.actualRefundCents, item.currency)}
                  {item.actualRefundDate
                    ? ` on ${formatDeadline(item.actualRefundDate, user.timezone)}`
                    : ""}
                </Row>
              ) : null}
              {item.refundReceivedAt ? (
                <Row label="Refund confirmed" icon={<CreditCard className="size-4" aria-hidden="true" />}>
                  {formatWhen(item.refundReceivedAt, user.timezone)}
                </Row>
              ) : null}
              {item.returnNotes ? (
                <Row label="Return notes" icon={<StickyNote className="size-4" aria-hidden="true" />}>
                  <span className="whitespace-pre-line">{item.returnNotes}</span>
                </Row>
              ) : null}
            </dl>

            {item.expectedRefundDate === null &&
            item.status !== "REFUND_RECEIVED" &&
            item.status !== "KEPT" ? (
              <p className="mt-2 rounded-lg border border-border/70 bg-surface-2/50 px-3 py-2 text-[0.7rem] leading-relaxed text-muted">
                An expected refund date is a reminder you set for yourself, not a promise from the
                store.
              </p>
            ) : null}

            {item.status === "REFUND_PENDING" ? <RemindMeAgain itemId={item.id} /> : null}
          </Card>

          <ReturnDetailsForm
            itemId={item.id}
            currency={item.currency}
            showActual={item.status === "REFUND_PENDING" || item.status === "REFUND_RECEIVED"}
            defaults={{
              returnStartedAt: item.returnStartedAt,
              returnedAt: item.returnedAt,
              carrier: item.carrier,
              trackingNumber: item.trackingNumber,
              expectedRefundCents: item.expectedRefundCents,
              expectedRefundDate: item.expectedRefundDate,
              actualRefundCents: item.actualRefundCents,
              actualRefundDate: item.actualRefundDate,
              notes: item.returnNotes,
            }}
          />

          {!archived ? <StatusControls itemId={item.id} options={statusOptions} /> : null}
        </div>

        <div className="flex flex-col gap-5">
          <Card padding="lg">
            <div className="flex items-center gap-2.5">
              <IconTile tone="sky" size="sm">
                <Paperclip />
              </IconTile>
              <h2 className="text-sm font-semibold">Files</h2>
            </div>
            <div className="mt-3">
              <AttachmentControls
                itemId={item.id}
                attachments={item.attachments}
                maxFiles={getEnv().MAX_FILES_PER_ITEM}
                maxUploadMb={getEnv().MAX_UPLOAD_MB}
              />
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex items-center gap-2.5">
              <IconTile tone="lilac" size="sm">
                <History />
              </IconTile>
              <h2 className="text-sm font-semibold">History</h2>
            </div>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No history recorded yet.</p>
            ) : (
              <ol className="mt-4 flex flex-col">
                {events.map((event, index) => (
                  <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index !== events.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-[0.3rem] top-4 h-full w-px bg-border"
                      />
                    ) : null}
                    <span
                      aria-hidden="true"
                      className="relative mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-surface bg-accent/60"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.78rem] leading-snug text-foreground-soft">
                        {describeEvent(event.eventType, event.metadata)}
                      </p>
                      <time
                        dateTime={event.createdAt.toISOString()}
                        className="mt-0.5 block text-[0.65rem] text-muted"
                      >
                        {formatWhen(event.createdAt, user.timezone)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <ArchiveDeleteControls itemId={item.id} archived={archived} />
        </div>
      </div>
    </div>
  );
}
