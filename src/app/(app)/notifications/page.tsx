import Link from "next/link";
import { DateTime } from "luxon";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { listPurchases } from "@/lib/dal";
import { labelForReminder, type ReminderType } from "@/lib/reminders";
import { STATUS_LABELS } from "@/lib/status";
import { Button, Card, EmptyState, Notice, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const DEADLINE_TYPES = ["DEADLINE_7", "DEADLINE_2", "DEADLINE_1", "DEADLINE_TODAY"] as const;
const REFUND_TYPES = ["REFUND_CHECK_IN", "REFUND_FOLLOW_UP"] as const;
const UPCOMING_WINDOW_DAYS = 7;

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

/**
 * In-app notification centre: the always-visible counterpart to the emails.
 * Deadlines are shown as explicit dates plus days remaining (never colour
 * alone), and recently sent reminders are listed so the user can see what the
 * app has actually emailed.
 */
export default async function NotificationsPage() {
  const user = await requireUser();
  const now = new Date();

  const [items, pending, pendingRefunds, recentSent] = await Promise.all([
    listPurchases(user.id, user.timezone, {}, now),
    prisma.reminderDelivery.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
        reminderType: { in: [...DEADLINE_TYPES] },
        scheduledFor: { gte: now, lte: DateTime.fromJSDate(now).plus({ days: UPCOMING_WINDOW_DAYS }).toJSDate() },
      },
      select: { itemId: true, reminderType: true, scheduledFor: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.reminderDelivery.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
        reminderType: { in: [...REFUND_TYPES] },
        scheduledFor: { gte: now },
      },
      select: { itemId: true, reminderType: true, scheduledFor: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.reminderDelivery.findMany({
      where: { userId: user.id, status: "SENT", sentAt: { not: null } },
      orderBy: { sentAt: "desc" },
      take: 10,
      select: {
        id: true,
        reminderType: true,
        sentAt: true,
        item: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Nearest pending reminder per item, within the next 7 days. Deadline and
  // refund check-ins are kept apart so the two very different dates are never
  // presented as if they meant the same thing.
  const nextReminder = new Map<string, Date>();
  const nextRefundReminder = new Map<string, Date>();
  for (const row of pending) {
    if (!nextReminder.has(row.itemId)) nextReminder.set(row.itemId, row.scheduledFor);
  }
  for (const row of pendingRefunds) {
    if (!nextRefundReminder.has(row.itemId)) nextRefundReminder.set(row.itemId, row.scheduledFor);
  }

  const openItems = items.filter((i) => i.status === "OPEN");
  const deadlineToday = openItems.filter((i) => i.daysRemaining === 0);

  const upcoming = openItems
    .filter((i) => {
      const next = nextReminder.get(i.id);
      const withinWindow = next !== undefined && next.getTime() - now.getTime() <= UPCOMING_WINDOW_DAYS * 86_400_000;
      const soonByDate = i.daysRemaining >= 0 && i.daysRemaining <= UPCOMING_WINDOW_DAYS;
      return withinWindow || soonByDate;
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const overdue = items.filter((i) => i.displayStatus === "EXPIRED");
  const refundsToCheck = items.filter((i) => i.status === "REFUND_PENDING" || i.status === "RETURNED");

  const addAction = (
    <Link href="/purchases/new">
      <Button>Add purchase</Button>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        subtitle="Deadlines coming up, items past their deadline, and reminders already sent to you."
        action={addAction}
      />

      {deadlineToday.length > 0 ? (
        <Notice tone="warn">
          {deadlineToday.length === 1
            ? `Today is the return deadline for ${deadlineToday[0].name}. Start the return today if you still want to send it back.`
            : `Today is the return deadline for ${deadlineToday.length} items. Check them before the day ends.`}
        </Notice>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-lg font-semibold">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No deadlines in the next 7 days"
            body="When a return deadline gets close, it shows up here with the exact date and how many days are left."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((item) => {
              const next = nextReminder.get(item.id);
              const nextLabel = next
                ? DateTime.fromJSDate(next, { zone: "utc" }).setZone(user.timezone).toFormat("ccc, LLL d 'at' h:mm a")
                : null;
              return (
                <li key={item.id}>
                  <Link href={`/purchases/${item.id}`} className="block focus:outline-none">
                    <Card className="transition hover:border-accent">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="mt-0.5 text-sm text-muted">{item.storeName}</p>
                        </div>
                        <StatusBadge status={item.status} label={STATUS_LABELS[item.status]} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-muted">Return by</dt>
                          <dd className="font-medium">
                            {DateTime.fromISO(item.returnDeadline, { zone: user.timezone }).toFormat("MMMM d, yyyy")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Time left</dt>
                          <dd className={item.daysRemaining === 0 ? "font-medium text-danger" : "font-medium"}>
                            {daysLabel(item.daysRemaining)}
                          </dd>
                        </div>
                      </dl>
                      {nextLabel ? (
                        <p className="mt-3 text-xs text-muted">Next email reminder: {nextLabel}</p>
                      ) : (
                        <p className="mt-3 text-xs text-muted">No further email reminders scheduled.</p>
                      )}
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="overdue-heading">
        <h2 id="overdue-heading" className="text-lg font-semibold">
          Overdue
        </h2>
        {overdue.length === 0 ? (
          <EmptyState title="Nothing is overdue" body="Items stay here after their deadline until you return them, keep them, or archive them." />
        ) : (
          <ul className="flex flex-col gap-3">
            {overdue.map((item) => (
              <li key={item.id}>
                <Link href={`/purchases/${item.id}`} className="block focus:outline-none">
                  <Card className="border-warn-border bg-warn-bg transition hover:border-accent">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.name}</p>
                        <p className="mt-0.5 text-sm text-muted">{item.storeName}</p>
                      </div>
                      <StatusBadge status="EXPIRED" label={STATUS_LABELS.EXPIRED} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-muted">Deadline was</dt>
                        <dd className="font-medium">
                          {DateTime.fromISO(item.returnDeadline, { zone: user.timezone }).toFormat("MMMM d, yyyy")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Status</dt>
                        <dd className="font-medium">{daysLabel(item.daysRemaining)}</dd>
                      </div>
                    </dl>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="refunds-heading">
        <h2 id="refunds-heading" className="text-lg font-semibold">
          Refund check-ins
        </h2>
        {refundsToCheck.length === 0 ? (
          <EmptyState
            title="No refunds waiting to be checked"
            body="Once you mark an item returned or refund pending, its check-in reminder appears here. The expected refund date is a reminder you set, not a promise from the store."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {refundsToCheck.map((item) => {
              const next = nextRefundReminder.get(item.id);
              const nextLabel = next
                ? DateTime.fromJSDate(next, { zone: "utc" }).setZone(user.timezone).toFormat("ccc, LLL d 'at' h:mm a")
                : null;
              return (
                <li key={item.id}>
                  <Link href={`/purchases/${item.id}`} className="block focus:outline-none">
                    <Card className="transition hover:border-accent">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="mt-0.5 text-sm text-muted">{item.storeName}</p>
                        </div>
                        <StatusBadge status={item.status} label={STATUS_LABELS[item.status]} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <dt className="text-muted">Expected refund</dt>
                          <dd className="font-medium">
                            {item.expectedRefundDate
                              ? DateTime.fromISO(item.expectedRefundDate, { zone: user.timezone }).toFormat("MMMM d, yyyy")
                              : "No date set"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Next check-in</dt>
                          <dd className="font-medium">{nextLabel ?? "Not scheduled yet"}</dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-xs text-muted">
                        Open the purchase to record a tracking number or confirm the refund yourself.
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sent-heading">
        <h2 id="sent-heading" className="text-lg font-semibold">
          Recently sent
        </h2>
        {recentSent.length === 0 ? (
          <EmptyState title="No reminders sent yet" body="Reminders the app emails you will be listed here with the date they went out." />
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {recentSent.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="text-sm">
                    {labelForReminder(row.reminderType as ReminderType)} —{" "}
                    <Link href={`/purchases/${row.item.id}`} className="underline underline-offset-2">
                      {row.item.name}
                    </Link>
                  </span>
                  <span className="text-xs text-muted">
                    {row.sentAt
                      ? DateTime.fromJSDate(row.sentAt, { zone: "utc" })
                          .setZone(user.timezone)
                          .toFormat("LLL d, yyyy 'at' h:mm a")
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <p className="text-xs text-muted">
          Reminder emails never put the item name or store in the subject line, so nothing private shows on a lock screen.
        </p>
      </section>

      <div className="flex">
        <Link href="/purchases/new">
          <Button>Add purchase</Button>
        </Link>
      </div>
    </div>
  );
}