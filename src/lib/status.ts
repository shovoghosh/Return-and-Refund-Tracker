import type { ItemStatus } from "@/generated/prisma/enums";

export type { ItemStatus };

/** Display-only status: never persisted. Derived from deadline + OPEN status. */
export type ItemDisplayStatus = ItemStatus | "EXPIRED";

export const STATUS_LABELS: Record<ItemDisplayStatus, string> = {
  OPEN: "Open",
  RETURN_STARTED: "Return started",
  RETURNED: "Returned",
  REFUND_PENDING: "Refund pending",
  REFUND_RECEIVED: "Refund received",
  KEPT: "Kept",
  EXPIRED: "Expired",
};

/** Statuses in which the item no longer needs RETURN-DEADLINE reminders. */
const DEADLINE_REMINDER_SUPPRESSED: ReadonlySet<ItemStatus> = new Set([
  "RETURN_STARTED",
  "RETURNED",
  "REFUND_PENDING",
  "REFUND_RECEIVED",
  "KEPT",
]);

export interface TransitionCheck {
  ok: boolean;
  /** True when the UI must ask the user to explicitly confirm before applying. */
  requiresConfirmation: boolean;
  reason?: string;
}

interface TransitionRule {
  targets: ReadonlySet<ItemStatus>;
  /** Moving INTO these targets from this status needs explicit user confirmation. */
  confirm: ReadonlySet<ItemStatus>;
  reason?: string;
}

const KNOWN_STATUSES: readonly ItemStatus[] = [
  "OPEN",
  "RETURN_STARTED",
  "RETURNED",
  "REFUND_PENDING",
  "REFUND_RECEIVED",
  "KEPT",
];

// Forward path plus user-correction paths. Corrections (moving backwards in the
// flow) are permitted everywhere EXCEPT into KEPT, which needs confirmation
// because it rewrites the meaning of the event history.
const RULES: Record<ItemStatus, TransitionRule> = {
  OPEN: {
    targets: new Set(["RETURN_STARTED", "RETURNED", "KEPT"]),
    confirm: new Set(["KEPT"]),
  },
  RETURN_STARTED: {
    targets: new Set(["RETURNED", "OPEN", "KEPT"]),
    confirm: new Set(["KEPT"]),
  },
  RETURNED: {
    targets: new Set(["REFUND_PENDING", "REFUND_RECEIVED", "OPEN", "RETURN_STARTED", "KEPT"]),
    confirm: new Set(["KEPT"]),
    reason: "Marking an item Kept after it was returned changes the recorded history.",
  },
  REFUND_PENDING: {
    targets: new Set(["REFUND_RECEIVED", "RETURNED", "OPEN", "KEPT"]),
    confirm: new Set(["KEPT"]),
  },
  REFUND_RECEIVED: {
    targets: new Set(["REFUND_PENDING", "RETURNED", "OPEN"]),
    confirm: new Set([]),
  },
  KEPT: {
    targets: new Set(["OPEN", "RETURN_STARTED", "RETURNED"]),
    confirm: new Set([]),
  },
};

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === "string" && (KNOWN_STATUSES as readonly string[]).includes(value);
}

/**
 * Validates a status change. Same-status "changes" are rejected so they cannot
 * pollute the event history.
 */
export function canTransition(from: ItemStatus, to: ItemStatus): TransitionCheck {
  if (!isItemStatus(to)) {
    return { ok: false, requiresConfirmation: false, reason: `Unknown status: ${String(to)}` };
  }
  if (from === to) {
    return { ok: false, requiresConfirmation: false, reason: "Item is already in that status." };
  }
  const rule = RULES[from];
  const ok = rule.targets.has(to);
  return {
    ok,
    requiresConfirmation: ok && rule.confirm.has(to),
    reason: ok ? rule.reason : `Cannot move an item from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}.`,
  };
}

export function allowedNextStatuses(from: ItemStatus): ItemStatus[] {
  return KNOWN_STATUSES.filter((s) => canTransition(from, s).ok);
}

export function shouldSendDeadlineReminders(
  status: ItemStatus,
  archivedAt: Date | null | undefined,
): boolean {
  if (archivedAt) return false;
  return !DEADLINE_REMINDER_SUPPRESSED.has(status);
}

/**
 * Display status. "Expired" is a display state for an OPEN item past its local
 * deadline day; it is never persisted and the item stays editable.
 */
export function toDisplayStatus(
  status: ItemStatus,
  deadlineISO: string,
  timezone: string,
  now: Date,
): ItemDisplayStatus {
  if (status === "OPEN" && isOverdue(deadlineISO, timezone, now)) return "EXPIRED";
  return status;
}

// --- date helpers (kept here so status + display agree on one definition) ---

import { DateTime } from "luxon";

/** Local calendar date (user's timezone) as YYYY-MM-DD. */
export function localDateISO(now: Date, timezone: string): string {
  return DateTime.fromJSDate(now, { zone: "utc" }).setZone(timezone).toISODate() ?? "";
}

/**
 * Local calendar days from today until the deadline: 0 = today, negative = past.
 * Compared at whole-day granularity in the user's timezone.
 */
export function daysUntilDeadline(deadlineISO: string, timezone: string, now: Date): number {
  const today = DateTime.fromJSDate(now, { zone: "utc" }).setZone(timezone).startOf("day");
  const deadline = DateTime.fromISO(deadlineISO, { zone: timezone }).startOf("day");
  if (!deadline.isValid || !today.isValid) return Number.NaN;
  return Math.round(deadline.diff(today, "days").days);
}

/** True once the whole deadline day has passed in the user's local calendar. */
export function isOverdue(deadlineISO: string, timezone: string, now: Date): boolean {
  return daysUntilDeadline(deadlineISO, timezone, now) < 0;
}

export function isValidTimezone(tz: string): boolean {
  return DateTime.local().setZone(tz).isValid;
}

export function formatDeadline(deadlineISO: string, timezone: string): string {
  const d = DateTime.fromISO(deadlineISO, { zone: timezone });
  return d.isValid ? d.toFormat("MMMM d, yyyy") : deadlineISO;
}
