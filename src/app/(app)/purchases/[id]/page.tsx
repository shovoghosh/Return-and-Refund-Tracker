import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import { Card, Notice, PageHeader, StatusBadge } from "@/components/ui";
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-40 shrink-0 text-xs font-medium text-muted">{label}</dt>
      <dd className="text-sm">{children}</dd>
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={item.name}
        subtitle={item.storeName}
        action={
          <div className="flex items-center gap-4">
            <Link href="/purchases/new" className="text-sm font-medium text-accent hover:opacity-80">
              Add purchase
            </Link>
            <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
              ← Dashboard
            </Link>
          </div>
        }
      />

      {archived ? (
        <Notice tone="warn">This purchase is archived. It is hidden from your active list and reminders are paused.</Notice>
      ) : null}

      {item.displayStatus === "EXPIRED" ? (
        <Notice tone="warn">
          The return deadline has passed, but you can still update or correct this item.
        </Notice>
      ) : null}

      {item.status === "OPEN" && item.daysRemaining === 0 ? (
        <Notice tone="warn">Today is the last day to return this item.</Notice>
      ) : null}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base font-medium">{describeDeadline(item.returnDeadline, user.timezone, now)}</p>
          <StatusBadge status={item.displayStatus} label={statusLabel(item.displayStatus)} />
        </div>
        <dl className="divide-y divide-border">
          <Row label="Purchase date">{formatDeadline(item.purchaseDate, user.timezone)}</Row>
          <Row label="Return deadline">{formatDeadline(item.returnDeadline, user.timezone)}</Row>
          {item.orderNumber ? <Row label="Order number">{item.orderNumber}</Row> : null}
          {item.amountCents !== null ? (
            <Row label="Amount">{formatMoney(item.amountCents, item.currency)}</Row>
          ) : null}
          {item.itemUrl ? (
            <Row label="Item link">
              <a
                href={item.itemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline decoration-dotted"
              >
                {item.itemUrl}
              </a>
            </Row>
          ) : null}
          {item.notes ? <Row label="Notes">{item.notes}</Row> : null}
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Return &amp; refund</h2>
        <dl className="divide-y divide-border">
          {item.returnStartedAt ? (
            <Row label="Return started">{formatDeadline(item.returnStartedAt, user.timezone)}</Row>
          ) : null}
          {item.returnedAt ? <Row label="Returned">{formatDeadline(item.returnedAt, user.timezone)}</Row> : null}
          {item.carrier ? <Row label="Carrier">{item.carrier}</Row> : null}
          {item.trackingNumber ? <Row label="Tracking number">{item.trackingNumber}</Row> : null}
          {item.expectedRefundCents !== null ? (
            <Row label="Expected refund">
              {formatMoney(item.expectedRefundCents, item.currency)}
              {item.expectedRefundDate ? ` by ${formatDeadline(item.expectedRefundDate, user.timezone)}` : ""}
            </Row>
          ) : null}
          {item.actualRefundCents !== null ? (
            <Row label="Actual refund">
              {formatMoney(item.actualRefundCents, item.currency)}
              {item.actualRefundDate ? ` on ${formatDeadline(item.actualRefundDate, user.timezone)}` : ""}
            </Row>
          ) : null}
          {item.refundReceivedAt ? (
            <Row label="Refund confirmed">{formatWhen(item.refundReceivedAt, user.timezone)}</Row>
          ) : null}
          {item.returnNotes ? <Row label="Return notes">{item.returnNotes}</Row> : null}
          {item.expectedRefundDate === null &&
          item.status !== "REFUND_RECEIVED" &&
          item.status !== "KEPT" ? (
            <p className="pt-2 text-xs text-muted">
              An expected refund date is a reminder you set for yourself, not a promise from the store.
            </p>
          ) : null}
          {item.status === "REFUND_PENDING" && <RemindMeAgain itemId={item.id} />}
        </dl>
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

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Files</h2>
        <AttachmentControls
          itemId={item.id}
          attachments={item.attachments}
          maxFiles={getEnv().MAX_FILES_PER_ITEM}
          maxUploadMb={getEnv().MAX_UPLOAD_MB}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">History</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted">No history recorded yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="text-sm">{describeEvent(event.eventType, event.metadata)}</span>
                <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                  {formatWhen(event.createdAt, user.timezone)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href={`/purchases/${item.id}/edit`} className="text-sm font-medium text-accent hover:opacity-80">
          Edit purchase
        </Link>
      </div>

      <ArchiveDeleteControls itemId={item.id} archived={archived} />
    </div>
  );
}