import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { prisma } from "./db";

export const SESSION_COOKIE = "rt_session";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;

/**
 * Session tokens are stored hashed: a database leak must not hand out live
 * sessions. The raw token only ever exists in the user's cookie.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(`${raw}${getEnv().SESSION_SECRET}`).digest("hex");
}

export function newRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export interface SessionUser {
  id: string;
  email: string;
  timezone: string;
  emailVerifiedAt: Date | null;
  reminderOffsets: number[];
  reminderHour: number;
  emailRemindersOn: boolean;
}

/** The single source of identity for every server-side data access. */
export type AuthUser = SessionUser;

export async function createSession(userId: string): Promise<{ raw: string; expiresAt: Date }> {
  const raw = newRawToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return { raw, expiresAt };
}

/**
 * Resolves the signed-in user from the session cookie. Returns null for
 * missing/expired/revoked sessions and for soft-deleted accounts.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const user = session.user;
  if (user.deletedAt) return null;
  if (user.passwordHash === undefined) return null;

  return {
    id: user.id,
    email: user.email,
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt,
    reminderOffsets: normalizeOffsets(user.reminderOffsets),
    reminderHour: user.reminderHour,
    emailRemindersOn: user.emailRemindersOn,
  };
}

function normalizeOffsets(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [7, 2, 1];
  const allowed = new Set([7, 2, 1, 0]);
  const out = new Set<number>();
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(n) && allowed.has(n)) out.add(n);
  }
  return [...out].sort((a, b) => b - a);
}

export async function setSessionCookie(raw: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Revokes every session for a user (used on password change and account deletion). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
