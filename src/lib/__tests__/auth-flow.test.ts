import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/rate-limit";
import {
  DEFAULT_TIMEZONE,
  RATE_LIMITS,
  appUrl,
  checkResetRequestLimit,
  checkSignInLimit,
  checkSignUpLimit,
  normalizeTimezone,
} from "@/lib/auth-flow";

describe("auth-flow helpers", () => {
  beforeEach(() => resetRateLimits());

  it("builds absolute links from APP_URL", () => {
    expect(appUrl("/verify-email/confirm?token=abc")).toBe(
      "http://localhost:3000/verify-email/confirm?token=abc",
    );
    expect(appUrl("settings")).toBe("http://localhost:3000/settings");
  });

  it("falls back to the default time zone for missing or invalid values", () => {
    expect(normalizeTimezone(undefined)).toBe(DEFAULT_TIMEZONE);
    expect(normalizeTimezone("")).toBe(DEFAULT_TIMEZONE);
    expect(normalizeTimezone("Not/AZone")).toBe(DEFAULT_TIMEZONE);
    expect(normalizeTimezone("Asia/Tokyo")).toBe("Asia/Tokyo");
  });

  it("allows requests up to the limit then blocks with a message", () => {
    const subject = "user@example.com";
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) {
      expect(checkSignInLimit(subject).allowed).toBe(true);
    }
    const blocked = checkSignInLimit(subject);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.message).toMatch(/Too many attempts/i);
  });

  it("keys sign-in limits by subject so one account cannot lock another out", () => {
    resetRateLimits();
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) checkSignInLimit("a@example.com");
    expect(checkSignInLimit("a@example.com").allowed).toBe(false);
    expect(checkSignInLimit("b@example.com").allowed).toBe(true);
  });

  it("keys sign-up limits by client ip", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
    for (let i = 0; i < RATE_LIMITS.signUp.limit; i++) {
      expect(checkSignUpLimit(headers).allowed).toBe(true);
    }
    expect(checkSignUpLimit(headers).allowed).toBe(false);
    const other = new Headers({ "x-forwarded-for": "203.0.113.8" });
    expect(checkSignUpLimit(other).allowed).toBe(true);
  });

  it("limits reset requests per email over a longer window", () => {
    for (let i = 0; i < RATE_LIMITS.requestReset.limit; i++) {
      expect(checkResetRequestLimit("x@example.com").allowed).toBe(true);
    }
    expect(checkResetRequestLimit("x@example.com").allowed).toBe(false);
  });
});
