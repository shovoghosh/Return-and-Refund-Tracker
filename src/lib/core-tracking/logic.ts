import {
  canTransition,
  daysUntilDeadline,
  formatDeadline,
  STATUS_LABELS,
  type ItemDisplayStatus,
  type ItemStatus,
} from "@/lib/status";
import type { CreatePurchaseArgs, UpdatePurchaseArgs } from "@/lib/dal";
import type { CreatePurchaseParsed } from "@/lib/validation";
import { SUGGESTED_REFUND_CHECK_IN_DAYS } from "@/lib/reminders";

/**
 * Pure helpers for the core tracking flow (add/edit form + detail page).
 *
 * Everything here is free of server-only dependencies so the add/edit form can
 * reuse it in the browser for live preview, and so it is trivially unit
 * testable. The server actions call the same functions, so what the user sees
 * before saving is exactly what the server will persist.
 */

/** "Return by June 13, 2026 — 3 days left". Always pairs the date with the count. */
export function describeDeadline(deadlineISO: string, timezone: string, now: Date): string {
  if (!deadlineISO) return "No return deadline set.";
  const human = formatDeadline(deadlineISO, timezone);
  const days = daysUntilDeadline(deadlineISO, timezone, now);
  if (!Number.isFinite(days)) return `Return by ${human}`;
  if (days > 1) return `Return by ${human} — ${days} days left`;
  if (days === 1) return `Return by ${human} — 1 day left`;
  if (days === 0) return `Return by ${human} — today is the last day`;
  const ago = Math.abs(days);
  return `Return deadline passed on ${human} (${ago} ${ago === 1 ? "day" : "days"} ago)`;
}

/**
 * Urgency for styling. Colour is never the only signal — callers still render
 * the full deadline sentence; this only tints a border.
 */
export function deadlineUrgency(
  displayStatus: ItemDisplayStatus,
  daysRemaining: number,
): "danger" | "warn" | "none" {
  if (displayStatus === "EXPIRED") return "danger";
  if (displayStatus === "OPEN" && daysRemaining === 0) return "warn";
  return "none";
}

export function statusLabel(status: ItemStatus | ItemDisplayStatus): string {
  return STATUS_LABELS[status];
}

/** 1234 -> "12.34" for edit-form defaults. Empty string for no amount. */
export function formatCentsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/**
 * Suggested refund check-in date: two weeks after the return date. It is only a
 * prefilled suggestion the user can edit; the UI must label it as a reminder,
 * never as a promise about when the retailer will pay.
 */
