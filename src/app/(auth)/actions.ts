"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { destroyCurrentSession, verifyPassword, revokeAllSessions } from "@/lib/auth";
import { requireUser } from "@/lib/auth-guard";
import { fail, ok, toUserMessage, type ActionResult } from "@/lib/errors";
import { parseWith, settingsSchema, signInSchema, signUpSchema } from "@/lib/validation";
import { deleteAccount } from "@/lib/dal/account";
import { deleteManyUploads } from "@/lib/storage";
import {
  TOKEN_PURPOSES,
  RESET_TOKEN_TTL_MS,
  consumeToken,
  findAuthAccountByEmail,
  getAccountPreferences,
  issueToken,
  setPasswordAndRevokeSessions,
  updateUserSettings,
  verifyPasswordForUser,
} from "@/lib/dal/auth-account";
import {
  checkResetLimit,
  checkResetRequestLimit,
  checkSignInLimit,
  checkSignUpLimit,
  checkVerifyLimit,
  confirmEmailToken,
  establishSession,
  provisionAccount,
  resendVerification,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/auth-flow";

type FormState = ActionResult | null;

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

function isDuplicateEmail(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export async function signUpAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const limit = checkSignUpLimit(await headers());
  if (!limit.allowed) return fail({}, limit.message);

  const parsed = parseWith(signUpSchema, {
    email: str(form, "email"),
    password: str(form, "password"),
    timezone: str(form, "timezone") || undefined,
  });
  if (!parsed.ok) return fail(parsed.errors);

  const confirm = str(form, "confirmPassword");
  if (confirm && confirm !== parsed.data.password) {
    return fail({ confirmPassword: "Passwords do not match." });
  }

  let userId: string;
  let verifyToken: string;
  try {
    const created = await provisionAccount(parsed.data);
    userId = created.userId;
    verifyToken = created.verifyToken;
  } catch (err) {
    if (isDuplicateEmail(err)) {
      return fail(
        { email: "An account with that email already exists. Sign in instead." },
        "We could not create that account.",
      );
    }
    return fail({}, toUserMessage(err));
  }

  try {
    await sendVerificationEmail(parsed.data.email, verifyToken);
  } catch {
    // Account exists; email delivery failure must not block sign-up.
  }

  await establishSession(userId);
  redirect("/verify-email");
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

export async function signInAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const parsed = parseWith(signInSchema, { email: str(form, "email"), password: str(form, "password") });
  if (!parsed.ok) return fail(parsed.errors);

  const limit = checkSignInLimit(parsed.data.email);
  if (!limit.allowed) return fail({}, limit.message);

  const account = await findAuthAccountByEmail(parsed.data.email);
  // Always compare against a hash to keep the failure path's timing similar
  // whether or not the email exists, and never reveal which part was wrong.
  const genericError = fail({}, "Email or password is incorrect.");
  if (!account || account.deletedAt) {
    await verifyPassword(parsed.data.password, "$2a$12$0000000000000000000000000000000000000000000000000000");
    return genericError;
  }
  const valid = await verifyPassword(parsed.data.password, account.passwordHash);
  if (!valid) return genericError;

  await establishSession(account.id);
  redirect(account.emailVerifiedAt ? "/dashboard" : "/verify-email");
}

export async function signOutAction(): Promise<void> {
  await destroyCurrentSession();
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function verifyEmailAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const token = str(form, "token");
  if (!token) return fail({}, "This verification link is missing its token.");

  const limit = checkVerifyLimit(token.slice(0, 16));
  if (!limit.allowed) return fail({}, limit.message);

  const confirmed = await confirmEmailToken(token);
  if (!confirmed) {
    return fail({}, "This verification link is invalid, already used, or expired. Request a new one.");
  }
  redirect("/dashboard");
}

export async function resendVerificationAction(): Promise<ActionResult> {
  const user = await requireUser();
  if (user.emailVerifiedAt) return ok(undefined);

  const prefs = await getAccountPreferences(user.id);
  if (!prefs) return fail({}, "We could not find that account.");

  const limit = checkVerifyLimit(user.id);
  if (!limit.allowed) return fail({}, limit.message);

  try {
    await resendVerification(user.id, prefs.email);
  } catch (err) {
    return fail({}, toUserMessage(err));
  }
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function requestPasswordResetAction(
  _prev: FormState,
  form: FormData,
): Promise<ActionResult> {
  const email = str(form, "email").trim().toLowerCase();
  const limit = checkResetRequestLimit(email || "anonymous");
  if (!limit.allowed) return fail({}, limit.message);
  if (!email) return fail({ email: "Enter your email address." });

  const account = await findAuthAccountByEmail(email);
  // Always report success, whether or not the address exists: this must not be
  // usable to discover which emails have accounts.
  if (account && !account.deletedAt) {
    const token = await issueToken(account.id, TOKEN_PURPOSES.PASSWORD_RESET, RESET_TOKEN_TTL_MS);
    try {
      await sendPasswordResetEmail(email, token.raw);
    } catch {
      // Swallow: the on-screen message is the same either way.
    }
  }
  return ok(undefined);
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  const token = str(form, "token");
  const password = str(form, "password");
  const confirm = str(form, "confirmPassword");

  if (!token) return fail({}, "This reset link is missing its token.");
  if (password.length < 8) return fail({ password: "Password must be at least 8 characters" });
  if (password !== confirm) return fail({ confirmPassword: "Passwords do not match." });

  const limit = checkResetLimit(token.slice(0, 16));
  if (!limit.allowed) return fail({}, limit.message);

  const claimed = await consumeToken(token, TOKEN_PURPOSES.PASSWORD_RESET);
  if (!claimed) {
    return fail({}, "This reset link is invalid, already used, or expired. Request a new one.");
  }

  await setPasswordAndRevokeSessions(claimed.userId, password);
  // Password change revokes all sessions; sign them in again so the flow ends
  // on the dashboard rather than a sign-in wall.
  await establishSession(claimed.userId);
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Account settings
// ---------------------------------------------------------------------------

export async function updateSettingsAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof Response) return fail({}, toUserMessage(err));
    throw err;
  }

  const offsetsRaw = form.getAll("reminderOffsets").map((v) => Number(v));
  const reminderHourRaw = str(form, "reminderHour");

  // An unchecked fieldset is an intentional empty list (no deadline reminders),
  // not an absent field: pass it through so the preference is persisted.
  const hasOffsetsField = form.has("remindersField");
  const parsed = parseWith(settingsSchema, {
    timezone: str(form, "timezone"),
    reminderOffsets: hasOffsetsField ? offsetsRaw : offsetsRaw.length ? offsetsRaw : undefined,
    reminderHour: reminderHourRaw === "" ? undefined : Number(reminderHourRaw),
    emailRemindersOn: form.get("emailRemindersOn") === "on",
  });
  if (!parsed.ok) return fail(parsed.errors);

  try {
    await updateUserSettings({ userId: user.id, ...parsed.data });
  } catch (err) {
    return fail({}, toUserMessage(err));
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return ok(undefined);
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof Response) return fail({}, toUserMessage(err));
    throw err;
  }

  const current = str(form, "currentPassword");
  const next = str(form, "newPassword");
  const confirm = str(form, "confirmPassword");

  if (!current) return fail({ currentPassword: "Enter your current password." });
  if (next.length < 8) return fail({ newPassword: "Password must be at least 8 characters" });
  if (next !== confirm) return fail({ confirmPassword: "Passwords do not match." });

  const valid = await verifyPasswordForUser(user.id, current);
  if (!valid) return fail({ currentPassword: "That is not your current password." });

  await setPasswordAndRevokeSessions(user.id, next);
  await establishSession(user.id);
  revalidatePath("/settings");
  return ok(undefined);
}

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof Response) return fail({}, toUserMessage(err));
    throw err;
  }

  const typed = str(form, "confirm").trim();
  if (typed !== user.email) {
    return fail({ confirm: `Type your email address (${user.email}) to confirm deletion.` });
  }

  let storageKeys: string[];
  try {
    storageKeys = await deleteAccount(user.id);
  } catch (err) {
    return fail({}, toUserMessage(err));
  }

  await purgeUploads(storageKeys);
  await revokeAllSessions(user.id).catch(() => {});
  await destroyCurrentSession().catch(() => {});
  redirect("/");
}

/**
 * Best-effort removal of the account's uploaded files. The storage module
 * validates every key, so a malformed key can never reach outside the store.
 */
async function purgeUploads(storageKeys: string[]): Promise<void> {
  try {
    await deleteManyUploads(storageKeys);
  } catch {
    // A file that is already gone is not an error for account deletion.
  }
}
