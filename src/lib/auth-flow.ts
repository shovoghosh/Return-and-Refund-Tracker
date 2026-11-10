import { COMPANY_EMAIL, COMPANY_NAME } from "@/lib/brand";
import { getEnv } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  TOKEN_PURPOSES,
  VERIFY_TOKEN_TTL_MS,
  consumeToken,
  createAccount,
  issueToken,
  markEmailVerified,
} from "@/lib/dal/auth-account";
import { createSession, setSessionCookie } from "@/lib/auth";
import { isValidTimezone } from "@/lib/status";

/**
 * Auth flow helpers shared by the page/route server actions. Kept free of
 * request-only APIs (cookies/headers are passed in) so every rule below is
 * unit-testable without a browser or a running server.
 */

export const DEFAULT_TIMEZONE = "America/Edmonton";

/** Rate-limit policies. Kept as named constants so tests and UI agree. */
export const RATE_LIMITS = {
  signUp: { scope: "signup", limit: 5, windowMs: 15 * 60 * 1000 },
  signIn: { scope: "signin", limit: 10, windowMs: 15 * 60 * 1000 },
  verify: { scope: "verify", limit: 20, windowMs: 15 * 60 * 1000 },
  requestReset: { scope: "reset-request", limit: 5, windowMs: 60 * 60 * 1000 },
  reset: { scope: "reset", limit: 20, windowMs: 15 * 60 * 1000 },
} as const;

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** A message ready to render in a form notice, present only when blocked. */
  message?: string;
}

function limitFor(policy: { scope: string; limit: number; windowMs: number }, subject = ""): RateDecision {
  const res = rateLimit(`auth:${policy.scope}:${subject}`, policy.limit, policy.windowMs);
  if (res.allowed) return res;
  const mins = Math.ceil(res.retryAfterSeconds / 60);
  return {
    ...res,
    message: `Too many attempts. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
  };
}

export function checkSignInLimit(subject: string): RateDecision {
  return limitFor(RATE_LIMITS.signIn, subject);
}
export function checkSignUpLimit(headers: Headers): RateDecision {
  return limitFor(RATE_LIMITS.signUp, clientKey(headers, "auth-signup"));
}
export function checkVerifyLimit(subject: string): RateDecision {
  return limitFor(RATE_LIMITS.verify, subject);
}
export function checkResetRequestLimit(subject: string): RateDecision {
  return limitFor(RATE_LIMITS.requestReset, subject);
}
export function checkResetLimit(subject: string): RateDecision {
  return limitFor(RATE_LIMITS.reset, subject);
}

export function normalizeTimezone(tz: string | undefined | null): string {
  if (tz && isValidTimezone(tz)) return tz;
  return DEFAULT_TIMEZONE;
}

/** Absolute URL for a link in an email, based on the configured APP_URL. */
export function appUrl(path: string): string {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Creates an account and returns the verification token to email. Throws for a
 * duplicate email; the caller maps that to a field error. No user-supplied
 * ownership is involved: the id is generated here.
 */
export async function provisionAccount(args: {
  email: string;
  password: string;
  timezone?: string | null;
}): Promise<{ userId: string; verifyToken: string }> {
  const account = await createAccount({
    email: args.email,
    password: args.password,
    timezone: normalizeTimezone(args.timezone),
  });
  const token = await issueToken(account.id, TOKEN_PURPOSES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS);
  return { userId: account.id, verifyToken: token.raw };
}

/** Signs the user in: creates the session row and writes the auth cookie. */
export async function establishSession(userId: string): Promise<void> {
  const session = await createSession(userId);
  await setSessionCookie(session.raw, session.expiresAt);
}

export async function sendVerificationEmail(email: string, rawToken: string): Promise<void> {
  const link = appUrl(`/verify-email/confirm?token=${encodeURIComponent(rawToken)}`);
  await sendMail({
    to: email,
    subject: "Confirm your email for Return Tracker",
    text: [
      "Welcome to Return Tracker.",
      "",
      "Confirm this email address so we can send your return-deadline reminders:",
      link,
      "",
      "This link expires in 24 hours. If you did not create an account, ignore this email.",
      "",
      `${COMPANY_NAME} · ${COMPANY_EMAIL}`,
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
  const link = appUrl(`/reset-password?token=${encodeURIComponent(rawToken)}`);
  await sendMail({
    to: email,
    subject: "Reset your Return Tracker password",
    text: [
      "We received a request to reset your Return Tracker password.",
      "",
      "Choose a new password here:",
      link,
      "",
      "This link expires in 1 hour and can be used once.",
      "If you did not ask for this, you can ignore this email; your password is unchanged.",
      "",
      `${COMPANY_NAME} · ${COMPANY_EMAIL}`,
    ].join("\n"),
  });
}

/** Consumes a verification token and marks the email verified. Single-use. */
export async function confirmEmailToken(rawToken: string): Promise<{ userId: string } | null> {
  const claimed = await consumeToken(rawToken, TOKEN_PURPOSES.EMAIL_VERIFY);
  if (!claimed) return null;
  await markEmailVerified(claimed.userId);
  return { userId: claimed.userId };
}

/** Re-issues a verification token for a signed-in, not-yet-verified account. */
export async function resendVerification(userId: string, email: string): Promise<void> {
  const token = await issueToken(userId, TOKEN_PURPOSES.EMAIL_VERIFY, VERIFY_TOKEN_TTL_MS);
  await sendVerificationEmail(email, token.raw);
}

export { TOKEN_PURPOSES };