export function suggestRefundCheckInISO(returnedAtISO: string | null | undefined): string {
  if (!returnedAtISO || !/^\d{4}-\d{2}-\d{2}$/.test(returnedAtISO)) return "";
  const d = new Date(`${returnedAtISO}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + SUGGESTED_REFUND_CHECK_IN_DAYS);
  return d.toISOString().slice(0, 10);
}

/** Money display. Uses the currency code when present, else a bare decimal. */
export function formatMoney(cents: number | null | undefined, currency?: string | null): string {
  if (cents === null || cents === undefined) return "";
  const value = cents / 100;
  if (currency && /^[A-Za-z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(value);
    } catch {
      // Fall through to the bare decimal for an unknown currency code.
    }
  }
  return value.toFixed(2);
}

type Getter = (key: string) => string;

function isChecked(raw: string): boolean {
  return raw === "on" || raw === "true" || raw === "1";
}

/**
 * Extracts the create-purchase payload from raw form values. Kept separate from
 * FormData so the exact extraction the server performs is unit-testable.
 */
export function readCreateInput(get: Getter): {
  name: string;
  storeName: string;
  purchaseDate: string;
  returnDeadline: string;
  orderNumber: string;
  amount: string;
  currency: string;
  itemUrl: string;
  notes: string;
  confirmExceptionalDeadline: boolean;
} {
  return {
    name: get("name"),
    storeName: get("storeName"),
    purchaseDate: get("purchaseDate"),
    returnDeadline: get("returnDeadline"),
    orderNumber: get("orderNumber"),
    amount: get("amount"),
    currency: get("currency"),
    itemUrl: get("itemUrl"),
    notes: get("notes"),
    confirmExceptionalDeadline: isChecked(get("confirmExceptionalDeadline")),
  };
}

/**
 * Extracts the update-item payload. Purchase date is intentionally absent: the
 * shared update schema/DAL do not allow changing it, so the form must not offer
 * it (a silently-ignored field is worse than no field).
 */
export function readUpdateInput(get: Getter): {
  name: string;
  storeName: string;
  orderNumber: string;
  amount: string;
  currency: string;
  itemUrl: string;
  notes: string;
  returnDeadline: string;
  archived: boolean | undefined;
} {
  const archivedRaw = get("archived");
  return {
    name: get("name"),
    storeName: get("storeName"),
    orderNumber: get("orderNumber"),
    amount: get("amount"),
    currency: get("currency"),
    itemUrl: get("itemUrl"),
    notes: get("notes"),
    returnDeadline: get("returnDeadline"),
    archived: archivedRaw === "true" ? true : archivedRaw === "false" ? false : undefined,
  };
}

/** Maps validated create output onto the DAL's create arguments. */
export function buildCreateArgs(userId: string, parsed: CreatePurchaseParsed): CreatePurchaseArgs {
  return {
    userId,
    name: parsed.name,
    storeName: parsed.storeName,
    purchaseDate: parsed.purchaseDate,
    returnDeadline: parsed.returnDeadline,
    orderNumber: parsed.orderNumber ?? null,
    amountCents: parsed.amount ?? null,
    currency: parsed.currency ?? null,
    itemUrl: parsed.itemUrl ?? null,
    notes: parsed.notes ?? null,
  };
}

/** Maps validated update output onto the DAL's update arguments. */
export function buildUpdateArgs(
  userId: string,
  itemId: string,
  parsed: {
    name?: string;
    storeName?: string;
    orderNumber?: string | null;
    amount?: number | null;
    currency?: string | null;
    itemUrl?: string | null;
    notes?: string | null;
    returnDeadline?: string;
    archived?: boolean;
  },
): UpdatePurchaseArgs {
  return {
    userId,
    itemId,
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.storeName !== undefined ? { storeName: parsed.storeName } : {}),
    ...(parsed.orderNumber !== undefined ? { orderNumber: parsed.orderNumber } : {}),
    ...(parsed.amount !== undefined ? { amountCents: parsed.amount } : {}),
    ...(parsed.currency !== undefined ? { currency: parsed.currency } : {}),
    ...(parsed.itemUrl !== undefined ? { itemUrl: parsed.itemUrl } : {}),
    ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
    ...(parsed.returnDeadline !== undefined ? { returnDeadline: parsed.returnDeadline } : {}),
    ...(parsed.archived !== undefined ? { archived: parsed.archived } : {}),
  };
}

export type StatusEvaluation =
  | { ok: true; requiresConfirmation: boolean }
  | { ok: false; error: string };

/**
 * Server-side authority for status changes. The UI may pre-check with
 * canTransition, but the action re-runs this against the item's *stored* status
 * so a tampered form cannot force an illegal or confirmation-requiring change.
 */
export function evaluateStatusChange(
  current: ItemStatus,
  to: ItemStatus,
  confirmed: boolean,
): StatusEvaluation {
  const check = canTransition(current, to);
  if (!check.ok) {
    return { ok: false, error: check.reason ?? "That status change is not allowed." };
  }
  if (check.requiresConfirmation && !confirmed) {
    return {
      ok: false,
      error: check.reason ?? "Please confirm this status change before continuing.",
    };
  }
  return { ok: true, requiresConfirmation: check.requiresConfirmation };
}
