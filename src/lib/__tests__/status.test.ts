import { describe, expect, it } from "vitest";
import {
  allowedNextStatuses,
  canTransition,
  daysUntilDeadline,
  isOverdue,
  shouldSendDeadlineReminders,
  toDisplayStatus,
} from "@/lib/status";

const TZ = "America/Edmonton";
// 2026-06-10T18:00:00Z == 12:00 MDT on the 10th.
const NOW = new Date("2026-06-10T18:00:00.000Z");

describe("status transitions", () => {
  it("allows the forward flow", () => {
    expect(canTransition("OPEN", "RETURN_STARTED").ok).toBe(true);
    expect(canTransition("RETURN_STARTED", "RETURNED").ok).toBe(true);
    expect(canTransition("RETURNED", "REFUND_PENDING").ok).toBe(true);
    expect(canTransition("REFUND_PENDING", "REFUND_RECEIVED").ok).toBe(true);
  });

  it("requires explicit confirmation to mark an item Kept after it was returned", () => {
    const afterReturned = canTransition("RETURNED", "KEPT");
    expect(afterReturned.ok).toBe(true);
    expect(afterReturned.requiresConfirmation).toBe(true);
    expect(canTransition("OPEN", "KEPT").requiresConfirmation).toBe(true);
    // Refund received -> nothing needs confirmation; it is a plain correction.
    expect(canTransition("REFUND_RECEIVED", "REFUND_PENDING").requiresConfirmation).toBe(false);
  });

  it("rejects no-op and unknown transitions", () => {
    expect(canTransition("OPEN", "OPEN").ok).toBe(false);
    expect(canTransition("KEPT", "REFUND_RECEIVED").ok).toBe(false);
  });

  it("lets users correct an accidental refund confirmation", () => {
    expect(canTransition("REFUND_RECEIVED", "REFUND_PENDING").ok).toBe(true);
    expect(canTransition("RETURNED", "OPEN").ok).toBe(true);
  });

  it("lists allowed next statuses for the UI", () => {
    expect(allowedNextStatuses("OPEN")).toContain("RETURNED");
    expect(allowedNextStatuses("KEPT")).toEqual(["OPEN", "RETURN_STARTED", "RETURNED"]);
  });
});

describe("deadline reminder suppression", () => {
  it("sends only while the item is open and not archived", () => {
    expect(shouldSendDeadlineReminders("OPEN", null)).toBe(true);
    expect(shouldSendDeadlineReminders("OPEN", NOW)).toBe(false);
    expect(shouldSendDeadlineReminders("RETURNED", null)).toBe(false);
    expect(shouldSendDeadlineReminders("KEPT", null)).toBe(false);
  });
});

describe("local-date deadline math", () => {
  it("counts whole local days", () => {
    expect(daysUntilDeadline("2026-06-10", TZ, NOW)).toBe(0); // today
    expect(daysUntilDeadline("2026-06-11", TZ, NOW)).toBe(1);
    expect(daysUntilDeadline("2026-06-09", TZ, NOW)).toBe(-1);
  });

  it("treats the deadline day as running to its local end", () => {
    // 23:00 local on the deadline day is still not overdue.
    const lateLocal = new Date("2026-06-11T05:00:00.000Z"); // 2026-06-10 23:00 MDT
    expect(isOverdue("2026-06-10", TZ, lateLocal)).toBe(false);
    // 00:30 local the next day is overdue.
    const justAfter = new Date("2026-06-11T06:30:00.000Z"); // 2026-06-11 00:30 MDT
    expect(isOverdue("2026-06-10", TZ, justAfter)).toBe(true);
  });

  it("resolves the local date correctly for a zone ahead of UTC", () => {
    // 2026-06-10T22:00Z is already the 11th in Tokyo.
    expect(daysUntilDeadline("2026-06-11", "Asia/Tokyo", new Date("2026-06-10T22:00:00.000Z"))).toBe(0);
  });
});

describe("toDisplayStatus", () => {
  it("shows Expired for an open item past its deadline without changing stored status", () => {
    expect(toDisplayStatus("OPEN", "2026-06-01", TZ, NOW)).toBe("EXPIRED");
    expect(toDisplayStatus("OPEN", "2026-06-20", TZ, NOW)).toBe("OPEN");
  });
  it("never marks a non-open item expired", () => {
    expect(toDisplayStatus("KEPT", "2026-06-01", TZ, NOW)).toBe("KEPT");
    expect(toDisplayStatus("REFUND_PENDING", "2026-06-01", TZ, NOW)).toBe("REFUND_PENDING");
  });
});
