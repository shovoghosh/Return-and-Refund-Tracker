import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  DEFAULT_REMINDER_OFFSETS,
  buildRefundFollowUp,
  normalizeOffsets,
  planDeadlineReminders,
  planRefundReminders,
} from "@/lib/reminders";

// Fixed instant: 2026-06-01T15:00:00Z
const NOW = new Date("2026-06-01T15:00:00.000Z");
const TZ = "America/Edmonton"; // UTC-6 in June (MDT)

/** Local wall-clock hour of a UTC instant, in the user's zone. */
function localHour(instant: Date, zone: string): number {
  return DateTime.fromJSDate(instant, { zone: "utc" }).setZone(zone).hour;
}

function base(over: Partial<Parameters<typeof planDeadlineReminders>[0]> = {}) {
  return {
    deadlineISO: "2026-06-20",
    timezone: TZ,
    offsets: [...DEFAULT_REMINDER_OFFSETS],
    hour: 9,
    now: NOW,
    status: "OPEN" as const,
    archivedAt: null,
    ...over,
  };
}

describe("planDeadlineReminders", () => {
  it("schedules 7/2/1 day reminders at the local hour, as UTC instants", () => {
    const planned = planDeadlineReminders(base());
    expect(planned.map((p) => p.type)).toEqual(["DEADLINE_7", "DEADLINE_2", "DEADLINE_1"]);
    // 2026-06-13 09:00 MDT == 15:00 UTC
    expect(planned[0].scheduledFor.toISOString()).toBe("2026-06-13T15:00:00.000Z");
    expect(planned[1].scheduledFor.toISOString()).toBe("2026-06-18T15:00:00.000Z");
    expect(planned[2].scheduledFor.toISOString()).toBe("2026-06-19T15:00:00.000Z");
  });

  it("never schedules a reminder whose send time has already passed", () => {
    // Deadline is 3 days out: the 7-day reminder is in the past and must be dropped.
    const planned = planDeadlineReminders(base({ deadlineISO: "2026-06-04" }));
    expect(planned.map((p) => p.type)).toEqual(["DEADLINE_2", "DEADLINE_1"]);
    expect(planned.every((p) => p.scheduledFor.getTime() > NOW.getTime())).toBe(true);
  });

  it("does not burst missed reminders for an item added after every offset passed", () => {
    const planned = planDeadlineReminders(base({ deadlineISO: "2026-05-30" }));
    expect(planned).toEqual([]);
  });

  it("suppresses deadline reminders once the item is no longer open or is archived", () => {
    for (const status of ["RETURN_STARTED", "RETURNED", "REFUND_PENDING", "REFUND_RECEIVED", "KEPT"] as const) {
      expect(planDeadlineReminders(base({ status }))).toEqual([]);
    }
    expect(planDeadlineReminders(base({ archivedAt: NOW }))).toEqual([]);
  });

  it("honours a custom subset of offsets", () => {
    const planned = planDeadlineReminders(base({ offsets: [2] }));
    expect(planned.map((p) => p.type)).toEqual(["DEADLINE_2"]);
  });

  it("shifts with the user's timezone", () => {
    // Same date/hour, different zone -> different UTC instant.
    const edmonton = planDeadlineReminders(base({ offsets: [1] }))[0];
    const toronto = planDeadlineReminders(base({ offsets: [1], timezone: "America/Toronto" }))[0];
    expect(edmonton.scheduledFor.toISOString()).toBe("2026-06-19T15:00:00.000Z");
    expect(toronto.scheduledFor.toISOString()).toBe("2026-06-19T13:00:00.000Z");
  });

  it("keeps the local send hour stable across a DST transition", () => {
    // 2026-03-08 02:00 is the US/Canada DST start. Two deadlines straddle it:
    //   deadline 2026-03-12 -> 7d reminder on 2026-03-05, still MST (UTC-7) => 16:00Z
    //   deadline 2026-03-15 -> 7d reminder on 2026-03-08, already MDT (UTC-6) => 15:00Z
    const before = planDeadlineReminders(
      base({ deadlineISO: "2026-03-12", offsets: [7], now: new Date("2026-03-01T00:00:00.000Z") }),
    );
    const after = planDeadlineReminders(
      base({ deadlineISO: "2026-03-15", offsets: [7], now: new Date("2026-03-01T00:00:00.000Z") }),
    );
    expect(before[0].scheduledFor.toISOString()).toBe("2026-03-05T16:00:00.000Z");
    expect(after[0].scheduledFor.toISOString()).toBe("2026-03-08T15:00:00.000Z");
    // Different UTC offsets, identical local wall-clock hour.
    for (const p of [before[0], after[0]]) {
      expect(localHour(p.scheduledFor, TZ)).toBe(9);
    }
  });
});

describe("normalizeOffsets", () => {
  it("keeps only supported offsets, dedupes, and sorts newest-first", () => {
    expect(normalizeOffsets([2, 7, 2, 99, "1", -3])).toEqual([7, 2, 1]);
  });
  it("falls back to defaults for non-arrays", () => {
    expect(normalizeOffsets(null)).toEqual([...DEFAULT_REMINDER_OFFSETS]);
    expect(normalizeOffsets("7,2")).toEqual([...DEFAULT_REMINDER_OFFSETS]);
  });
  it("allows switching every deadline reminder off", () => {
    expect(normalizeOffsets([])).toEqual([]);
  });
});

describe("planRefundReminders", () => {
  it("uses the expected refund date when provided", () => {
    const plan = planRefundReminders({
      expectedRefundDateISO: "2026-06-25",
      timezone: TZ,
      now: NOW,
      status: "REFUND_PENDING",
      hour: 9,
    });
    expect(plan.suggestedCheckInISO).toBe("2026-06-25");
    expect(plan.reminders.map((r) => r.type)).toEqual(["REFUND_CHECK_IN"]);
    expect(plan.reminders[0].scheduledFor.toISOString()).toBe("2026-06-25T15:00:00.000Z");
  });

  it("suggests returnedAt + 14 days when no expected date exists", () => {
    const plan = planRefundReminders({
      returnedAt: new Date("2026-06-10T18:30:00.000Z"),
      timezone: TZ,
      now: NOW,
      status: "REFUND_PENDING",
      hour: 9,
    });
    expect(plan.suggestedCheckInISO).toBe("2026-06-24");
  });

  it("does not schedule refund reminders for kept or received items", () => {
    for (const status of ["KEPT", "REFUND_RECEIVED", "OPEN"] as const) {
      expect(
        planRefundReminders({ returnedAt: NOW, timezone: TZ, now: NOW, status }).reminders,
      ).toEqual([]);
    }
  });
});

describe("buildRefundFollowUp", () => {
  it("defaults to one follow-up seven days later at the local hour", () => {
    const f = buildRefundFollowUp(new Date("2026-06-24T15:00:00.000Z"), TZ);
    expect(f.type).toBe("REFUND_FOLLOW_UP");
    expect(f.scheduledFor.toISOString()).toBe("2026-07-01T15:00:00.000Z");
  });
});
