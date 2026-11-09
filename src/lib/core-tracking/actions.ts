"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import {
  createPurchase,
  updatePurchase,
  changeItemStatus,
  deletePurchase,
  getPurchase,
  upsertReturnDetails,
} from "@/lib/dal";
import { deleteManyUploads } from "@/lib/storage";
import { rescheduleAllForUser } from "@/lib/reminders-service";
import {
  statusChangeSchema,
  updateItemSchema,
  createPurchaseSchema,
  returnDetailsSchema,
  parseWith,
} from "@/lib/validation";
import { ok, fail, toUserMessage, type ActionResult } from "@/lib/errors";
import type { ItemStatus } from "@/lib/status";
import {
  buildCreateArgs,
  buildUpdateArgs,
  evaluateStatusChange,
  readCreateInput,
  readUpdateInput,
} from "./logic";

/**
 * Core-tracking server actions.
 *
 * Ownership comes exclusively from requireUser(), never from the form. Every
 * action re-validates on the server and re-checks the status transition against
 * the item's stored status, so a tampered form cannot force an illegal state.
 * After any change that can affect reminders we ask the reminders service to
 * reschedule so a deadline/status edit can never leave a stale reminder queued.
 */

export async function createPurchaseAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  let itemId: string;
  try {
    const user = await requireUser();
    const raw = readCreateInput((key) => String(formData.get(key) ?? ""));
    const parsed = parseWith(createPurchaseSchema, raw);
    if (!parsed.ok) return fail(parsed.errors);

    const item = await createPurchase(buildCreateArgs(user.id, parsed.data));
    itemId = item.id;

    revalidatePath("/dashboard");
    revalidatePath("/");
  } catch (err) {
    console.error("[createPurchaseAction] failed", err);
    return fail({}, toUserMessage(err));
  }
  redirect(`/purchases/${itemId}`);
}

export async function updatePurchaseAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!itemId) return fail({}, "Missing item.");

    const raw = readUpdateInput((key) => String(formData.get(key) ?? ""));
    const parsed = parseWith(updateItemSchema, raw);
    if (!parsed.ok) return fail(parsed.errors);

    await updatePurchase(buildUpdateArgs(user.id, itemId, parsed.data));
    await rescheduleAllForUser(user.id);

    revalidatePath(`/purchases/${itemId}`);
    revalidatePath("/dashboard");
    return ok({ id: itemId });
  } catch (err) {
    return fail({}, toUserMessage(err));
  }
}

export async function statusChangeAction(
  _prev: ActionResult<{ status: ItemStatus }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ status: ItemStatus }>> {
  try {
    const user = await requireUser();
    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!itemId) return fail({}, "Missing item.");

    const parsed = parseWith(statusChangeSchema, {
      status: formData.get("status"),
      confirm: formData.get("confirm") === "true",
      note: formData.get("note") ?? "",
    });
    if (!parsed.ok) return fail(parsed.errors);

    // Re-derive the current status server-side; never trust a hidden "from".
    const current = await getPurchase(user.id, itemId, user.timezone);
    if (!current) return fail({}, "That purchase could not be found.");

    const evaluation = evaluateStatusChange(current.status, parsed.data.status, parsed.data.confirm);
    if (!evaluation.ok) {
      return fail({}, evaluation.error);
    }

    await changeItemStatus({
      userId: user.id,
      itemId,
      to: parsed.data.status,
      // Only set the item's notes when the user actually supplied one, so a
      // status change never silently wipes existing notes.
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
    await rescheduleAllForUser(user.id);

    revalidatePath(`/purchases/${itemId}`);
    revalidatePath("/dashboard");
    return ok({ status: parsed.data.status });
  } catch (err) {
    return fail({}, toUserMessage(err));
  }
}

/**
 * Saves the optional return / refund facts for an item: when it was handed over,
 * the carrier and tracking number, the expected refund (a user-set reminder, not
 * a retailer promise), the amount the user confirmed receiving, and notes.
 *
 * Ownership comes from the session; the DAL re-checks the item belongs to that
 * user. Any change that can move a refund check-in rebuilds the reminder queue.
 */
export async function saveReturnDetailsAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!itemId) return fail({}, "Missing item.");

    const get = (key: string) => String(formData.get(key) ?? "");
    const parsed = parseWith(returnDetailsSchema, {
      returnStartedAt: get("returnStartedAt"),
      returnedAt: get("returnedAt"),
      carrier: get("carrier"),
      trackingNumber: get("trackingNumber"),
      expectedRefundAmount: get("expectedRefundAmount"),
      expectedRefundDate: get("expectedRefundDate"),
      actualRefundAmount: get("actualRefundAmount"),
      actualRefundDate: get("actualRefundDate"),
      notes: get("returnNotes"),
    });
    if (!parsed.ok) return fail(parsed.errors);

    await upsertReturnDetails({
      userId: user.id,
      itemId,
      returnStartedAt: parsed.data.returnStartedAt,
      returnedAt: parsed.data.returnedAt,
      carrier: parsed.data.carrier,
      trackingNumber: parsed.data.trackingNumber,
      expectedRefundCents: parsed.data.expectedRefundAmount,
      expectedRefundDate: parsed.data.expectedRefundDate,
      actualRefundCents: parsed.data.actualRefundAmount,
      actualRefundDate: parsed.data.actualRefundDate,
      notes: parsed.data.notes,
    });
    await rescheduleAllForUser(user.id);

    revalidatePath(`/purchases/${itemId}`);
    revalidatePath("/dashboard");
    revalidatePath("/notifications");
    return ok({ id: itemId });
  } catch (err) {
    return fail({}, toUserMessage(err));
  }
}

export async function archiveToggleAction(
  _prev: ActionResult<{ archived: boolean }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ archived: boolean }>> {
  try {
    const user = await requireUser();
    const itemId = String(formData.get("itemId") ?? "").trim();
    const archived = formData.get("archived") === "true";
    if (!itemId) return fail({}, "Missing item.");

    await updatePurchase({ userId: user.id, itemId, archived });
    await rescheduleAllForUser(user.id);

    revalidatePath(`/purchases/${itemId}`);
    revalidatePath("/dashboard");
    return ok({ archived });
  } catch (err) {
    return fail({}, toUserMessage(err));
  }
}

/**
 * Hard delete. The DAL returns the storage keys that belonged to the item;
 * deleting those files is best-effort so a storage hiccup cannot fail the
 * delete (the DB rows are already gone) — the account-level purge is the
 * safety net for any file that survives.
 */
export async function deletePurchaseAction(
  _prev: ActionResult<{ deleted: true }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  try {
    const user = await requireUser();
    if (!itemId) return fail({}, "Missing item.");

    const keys = await deletePurchase(user.id, itemId);
    await deleteManyUploads(keys).catch(() => {});

    revalidatePath("/dashboard");
  } catch (err) {
    return fail({}, toUserMessage(err));
  }
  // Outside the try/catch so the NEXT_REDIRECT signal is not swallowed.
  redirect("/dashboard");
}
