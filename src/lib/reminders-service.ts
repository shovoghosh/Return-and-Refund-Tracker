import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { recordEvent } from "@/lib/dal";
import { sendMail } from "@/lib/mail";
import {
  SUGGESTED_REFUND_CHECK_IN_DAYS,
  buildRefundFollowUp,
  normalizeOffsets,
  planDeadlineReminders,
  planRefundReminders,
  type PlannedReminder,
} from "@/lib/reminders";
import { formatDeadline, shouldSendDeadlineReminders, toItemStatus, type ItemStatus } from "@/lib/status";
import type { ReminderType } from "@/lib/reminders";

/**
 * Scheduling + delivery layer for the reminder engine.
 *
 * Two ideas keep this reliable:
 *  1. Reminders are materialised as ReminderDelivery rows. The worker only ever
 *     looks for due rows, and the (itemId, reminderType, scheduledFor) unique key
 *     makes the schedule idempotent.
 *  2. Delivery is at-most-once: the worker CLAIMS a row with a conditional
 *     update (PENDING -> SENT) and only sends when that update reported exactly
 *     one row. A retry or a second concurrent worker sees zero and skips, so a
 *     reminder stage can never be emailed twice.
 *
 * SENT / FAILED rows are the audit trail and are never rewritten by rescheduling.
 */

const DEADLINE_TYPES: ReadonlySet<ReminderType> = new Set([
  "DEADLINE_7",
  "DEADLINE_2",
  "DEADLINE_1",
  "DEADLINE_TODAY",
]);

/** Statuses that can currently have future reminders worth (re)scheduling. */
const SCHEDULABLE_STATUSES: ItemStatus[] = ["OPEN", "RETURNED", "REFUND_PENDING"];

function toISO(d: Date | null | undefined): string | null {
  if (!d) return null;
  return DateTime.fromJSDate(d, { zone: "utc" }).toISODate();
}

interface SchedulePrefs {
  timezone: string;
  reminderOffsets: number[];
  reminderHour: number;
  emailRemindersOn: boolean;
}

async function loadPrefs(userId: string): Promise<SchedulePrefs> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true, reminderOffsets: true, reminderHour: true, emailRemindersOn: true },
  });
  return {
    timezone: user.timezone,
    reminderOffsets: normalizeOffsets(user.reminderOffsets),
    reminderHour: user.reminderHour,
    emailRemindersOn: user.emailRemindersOn,
  };
}

/** The item fields every scheduling decision depends on. */
const ITEM_PLAN_SELECT = {
  id: true,
  returnDeadline: true,
  status: true,
  archivedAt: true,
  return: { select: { expectedRefundDate: true, returnedAt: true } },
} as const;

type PlannableItem = {
  id: string;
  returnDeadline: Date;
  /** Raw column value; narrowed with toItemStatus before use. */
  status: string;
  archivedAt: Date | null;
  return: { expectedRefundDate: Date | null; returnedAt: Date | null } | null;
};

function planForItem(item: PlannableItem, prefs: SchedulePrefs, now: Date): PlannedReminder[] {
  // Email reminders switched off: the user keeps the in-app centre but the queue
  // stays empty (and any worker run would cancel, not send).
  if (!prefs.emailRemindersOn) return [];
  const deadlineISO = toISO(item.returnDeadline) ?? "";
  const deadline = planDeadlineReminders({
    deadlineISO,
    timezone: prefs.timezone,
    offsets: prefs.reminderOffsets,
    hour: prefs.reminderHour,
    now,
    status: toItemStatus(item.status),
    archivedAt: item.archivedAt,
  });
  const refund = planRefundReminders({
    expectedRefundDateISO: toISO(item.return?.expectedRefundDate),
    returnedAt: item.return?.returnedAt ?? null,
    timezone: prefs.timezone,
    hour: prefs.reminderHour,
    now,
    status: toItemStatus(item.status),
    archivedAt: item.archivedAt,
  });
  return [...deadline, ...refund.reminders];
}

/**
 * Upserts each planned reminder on the unique key. Because planned instants are
 * always in the future, they can never collide with an already SENT/FAILED row,
 * so reviving a CANCELLED row back to PENDING is safe and keeps the queue stable
 * across repeated runs.
 */
