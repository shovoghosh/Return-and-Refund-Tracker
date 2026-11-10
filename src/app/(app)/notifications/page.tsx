import Link from "next/link";
import { DateTime } from "luxon";
import {
  ArrowUpRight,
  Bell,
  CalendarClock,
  CalendarDays,
  Clock3,
  Mail,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { listPurchases } from "@/lib/dal";
import { labelForReminder, type ReminderType } from "@/lib/reminders";
import { STATUS_LABELS } from "@/lib/status";
import {
  Card,
  EmptyState,
  IconTile,
  LinkButton,
  Notice,
  PageHeader,
  SectionHeading,
  StatusBadge,
} from "@/components/ui";

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

function InlineStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground-soft">{children}</p>
    </div>
  );
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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Reminder centre"
        title="Notifications"
        subtitle="Deadlines coming up, items past their deadline, and the reminders already sent to you."
        action={
          <LinkButton href="/purchases/new">
            <CalendarDays className="size-4" aria-hidden="true" />
            Add purchase
          </LinkButton>
        }
      />

      {deadlineToday.length > 0 ? (
        <Notice tone="warn" title="Today is the day">
          {deadlineToday.length === 1
            ? `Today is the return deadline for ${deadlineToday[0].name}. Start the return today if you still want to send it back.`
            : `Today is the return deadline for ${deadlineToday.length} items. Check them before the day ends.`}
        </Notice>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="upcoming-heading">
        <SectionHeading
          id="upcoming-heading"
          title="Upcoming"
          hint="The next 7 days, soonest first."
          icon={<CalendarClock />}
          count={upcoming.length}
        />
        {upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title="No deadlines in the next 7 days"
            body="When a return deadline gets close, it shows up here with the exact date and how many days are left."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {upcoming.map((item) => {
              const next = nextReminder.get(item.id);
              const nextLabel = next
                ? DateTime.fromJSDate(next, { zone: "utc" }).setZone(user.timezone).toFormat("ccc, LLL d 'at' h:mm a")
                : null;
              return (
                <li key={item.id}>
                  <Card padding="sm" hover className="h-full">
                    <Link href={`/purchases/${item.id}`} className="group block">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <IconTile tone={item.daysRemaining === 0 ? "warm" : "sky"} size="sm">
                            <CalendarClock />
                          </IconTile>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold transition-colors group-hover:text-accent">
                              {item.name}
                            </p>
                            <p className="truncate text-[0.7rem] text-muted">{item.storeName}</p>
                          </div>
                        </div>
                        <StatusBadge status={item.status} label={STATUS_LABELS[item.status]} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-surface-2/45 p-2.5">
                        <InlineStat label="Return by">
                          {DateTime.fromISO(item.returnDeadline, { zone: user.timezone }).toFormat("MMM d, yyyy")}
                        </InlineStat>
                        <InlineStat label="Time left">
                          <span className={item.daysRemaining === 0 ? "text-danger" : undefined}>
                            {daysLabel(item.daysRemaining)}
                          </span>
                        </InlineStat>
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 text-[0.68rem] text-muted">
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {nextLabel ? `Next email: ${nextLabel}` : "No further email reminders scheduled."}
                        </span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="ml-auto size-3.5 shrink-0 text-border-strong transition group-hover:text-accent"
                        />
                      </div>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="overdue-heading">
        <SectionHeading
          id="overdue-heading"
          title="Overdue"
          hint="Past the deadline but still on your list."
          icon={<TriangleAlert />}
          count={overdue.length}
        />
        {overdue.length === 0 ? (
          <EmptyState
            icon={<TriangleAlert />}
            title="Nothing is overdue"
            body="Items stay here after their deadline until you return them, keep them, or archive them."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {overdue.map((item) => (
              <li key={item.id}>
                <Card tone="warm" padding="sm" hover className="h-full">
                  <Link href={`/purchases/${item.id}`} className="group block">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <IconTile tone="warm" size="sm">
                          <TriangleAlert />
                        </IconTile>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold transition-colors group-hover:text-accent">
                            {item.name}
                          </p>
                          <p className="truncate text-[0.7rem] text-muted">{item.storeName}</p>
                        </div>
                      </div>
                      <StatusBadge status="EXPIRED" label={STATUS_LABELS.EXPIRED} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-warn-border/70 bg-surface/45 p-2.5">
                      <InlineStat label="Deadline was">
                        {DateTime.fromISO(item.returnDeadline, { zone: user.timezone }).toFormat("MMM d, yyyy")}
                      </InlineStat>
                      <InlineStat label="Time since">
                        <span className="text-danger">{daysLabel(item.daysRemaining)}</span>
                      </InlineStat>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-[0.68rem] text-muted">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      Update it, return it, or archive it.
                      <ArrowUpRight
                        aria-hidden="true"
                        className="ml-auto size-3.5 shrink-0 text-border-strong transition group-hover:text-accent"
                      />
                    </div>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="refunds-heading">
        <SectionHeading
          id="refunds-heading"
          title="Refund check-ins"
          hint="Money you are still waiting to confirm."
          icon={<Wallet />}
          count={refundsToCheck.length}
        />
        {refundsToCheck.length === 0 ? (
          <EmptyState
            icon={<Wallet />}
            title="No refunds waiting to be checked"
            body="Once you mark an item returned or refund pending, its check-in reminder appears here. The expected refund date is a reminder you set, not a promise from the store."
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {refundsToCheck.map((item) => {
              const next = nextRefundReminder.get(item.id);
              const nextLabel = next
                ? DateTime.fromJSDate(next, { zone: "utc" }).setZone(user.timezone).toFormat("ccc, LLL d 'at' h:mm a")
                : null;
              return (
                <li key={item.id}>
                  <Card padding="sm" hover className="h-full">
                    <Link href={`/purchases/${item.id}`} className="group block">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <IconTile tone="moss" size="sm">
                            <Wallet />
                          </IconTile>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold transition-colors group-hover:text-accent">
                              {item.name}
                            </p>
                            <p className="truncate text-[0.7rem] text-muted">{item.storeName}</p>
                          </div>
                        </div>
                        <StatusBadge status={item.status} label={STATUS_LABELS[item.status]} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border/70 bg-surface-2/45 p-2.5">
                        <InlineStat label="Expected refund">
                          {item.expectedRefundDate
                            ? DateTime.fromISO(item.expectedRefundDate, { zone: user.timezone }).toFormat("MMM d, yyyy")
                            : "No date set"}
                        </InlineStat>
                        <InlineStat label="Next check-in">{nextLabel ?? "Not scheduled yet"}</InlineStat>
                      </div>

                      <div className="mt-3 flex items-center gap-1.5 text-[0.68rem] text-muted">
                        <Bell className="size-3.5" aria-hidden="true" />
                        Open the purchase to record tracking or confirm the refund yourself.
                        <ArrowUpRight
                          aria-hidden="true"
                          className="ml-auto size-3.5 shrink-0 text-border-strong transition group-hover:text-accent"
                        />
                      </div>
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="sent-heading">
        <SectionHeading
          id="sent-heading"
          title="Recently sent"
          hint="A receipt of what we emailed you."
          icon={<Mail />}
          count={recentSent.length}
        />
        {recentSent.length === 0 ? (
          <EmptyState
            icon={<Mail />}
            title="No reminders sent yet"
            body="Reminders the app emails you will be listed here with the date they went out."
          />
        ) : (
          <Card padding="none">
            <ul className="divide-y divide-border/70 px-4 sm:px-5">
              {recentSent.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-4 last:pb-4">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-muted">
                      <Mail className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="truncate">
                      {labelForReminder(row.reminderType as ReminderType)} —{" "}
                      <Link
                        href={`/purchases/${row.item.id}`}
                        className="font-medium underline underline-offset-2 hover:text-accent"
                      >
                        {row.item.name}
                      </Link>
                    </span>
                  </span>
                  <span className="text-[0.68rem] text-muted">
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
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <Bell className="mt-px size-3.5 shrink-0 text-moss" aria-hidden="true" />
          Reminder emails never put the item name or store in the subject line, so nothing private
          shows on a lock screen.
        </p>
      </section>
    </div>
  );
}
