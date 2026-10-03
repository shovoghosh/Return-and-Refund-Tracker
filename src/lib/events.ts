import type { ItemStatus } from "@/generated/prisma/enums";

export type AuditEventType =
  | "ITEM_CREATED"
  | "ITEM_UPDATED"
  | "ITEM_ARCHIVED"
  | "ITEM_UNARCHIVED"
  | "ITEM_DELETED"
  | "STATUS_CHANGED"
  | "DEADLINE_CHANGED"
  | "RETURN_DETAILS_UPDATED"
  | "ORDER_NUMBER_CHANGED"
  | "ATTACHMENT_ADDED"
  | "ATTACHMENT_DELETED"
  | "REMINDER_SENT"
  | "REMINDER_FAILED"
  | "REFUND_CONFIRMED";

export const EVENT_LABELS: Record<AuditEventType, string> = {
  ITEM_CREATED: "Purchase added",
  ITEM_UPDATED: "Details updated",
  ITEM_ARCHIVED: "Archived",
  ITEM_UNARCHIVED: "Restored",
  ITEM_DELETED: "Deleted",
  STATUS_CHANGED: "Status changed",
  DEADLINE_CHANGED: "Return deadline changed",
  RETURN_DETAILS_UPDATED: "Return details updated",
  ORDER_NUMBER_CHANGED: "Order number changed",
  ATTACHMENT_ADDED: "File attached",
  ATTACHMENT_DELETED: "File removed",
  REMINDER_SENT: "Reminder sent",
  REMINDER_FAILED: "Reminder failed",
  REFUND_CONFIRMED: "Refund confirmed by you",
};

export interface StatusChangedMeta {
  from: ItemStatus;
  to: ItemStatus;
}
export interface DeadlineChangedMeta {
  from: string;
  to: string;
}
export interface AttachmentMeta {
  filename: string;
  kind: string;
}
export interface ReminderMeta {
  type: string;
  providerMessageId?: string | null;
  error?: string;
}

/** Human-readable one-line summary used by the event history UI. */
export function describeEvent(eventType: string, metadata: unknown): string {
  const label = EVENT_LABELS[eventType as AuditEventType] ?? eventType;
  const meta = (metadata ?? {}) as Record<string, unknown>;
  if (eventType === "STATUS_CHANGED" && meta.from && meta.to) {
    return `${label}: ${humanStatus(String(meta.from))} to ${humanStatus(String(meta.to))}`;
  }
  if (eventType === "DEADLINE_CHANGED" && meta.from && meta.to) {
    return `${label}: ${String(meta.from)} to ${String(meta.to)}`;
  }
  if ((eventType === "ATTACHMENT_ADDED" || eventType === "ATTACHMENT_DELETED") && meta.filename) {
    return `${label}: ${String(meta.filename)}`;
  }
  if (eventType === "REMINDER_FAILED" && meta.error) {
    return `${label}: ${String(meta.error)}`;
  }
  return label;
}

function humanStatus(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
