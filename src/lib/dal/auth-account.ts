import { prisma } from "@/lib/db";
import {
  hashPassword,
  hashToken,
  newRawToken,
  revokeAllSessions,
  verifyPassword,
  type SessionUser,
} from "@/lib/auth";
import { encodeOffsets, normalizeOffsets, planDeadlineReminders, planRefundReminders } from "@/lib/reminders";
import type { ItemStatus } from "@/lib/status";
import type { Prisma } from "@prisma/client";

/**
 * Database layer for the auth & account track. Every function takes an explicit
 * user id where ownership matters; the id always comes from the verified session
 * server-side, never from the client.
 */

export const TOKEN_PURPOSES = {
  EMAIL_VERIFY: "EMAIL_VERIFY",
  PASSWORD_RESET: "PASSWORD_RESET",
} as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[keyof typeof TOKEN_PURPOSES];

/** Verification links are valid for a day; reset links for an hour. */
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface AuthAccountRow {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  timezone: string;
  reminderOffsets: number[];
  reminderHour: number;
  emailRemindersOn: boolean;
  deletedAt: Date | null;
}

/** Looks up the credential row for sign-in. Never exposes it to the client. */
export async function findAuthAccountByEmail(email: string): Promise<AuthAccountRow | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      timezone: true,
      reminderOffsets: true,
      reminderHour: true,
      emailRemindersOn: true,
      deletedAt: true,
    },
  });
  if (!user) return null;
  return { ...user, reminderOffsets: normalizeOffsets(user.reminderOffsets) };
}

/** Creates the account with a hashed password. Throws on duplicate email. */
export async function createAccount(
  args: { email: string; password: string; timezone: string },
): Promise<{ id: string; email: string }> {
  const passwordHash = await hashPassword(args.password);
  return prisma.user.create({
    data: { email: args.email, passwordHash, timezone: args.timezone },
    select: { id: true, email: true },
  });
}

/**
 * Replaces any live token of the same purpose with one fresh token. Only the
 * hash is stored, so a database leak cannot be used to verify or reset.
 */
export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
  ttlMs: number,
  now: Date = new Date(),
): Promise<{ raw: string; expiresAt: Date }> {
  await prisma.verifyToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  const raw = newRawToken();
  const expiresAt = new Date(now.getTime() + ttlMs);
  await prisma.verifyToken.create({
    data: { userId, purpose, tokenHash: hashToken(raw), expiresAt },
  });
  return { raw, expiresAt };
}

/**
 * Single-use, expiring token consumption. The row is claimed with a conditional
 * update so two concurrent submissions of the same link cannot both succeed.
 */
export async function consumeToken(
  raw: string,
  purpose: TokenPurpose,
  now: Date = new Date(),
): Promise<{ userId: string } | null> {
  const row = await prisma.verifyToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row) return null;
  if (row.purpose !== purpose) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;

  const claimed = await prisma.verifyToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return null;
  return { userId: row.userId };
}

/** Marks the email verified. Idempotent: returns false if already verified. */
export async function markEmailVerified(userId: string, now: Date = new Date()): Promise<boolean> {
  const res = await prisma.user.updateMany({
    where: { id: userId, emailVerifiedAt: null, deletedAt: null },
    data: { emailVerifiedAt: now },
  });
  return res.count === 1;
}

export async function hasVerifiedEmail(userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { emailVerifiedAt: true },
  });
  return Boolean(user?.emailVerifiedAt);
}

export async function verifyPasswordForUser(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { passwordHash: true },
  });
  if (!user) return false;
  return verifyPassword(password, user.passwordHash);
}

/** Sets a new password and revokes every existing session (reset + change). */
export async function setPasswordAndRevokeSessions(
  userId: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await revokeAllSessions(userId);
}

