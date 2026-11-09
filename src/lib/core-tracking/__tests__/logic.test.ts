import { describe, expect, it } from "vitest";
import {
  buildCreateArgs,
  buildUpdateArgs,
  deadlineUrgency,
  describeDeadline,
  evaluateStatusChange,
  formatCentsInput,
  formatMoney,
  readCreateInput,
  readUpdateInput,
  statusLabel,
} from "@/lib/core-tracking/logic";

const TZ = "America/Edmonton";
// 2026-06-10T18:00:00Z == 12:00 MDT on the 10th.
const NOW = new Date("2026-06-10T18:00:00.000Z");

describe("describeDeadline (date + day count, never colour alone)", () => {
  it("pairs the explicit date with the number of days left", () => {
    expect(describeDeadline("2026-06-13", TZ, NOW)).toBe("Return by June 13, 2026 — 3 days left");
    expect(describeDeadline("2026-06-11", TZ, NOW)).toBe("Return by June 11, 2026 — 1 day left");
  });

  it("calls out the final day in plain language", () => {
    expect(describeDeadline("2026-06-10", TZ, NOW)).toBe("Return by June 10, 2026 — today is the last day");
  });

  it("describes an overdue deadline without pretending it is still open", () => {
    expect(describeDeadline("2026-06-08", TZ, NOW)).toBe(
      "Return deadline passed on June 8, 2026 (2 days ago)",
    );
    expect(describeDeadline("2026-06-09", TZ, NOW)).toBe(
      "Return deadline passed on June 9, 2026 (1 day ago)",
    );
  });

  it("handles a missing deadline", () => {
    expect(describeDeadline("", TZ, NOW)).toBe("No return deadline set.");
  });
});

describe("deadlineUrgency", () => {
  it("tints only the cases that need it, and colour is never the only signal", () => {
    expect(deadlineUrgency("EXPIRED", -1)).toBe("danger");
    expect(deadlineUrgency("OPEN", 0)).toBe("warn");
    expect(deadlineUrgency("OPEN", 5)).toBe("none");
    expect(deadlineUrgency("RETURNED", -1)).toBe("none");
  });
});

describe("money formatting", () => {
  it("converts integer minor units back to an edit-form default", () => {
    expect(formatCentsInput(1234)).toBe("12.34");
    expect(formatCentsInput(0)).toBe("0.00");
    expect(formatCentsInput(null)).toBe("");
    expect(formatCentsInput(undefined)).toBe("");
  });

  it("formats display money with and without a currency", () => {
    expect(formatMoney(1234, "USD")).toBe("$12.34");
    expect(formatMoney(1234, null)).toBe("12.34");
    expect(formatMoney(null, "USD")).toBe("");
  });
});

describe("statusLabel", () => {
  it("uses the shared labels, including the display-only Expired", () => {
    expect(statusLabel("OPEN")).toBe("Open");
    expect(statusLabel("REFUND_PENDING")).toBe("Refund pending");
    expect(statusLabel("EXPIRED")).toBe("Expired");
  });
});

describe("form input extraction", () => {
  it("reads the create payload, treating a missing checkbox as false", () => {
    const values: Record<string, string> = {
      name: "  Headphones ",
      storeName: "Acme",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-20",
      amount: "49.99",
    };
    const out = readCreateInput((k) => values[k] ?? "");
    expect(out.name).toBe("  Headphones ");
    expect(out.confirmExceptionalDeadline).toBe(false);
    const checked = readCreateInput((k) => (k === "confirmExceptionalDeadline" ? "on" : ""));
    expect(checked.confirmExceptionalDeadline).toBe(true);
  });

  it("reads the update payload and only passes archived through when present", () => {
    const withArchive = readUpdateInput((k) => (k === "archived" ? "true" : k === "name" ? "X" : ""));
    expect(withArchive.archived).toBe(true);
    const withoutArchive = readUpdateInput(() => "");
    expect(withoutArchive.archived).toBeUndefined();
  });
});

describe("buildCreateArgs", () => {
  it("maps validated output onto the DAL arguments (amount -> amountCents)", () => {
    const args = buildCreateArgs("user_1", {
      name: "Headphones",
      storeName: "Acme",
      purchaseDate: "2026-06-01",
      returnDeadline: "2026-06-20",
      orderNumber: null,
      amount: 4999,
      currency: "USD",
      itemUrl: null,
      notes: null,
      confirmExceptionalDeadline: false,
    });
    expect(args).toMatchObject({
      userId: "user_1",
      name: "Headphones",
      amountCents: 4999,
      currency: "USD",
      orderNumber: null,
    });
  });
});

describe("buildUpdateArgs", () => {
  it("omits fields the form did not provide so the DAL leaves them untouched", () => {
    const args = buildUpdateArgs("user_1", "item_1", { name: "New name" });
    expect(args).toEqual({ userId: "user_1", itemId: "item_1", name: "New name" });
    expect("amountCents" in args).toBe(false);
    expect("archived" in args).toBe(false);
  });
});

describe("evaluateStatusChange (server-side authority)", () => {
  it("allows a plain forward transition without confirmation", () => {
    expect(evaluateStatusChange("OPEN", "RETURN_STARTED", false)).toEqual({
      ok: true,
      requiresConfirmation: false,
    });
    expect(evaluateStatusChange("RETURNED", "REFUND_RECEIVED", false)).toEqual({
      ok: true,
      requiresConfirmation: false,
    });
  });

  it("blocks a confirmation-requiring change until it is confirmed", () => {
    const blocked = evaluateStatusChange("OPEN", "KEPT", false);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.length).toBeGreaterThan(0);

    const confirmed = evaluateStatusChange("OPEN", "KEPT", true);
    expect(confirmed).toEqual({ ok: true, requiresConfirmation: true });
  });

  it("rejects illegal and no-op transitions", () => {
    expect(evaluateStatusChange("OPEN", "OPEN", true).ok).toBe(false);
    expect(evaluateStatusChange("KEPT", "REFUND_RECEIVED", true).ok).toBe(false);
  });
});