async function upsertPlanned(userId: string, itemId: string, reminders: PlannedReminder[]): Promise<void> {
  for (const p of reminders) {
    await prisma.reminderDelivery.upsert({
      where: {
        itemId_reminderType_scheduledFor: {
          itemId,
          reminderType: p.type,
          scheduledFor: p.scheduledFor,
        },
      },
      create: {
        userId,
        itemId,
        reminderType: p.type,
        scheduledFor: p.scheduledFor,
        status: "PENDING",
      },
      update: { status: "PENDING", lastError: null, attemptCount: 0 },
    });
  }
}

/**
 * Rebuilds the whole pending queue for one user (settings changed: timezone,
 * offsets, send hour, or email reminder toggle). Cancels every PENDING row, then
 * reschedules from scratch. Idempotent: two runs leave the same pending set.
 */
export async function rescheduleAllForUser(
  userId: string,
  now: Date = new Date(),
): Promise<{ cancelled: number; created: number }> {
  const prefs = await loadPrefs(userId);

  const cancelled = (
    await prisma.reminderDelivery.updateMany({
      where: { userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    })
  ).count;

  const items = await prisma.item.findMany({
    where: { userId, archivedAt: null, status: { in: SCHEDULABLE_STATUSES } },
    select: ITEM_PLAN_SELECT,
  });

  let created = 0;
  for (const item of items) {
    const planned = planForItem(item, prefs, now);
    await upsertPlanned(userId, item.id, planned);
    created += planned.length;
  }

  return { cancelled, created };
}

/**
 * Recomputes the pending queue for a single item. Used after return-detail edits
 * and after a user chooses "Remind me again".
 */
export async function syncItemReminders(
  userId: string,
  itemId: string,
  now: Date = new Date(),
): Promise<void> {
  const prefs = await loadPrefs(userId);
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: ITEM_PLAN_SELECT,
  });
  if (!item) throw new Response("Not found", { status: 404 });

  await prisma.reminderDelivery.updateMany({
    where: { itemId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  await upsertPlanned(userId, itemId, planForItem(item, prefs, now));
}

/**
 * Creates ONE extra refund follow-up row (the "Remind me again" action), seven
 * days after `from` by default. Idempotent: if an identical PENDING row already
 * exists it is left untouched.
 */
export async function scheduleRefundFollowUp(
  userId: string,
  itemId: string,
  from: Date = new Date(),
): Promise<{ scheduledFor: Date }> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });
  if (!item) throw new Response("Not found", { status: 404 });

  const prefs = await loadPrefs(userId);
  const planned = buildRefundFollowUp(from, prefs.timezone, prefs.reminderHour);

  const existing = await prisma.reminderDelivery.findFirst({
    where: {
      itemId,
      reminderType: planned.type,
      scheduledFor: planned.scheduledFor,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (!existing) {
    await prisma.reminderDelivery.upsert({
      where: {
        itemId_reminderType_scheduledFor: {
          itemId,
          reminderType: planned.type,
          scheduledFor: planned.scheduledFor,
        },
      },
      create: {
        userId,
        itemId,
        reminderType: planned.type,
        scheduledFor: planned.scheduledFor,
        status: "PENDING",
      },
      update: { status: "PENDING", lastError: null },
    });
  }

  return { scheduledFor: planned.scheduledFor };
}

/** Everything the mailer needs for one due reminder, owner already joined in. */
export interface DueReminder {
  id: string;
  userId: string;
  itemId: string;
  reminderType: ReminderType;
  scheduledFor: Date;
  attemptCount: number;
  itemName: string;
  storeName: string;
  /** The item's return deadline as a local YYYY-MM-DD date. */
  deadlineISO: string;
  expectedRefundDateISO: string | null;
  returnedAtISO: string | null;
  status: ItemStatus;
  archivedAt: Date | null;
  timezone: string;
  email: string;
  emailRemindersOn: boolean;
  emailVerified: boolean;
}

/** PENDING rows that are due at or before `now`, oldest first. */
export async function dueReminders(now: Date = new Date(), limit = 100): Promise<DueReminder[]> {
  const rows = await prisma.reminderDelivery.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      userId: true,
      itemId: true,
      reminderType: true,
      scheduledFor: true,
      attemptCount: true,
      item: {
        select: {
          name: true,
          returnDeadline: true,
          status: true,
          archivedAt: true,
          order: { select: { storeName: true } },
          return: { select: { expectedRefundDate: true, returnedAt: true } },
        },
      },
      user: { select: { email: true, timezone: true, emailRemindersOn: true, emailVerifiedAt: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    itemId: r.itemId,
    reminderType: r.reminderType as ReminderType,
    scheduledFor: r.scheduledFor,
    attemptCount: r.attemptCount,
    itemName: r.item.name,
    storeName: r.item.order.storeName,
    deadlineISO: toISO(r.item.returnDeadline) ?? "",
    expectedRefundDateISO: toISO(r.item.return?.expectedRefundDate),
    returnedAtISO: toISO(r.item.return?.returnedAt),
    status: toItemStatus(r.item.status),
    archivedAt: r.item.archivedAt,
    timezone: r.user.timezone,
    email: r.user.email,
    emailRemindersOn: r.user.emailRemindersOn,
    emailVerified: Boolean(r.user.emailVerifiedAt),
  }));
}

/**
 * Whether a reminder still makes sense for the item's current state. Deadline
 * reminders follow the same suppression rule as the scheduler; refund reminders
 * only apply while a return is out and the refund has not been resolved.
 */
function isRelevant(row: DueReminder): boolean {
  if (row.archivedAt) return false;
  if (!row.emailRemindersOn) return false;
  if (DEADLINE_TYPES.has(row.reminderType)) {
    return shouldSendDeadlineReminders(row.status, row.archivedAt);
  }
  return row.status === "RETURNED" || row.status === "REFUND_PENDING";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the reminder email. The SUBJECT is deliberately neutral and never
 * contains the item name, store, or order number: an email subject is visible in
 * notification previews and lock screens. The BODY may name the item and store,
 * always carries the absolute deadline date, and links back into the app.
 */
export function buildReminderEmail(row: DueReminder): {
  to: string;
  subject: string;
  text: string;
  html: string;
} {
  const appUrl = getEnv().APP_URL.replace(/\/+$/, "");
  const link = `${appUrl}/purchases/${row.itemId}`;
  const isDeadline = DEADLINE_TYPES.has(row.reminderType);
  const isToday = row.reminderType === "DEADLINE_TODAY";

  if (isDeadline) {
    const deadlineText = row.deadlineISO ? formatDeadline(row.deadlineISO, row.timezone) : "soon";
    const subject = isToday ? "A return deadline is today" : "A return deadline is coming up";

    const text = [
      "Hi,",
      "",
      `Your "${row.itemName}" from ${row.storeName} has a return deadline on ${deadlineText}.`,
      ...(isToday
        ? ["", "TODAY IS THE DEADLINE — start the return today if you still want to send it back."]
        : []),
      "",
      `Open it here: ${link}`,
      "",
      "Return Tracker never confirms refunds for you — you tell it when the money actually arrives.",
      "",
      "You are receiving this because you asked Return Tracker to remind you about this return.",
    ].join("\n");

    const html = [
      "<p>Hi,</p>",
      `<p>Your <strong>${escapeHtml(row.itemName)}</strong> from <strong>${escapeHtml(
        row.storeName,
      )}</strong> has a return deadline on <strong>${escapeHtml(deadlineText)}</strong>.</p>`,
      ...(isToday
        ? ["<p><strong>TODAY IS THE DEADLINE</strong> — start the return today if you still want to send it back.</p>"]
        : []),
      `<p><a href="${escapeHtml(link)}">Open it in Return Tracker</a></p>`,
      "<p>Return Tracker never confirms refunds for you — you tell it when the money actually arrives.</p>",
    ].join("\n");

    return { to: row.email, subject, text, html };
  }

  // Refund reminder.
  const checkInISO =
    row.expectedRefundDateISO ??
    (row.returnedAtISO
      ? DateTime.fromISO(row.returnedAtISO, { zone: "utc" })
          .plus({ days: SUGGESTED_REFUND_CHECK_IN_DAYS })
          .toISODate()
      : null);
  const checkInText = checkInISO ? formatDeadline(checkInISO, row.timezone) : null;
  const subject = "Time to check on a refund";

  const text = [
    "Hi,",
    "",
    `It's time to check on the refund for your "${row.itemName}" from ${row.storeName}.`,
    ...(checkInText ? [`You were expecting it around ${checkInText}.`] : []),
    "",
    `Open it here: ${link}`,
    "",
    "Return Tracker never confirms refunds for you — you mark it received yourself once you see the money.",
    "",
    "You are receiving this because you asked Return Tracker to remind you about this refund.",
  ].join("\n");

  const html = [
    "<p>Hi,</p>",
    `<p>It's time to check on the refund for your <strong>${escapeHtml(
      row.itemName,
    )}</strong> from <strong>${escapeHtml(row.storeName)}</strong>.</p>`,
    ...(checkInText ? [`<p>You were expecting it around <strong>${escapeHtml(checkInText)}</strong>.</p>`] : []),
    `<p><a href="${escapeHtml(link)}">Open it in Return Tracker</a></p>`,
    "<p>Return Tracker never confirms refunds for you — you mark it received yourself once you see the money.</p>",
  ].join("\n");

  return { to: row.email, subject, text, html };
}

export interface DispatchSummary {
  sent: number;
  failed: number;
  skipped: number;
  cancelled: number;
  retried: number;
}

/** Exponential backoff windows (ms) used before a FAILED reminder is retried. */
function backoffMsFor(attemptCount: number): number {
  switch (attemptCount) {
    case 1:
      return 60 * 60 * 1000; // attempt 1 -> 60 minutes
    case 2:
      return 4 * 60 * 60 * 1000; // attempt 2 -> 4 hours
    default:
      return 24 * 60 * 60 * 1000; // attempt 3+ -> 24 hours
  }
}

/**
 * Worker entry point. For each due row: cancel it when the item no longer needs
 * it, otherwise claim it and send exactly once.
 */
export async function dispatchDueReminders(
  now: Date = new Date(),
  limit = 100,
): Promise<DispatchSummary> {
  const retried: string[] = [];

  // Expired-failure recovery: fetch rows whose last failure has exceeded the
  // exponential backoff, and revive them to PENDING so the normal send path
  // handles them. attemptCount 4 is the hard retry ceiling (a row reaching
  // attemptCount 4 on a failure stays FAILED forever).
  if (limit > 0) {
    const expiredFailures = await prisma.reminderDelivery.findMany({
      where: {
        status: "FAILED",
        scheduledFor: { lte: now },
        attemptCount: { gte: 1, lte: 3 }, // attemptCount 4 is the retry ceiling
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        userId: true,
        itemId: true,
        reminderType: true,
        scheduledFor: true,
        attemptCount: true,
      },
    });

    for (const row of expiredFailures) {
      const backoff = backoffMsFor(row.attemptCount);
      const elapsed = now.getTime() - row.scheduledFor.getTime();
      if (elapsed < backoff) continue;
      const revivable = await prisma.reminderDelivery.updateMany({
        where: { id: row.id, status: "FAILED" },
        data: { status: "PENDING", lastError: null, sentAt: null },
      });
      if (revivable.count === 1) {
        retried.push(row.id);
      }
    }
  }

  const due = await dueReminders(now, limit);
  const summary: DispatchSummary = { sent: 0, failed: 0, skipped: 0, cancelled: 0, retried: retried.length };

  for (const row of due) {
    // Defensive: never send a reminder that is not yet due.
    if (row.scheduledFor.getTime() > now.getTime()) {
      summary.skipped++;
      continue;
    }

    // The product requires a verified address before any reminder is emailed.
    // Leave the row PENDING rather than cancelling it: the user may verify
    // later, and the reminder is still meaningful for that item.
    if (!row.emailVerified) {
      summary.skipped++;
      continue;
    }

    if (!isRelevant(row)) {
      const cancelled = await prisma.reminderDelivery.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      if (cancelled.count === 1) summary.cancelled++;
      else summary.skipped++;
      continue;
    }

    // Claim the row. Only the caller that flips PENDING -> SENT may send.
    const claim = await prisma.reminderDelivery.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENT", sentAt: now, attemptCount: { increment: 1 } },
    });
    if (claim.count !== 1) {
      summary.skipped++;
      continue;
    }

    const message = buildReminderEmail(row);
    try {
      const result = await sendMail(message);
      await prisma.reminderDelivery.update({
        where: { id: row.id },
        data: { providerMessageId: result.providerMessageId },
      });
      await recordEvent({
        userId: row.userId,
        itemId: row.itemId,
        eventType: "REMINDER_SENT",
        metadata: { type: row.reminderType, providerMessageId: result.providerMessageId },
      });
      summary.sent++;
    } catch (err) {
      const errMsg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      // attemptCount is the total number of claims; the claim above already incremented it.
      // Rows that reach attemptCount 4 stay FAILED forever (no wrap-around, no retry).
      await prisma.reminderDelivery.update({
        where: { id: row.id },
        data: { status: "FAILED", lastError: errMsg, sentAt: null, providerMessageId: null },
      });
      await recordEvent({
        userId: row.userId,
        itemId: row.itemId,
        eventType: "REMINDER_FAILED",
        metadata: { type: row.reminderType, error: errMsg },
      });
      summary.failed++;
    }
  }

  return summary;
}

// Re-exported for callers that want the human labels without importing reminders.
export { labelForReminder } from "@/lib/reminders";