/** Current reminder/display preferences for the settings form. */
export async function getAccountPreferences(userId: string): Promise<{
  email: string;
  timezone: string;
  reminderOffsets: number[];
  reminderHour: number;
  emailRemindersOn: boolean;
  emailVerified: boolean;
} | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      email: true,
      timezone: true,
      reminderOffsets: true,
      reminderHour: true,
      emailRemindersOn: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) return null;
  return {
    email: user.email,
    timezone: user.timezone,
    reminderOffsets: normalizeOffsets(user.reminderOffsets),
    reminderHour: user.reminderHour,
    emailRemindersOn: user.emailRemindersOn,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

export interface UpdateSettingsArgs {
  userId: string;
  timezone?: string;
  reminderOffsets?: number[];
  reminderHour?: number;
  emailRemindersOn?: boolean;
}

export interface StoredSettings {
  timezone: string;
  reminderOffsets: number[];
  reminderHour: number;
  emailRemindersOn: boolean;
}

/**
 * Persists account settings and, when a scheduling input changed (time zone,
 * offsets, send hour, or reminders toggled off/on), rebuilds every pending
 * reminder so the schedule follows the new preferences. Sent/cancelled rows are
 * retained as the audit trail, per the product spec.
 */
export async function updateUserSettings(
  args: UpdateSettingsArgs,
  now: Date = new Date(),
): Promise<StoredSettings> {
  // Cloudflare D1 does not support interactive transactions, so these steps
  // run sequentially. Each one is still scoped to userId; a mid-way failure
  // leaves a partial write rather than rolling back.
  return (async () => {
    const tx = prisma;
    const before = await tx.user.findFirstOrThrow({
      where: { id: args.userId, deletedAt: null },
      select: {
        timezone: true,
        reminderOffsets: true,
        reminderHour: true,
        emailRemindersOn: true,
      },
    });

    const next: StoredSettings = {
      timezone: args.timezone ?? before.timezone,
      reminderOffsets:
        args.reminderOffsets !== undefined
          ? normalizeOffsets(args.reminderOffsets)
          : normalizeOffsets(before.reminderOffsets),
      reminderHour: args.reminderHour ?? before.reminderHour,
      emailRemindersOn: args.emailRemindersOn ?? before.emailRemindersOn,
    };

    const schedulingChanged =
      next.timezone !== before.timezone ||
      next.reminderHour !== before.reminderHour ||
      next.emailRemindersOn !== before.emailRemindersOn ||
      !sameOffsets(normalizeOffsets(before.reminderOffsets), next.reminderOffsets);

    await tx.user.update({
      where: { id: args.userId },
      data: {
        timezone: next.timezone,
        reminderOffsets: encodeOffsets(next.reminderOffsets),
        reminderHour: next.reminderHour,
        emailRemindersOn: next.emailRemindersOn,
      },
    });

    if (schedulingChanged) await rescheduleReminders(tx, args.userId, next, now);

    return next;
  })();
}

function sameOffsets(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Cancels every pending reminder for the user and, when email reminders remain
 * enabled, re-materialises the future schedule from the user's current items.
 * Only future instants are created, so this never produces a burst of catch-up
 * reminders.
 */
export async function rescheduleReminders(
  tx: Prisma.TransactionClient,
  userId: string,
  prefs: StoredSettings,
  now: Date,
): Promise<void> {
  await tx.reminderDelivery.updateMany({
    where: { userId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (!prefs.emailRemindersOn) return;

  const items = await tx.item.findMany({
    where: { userId, archivedAt: null },
    select: {
      id: true,
      status: true,
      archivedAt: true,
      returnDeadline: true,
      return: { select: { expectedRefundDate: true, returnedAt: true } },
    },
  });

  for (const item of items) {
    const deadlineISO = item.returnDeadline.toISOString().slice(0, 10);
    const deadline = planDeadlineReminders({
      deadlineISO,
      timezone: prefs.timezone,
      offsets: prefs.reminderOffsets,
      hour: prefs.reminderHour,
      now,
      status: item.status as ItemStatus,
      archivedAt: item.archivedAt,
    });
    const refund = planRefundReminders({
      expectedRefundDateISO: item.return?.expectedRefundDate
        ? item.return.expectedRefundDate.toISOString().slice(0, 10)
        : null,
      returnedAt: item.return?.returnedAt ?? null,
      timezone: prefs.timezone,
      hour: prefs.reminderHour,
      now,
      status: item.status as ItemStatus,
      archivedAt: item.archivedAt,
    });

    for (const p of [...deadline, ...refund.reminders]) {
      await tx.reminderDelivery.upsert({
        where: {
          itemId_reminderType_scheduledFor: {
            itemId: item.id,
            reminderType: p.type,
            scheduledFor: p.scheduledFor,
          },
        },
        create: {
          userId,
          itemId: item.id,
          reminderType: p.type,
          scheduledFor: p.scheduledFor,
          status: "PENDING",
        },
        update: { status: "PENDING", lastError: null, attemptCount: 0 },
      });
    }
  }
}

/** Soft look-up used by the session surface after a settings write. */
export function toSessionShape(row: AuthAccountRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    timezone: row.timezone,
    emailVerifiedAt: row.emailVerifiedAt,
    reminderOffsets: row.reminderOffsets,
    reminderHour: row.reminderHour,
    emailRemindersOn: row.emailRemindersOn,
  };
}
