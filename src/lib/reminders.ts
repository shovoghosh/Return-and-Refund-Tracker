import { DateTime } from "luxon";
import type { ReminderType } from "@/generated/prisma/enums";
import { shouldSendDeadlineReminders, type ItemStatus } from "./status";

/**
 * Offset (days before the deadline) -> reminder type. Only these four offsets
 * are representable; a user enables/disables them individually.
 */
export const REMINDER_OFFSET_TYPES: ReadonlyArray<{ offset: number; type: ReminderType }> = [
  { offset: 7, type: "DEADLINE_7" },
  { offset: 2, type: "DEADLINE_2" },
  { offset: 1, type: "DEADLINE_1" },
  { offset: 0, type: "DEADLINE_TODAY" },
];

export const DEFAULT_REMINDER_OFFSETS: readonly number[] = [7, 2, 1];
export const DEFAULT_REMINDER_HOUR = 9;

/** Days after the return that a refund check-in is suggested (user-editable). */
export const SUGGESTED_REFUND_CHECK_IN_DAYS = 14;
/** Default follow-up delay after a check-in that is still pending. */
export const DEFAULT_REFUND_FOLLOW_UP_DAYS = 7;

export function typeForOffset(offset: number): ReminderType {
  const hit = REMINDER_OFFSET_TYPES.find((o) => o.offset === offset);
  if (!hit) throw new Error(`Unsupported reminder offset: ${offset}`);
  return hit.type;
}

export function normalizeOffsets(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_REMINDER_OFFSETS];
  const allowed = new Set(REMINDER_OFFSET_TYPES.map((o) => o.offset));
  const seen = new Set<number>();
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(n) && allowed.has(n)) seen.add(n);
  }
  return [...seen].sort((a, b) => b - a);
}

export interface PlannedReminder {
  type: ReminderType;
  /** Exact UTC instant the reminder is due. */
  scheduledFor: Date;
}

export interface DeadlinePlanInput {
  itemId?: string;
  /** YYYY-MM-DD, the local deadline date. */
  deadlineISO: string;
  timezone: string;
  /** Enabled offsets; see normalizeOffsets. */
  offsets: number[];
  /** Local hour (0-23) reminders are sent at. */
  hour?: number;
  now: Date;
  status: ItemStatus;
  archivedAt?: Date | null;
}

/**
 * Computes the deadline reminders that should currently be scheduled.
 *
 * Rules (from the product spec):
 *  - Send at the user's local hour on the offset day, expressed as a UTC instant.
 *  - Only FUTURE instants are scheduled: adding an item late must not produce a
 *    burst of already-missed reminders.
 *  - Reminders stop entirely once the item is no longer Open (returned/kept/etc)
 *    or is archived.
 *  - The deadline day reminder (offset 0) is only scheduled while its send time
 *    is still ahead; if the hour has passed the in-app notice covers it.
 */
export function planDeadlineReminders(input: DeadlinePlanInput): PlannedReminder[] {
  if (!shouldSendDeadlineReminders(input.status, input.archivedAt ?? null)) return [];

  const hour = input.hour ?? DEFAULT_REMINDER_HOUR;
  const offsets = normalizeOffsets(input.offsets);
  const deadline = DateTime.fromISO(input.deadlineISO, { zone: input.timezone });
  if (!deadline.isValid) return [];

  const nowMs = input.now.getTime();
  const out: PlannedReminder[] = [];

  for (const offset of offsets) {
    const sendAt = deadline
      .minus({ days: offset })
      .set({ hour, minute: 0, second: 0, millisecond: 0 });
    if (!sendAt.isValid) continue;
    if (sendAt.toMillis() <= nowMs) continue;
    out.push({ type: typeForOffset(offset), scheduledFor: sendAt.toUTC().toJSDate() });
  }

  return out.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

export interface RefundPlanInput {
  /** YYYY-MM-DD local date the refund is expected; if absent, returnedAt + 14d. */
  expectedRefundDateISO?: string | null;
  returnedAt?: Date | null;
  timezone: string;
  hour?: number;
  now: Date;
  status: ItemStatus;
  archivedAt?: Date | null;
}

export interface RefundPlan {
  /** The user-editable check-in date; a reminder setting, never a retailer promise. */
  suggestedCheckInISO: string;
  reminders: PlannedReminder[];
}

/**
 * Computes refund check-in reminders. Pending refunds stay visible until the
 * user closes them, and only ONE check-in is auto-scheduled; follow-ups are
 * opt-in (see buildRefundFollowUp).
 */
export function planRefundReminders(input: RefundPlanInput): RefundPlan {
  const empty: RefundPlan = { suggestedCheckInISO: "", reminders: [] };
  if (input.archivedAt) return empty;
  if (input.status !== "REFUND_PENDING" && input.status !== "RETURNED") return empty;

  const hour = input.hour ?? DEFAULT_REMINDER_HOUR;
  let checkIn: DateTime;

  if (input.expectedRefundDateISO) {
    checkIn = DateTime.fromISO(input.expectedRefundDateISO, { zone: input.timezone });
  } else if (input.returnedAt) {
    checkIn = DateTime.fromJSDate(input.returnedAt, { zone: "utc" })
      .setZone(input.timezone)
      .startOf("day")
      .plus({ days: SUGGESTED_REFUND_CHECK_IN_DAYS });
  } else {
    return empty;
  }
  if (!checkIn.isValid) return empty;

  const sendAt = checkIn.set({ hour, minute: 0, second: 0, millisecond: 0 });
  const reminders: PlannedReminder[] = [];
  if (sendAt.toMillis() > input.now.getTime()) {
    reminders.push({ type: "REFUND_CHECK_IN", scheduledFor: sendAt.toUTC().toJSDate() });
  }

  return { suggestedCheckInISO: checkIn.toISODate() ?? "", reminders };
}

export function buildRefundFollowUp(from: Date, timezone: string, hour = DEFAULT_REMINDER_HOUR): PlannedReminder {
  const sendAt = DateTime.fromJSDate(from, { zone: "utc" })
    .setZone(timezone)
    .plus({ days: DEFAULT_REFUND_FOLLOW_UP_DAYS })
    .set({ hour, minute: 0, second: 0, millisecond: 0 });
  return { type: "REFUND_FOLLOW_UP", scheduledFor: sendAt.toUTC().toJSDate() };
}

/**
 * Human-readable preview of when reminders will go out, in the user's zone.
 * Used by the add/edit form so the user sees the schedule before saving.
 */
export function previewReminderLines(input: DeadlinePlanInput): string[] {
  return planDeadlineReminders(input).map((r) => {
    const local = DateTime.fromJSDate(r.scheduledFor, { zone: "utc" }).setZone(input.timezone);
    return `${labelForReminder(r.type)}: ${local.toFormat("ccc, LLL d, yyyy 'at' h:mm a")}`;
  });
}

export function labelForReminder(type: ReminderType): string {
  switch (type) {
    case "DEADLINE_7":
      return "7 days before deadline";
    case "DEADLINE_2":
      return "2 days before deadline";
    case "DEADLINE_1":
      return "1 day before deadline";
    case "DEADLINE_TODAY":
      return "On the deadline day";
    case "REFUND_CHECK_IN":
      return "Refund check-in";
    case "REFUND_FOLLOW_UP":
      return "Refund follow-up";
  }
}
