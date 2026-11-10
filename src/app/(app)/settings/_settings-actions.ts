"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guard";
import { destroyCurrentSession } from "@/lib/auth";
import { deleteAccount } from "@/lib/dal";
import { deleteManyUploads } from "@/lib/storage";
import { toUserMessage } from "@/lib/errors";
import { updateSettingsAction } from "@/app/(auth)/actions";

/**
 * Thin server-side wrappers owned by the app-shell track.
 *
 * The settings form posts here rather than directly to the AUTH track's action so
 * that the free-text time-zone fallback and the multi-checkbox reminder offsets
 * are normalised into exactly one plain object plus a matching FormData. The
 * AUTH action accepts either shape, so the two tracks cannot drift.
 */

export interface SettingsFormState {
  errors: Record<string, string>;
  formError?: string;
  saved?: boolean;
}

type LooseAction = (input?: unknown, formData?: FormData) => Promise<unknown>;

/**
 * Next.js signals redirects and not-found via thrown errors carrying a `digest`.
 * Those must propagate untouched; only real failures become form state.
 */
function isNavigationError(err: unknown): boolean {
  return err instanceof Error && typeof (err as { digest?: unknown }).digest === "string";
}

export async function saveSettingsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireUser();

  const tzSelect = String(formData.get("timezone") ?? "").trim();
  const tzOther = String(formData.get("timezoneOther") ?? "").trim();
  const timezone = tzOther || tzSelect;

  const hourRaw = String(formData.get("reminderHour") ?? "").trim();
  const reminderHour = hourRaw === "" ? undefined : Number(hourRaw);

  const emailRemindersOn = formData.get("emailRemindersOn") === "on";

  const reminderOffsets = Array.from(new Set(formData.getAll("offset").map((v) => Number(v))))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => b - a);

  const payload = {
    timezone,
    reminderOffsets,
    ...(reminderHour !== undefined && Number.isInteger(reminderHour) ? { reminderHour } : {}),
    emailRemindersOn,
  };

  // A matching FormData for the form-shaped variant of the AUTH action. The
  // field names must match what that action reads: "remindersField" marks an
  // intentional (possibly empty) offset list, and "reminderOffsets" carries each
  // value. Sending "offset" here silently dropped every preference.
  const asForm = new FormData();
  asForm.set("timezone", timezone);
  asForm.set("remindersField", "on");
  for (const o of reminderOffsets) asForm.append("reminderOffsets", String(o));
  if (payload.reminderHour !== undefined) asForm.set("reminderHour", String(payload.reminderHour));
  if (emailRemindersOn) asForm.set("emailRemindersOn", "on");

  const call = updateSettingsAction as unknown as LooseAction;

  let result: unknown;
  try {
    result = await call(payload, asForm);
  } catch (err) {
    if (isNavigationError(err)) throw err;
    return { errors: {}, formError: toUserMessage(err) };
  }

  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok?: unknown }).ok === true
  ) {
    // The form is uncontrolled for progressive enhancement, so refresh the
    // server-rendered defaults after a successful save. Without this, a
    // checkbox that was just cleared would still render its old state.
    revalidatePath("/settings");
    return { errors: {}, saved: true };
  }

  const errors =
    result && typeof result === "object" && "errors" in result
      ? ((result as { errors?: Record<string, string> }).errors ?? {})
      : {};
  const formError =
    result && typeof result === "object" && "formError" in result
      ? (result as { formError?: string }).formError
      : undefined;

  return { errors, formError };
}

export interface DeleteFormState {
  error?: string;
}

/**
 * Account deletion. Invalidate-then-delete: the typed email must match the
 * signed-in account, then all rows (items, orders, returns, events, deliveries,
 * sessions, tokens) cascade away and uploaded files are purged. Finally the
 * session is destroyed and the user is sent to the sign-in page.
 */
export async function deleteAccountAction(
  _prev: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const user = await requireUser();

  const typed = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  if (!typed || typed !== user.email.toLowerCase()) {
    return { error: "Type your email address exactly to confirm deletion." };
  }

  // Capture the item ids so we can audit the deletion after the cascade removes
  // the rows but before the session is destroyed (plan §6 / D7 audit intent).
  const { prisma } = await import("@/lib/db");
  const itemsBefore = await prisma.item.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  let storageKeys: string[] = [];
  try {
    storageKeys = await deleteAccount(user.id);
  } catch (err) {
    if (isNavigationError(err)) throw err;
    return { error: toUserMessage(err) };
  }

  try {
    const { recordEvent } = await import("@/lib/dal/events");
    await Promise.all(
      itemsBefore.map((it) =>
        recordEvent({
          userId: user.id,
          itemId: it.id,
          eventType: "ACCOUNT_DELETED",
        }),
      ),
    );
  } catch {
    // Audit logging must not interfere with account deletion.
  }

  // Best-effort purge of uploaded files; the rows are already gone.
  try {
    if (storageKeys.length > 0) await deleteManyUploads(storageKeys);
  } catch {
    // Ignore: account records are deleted regardless of orphaned blobs.
  }

  await destroyCurrentSession();
  redirect("/sign-in?deleted=1");
}