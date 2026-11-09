"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Notice, Textarea, cx } from "@/components/ui";
import { previewReminderLines } from "@/lib/reminders";
import { isValidTimezone } from "@/lib/status";
import { createPurchaseAction, updatePurchaseAction } from "@/lib/core-tracking/actions";
import { formatCentsInput } from "@/lib/core-tracking/logic";

export interface PurchaseFormDefaults {
  name?: string;
  storeName?: string;
  purchaseDate?: string;
  returnDeadline?: string;
  orderNumber?: string;
  amountCents?: number | null;
  currency?: string | null;
  itemUrl?: string | null;
  notes?: string | null;
  archived?: boolean;
}

export interface PurchaseFormProps {
  mode: "create" | "edit";
  /** For edit mode. */
  itemId?: string;
  defaults?: PurchaseFormDefaults;
  timezone: string;
  reminderOffsets: number[];
  reminderHour: number;
  /** YYYY-MM-DD "today" in the user's timezone, used as the deadline preview anchor. */
  todayISO: string;
  cancelHref?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Add/edit purchase form. Shared by /purchases/new and /purchases/[id]/edit so both
 * paths enforce the same four required fields and the same reminder preview.
 *
 * Create mode redirects to the new item on success. Edit mode stays put and
 * shows a "Saved" confirmation. The deadline preview uses the exact same
 * `previewReminderLines` the server uses to schedule reminders.
 */
export function PurchaseForm({
  mode,
  itemId,
  defaults = {},
  timezone,
  reminderOffsets,
  reminderHour,
  todayISO,
  cancelHref,
}: PurchaseFormProps) {
  const action = mode === "create" ? createPurchaseAction : updatePurchaseAction;
  const [state, formAction, pending] = useActionState(action, undefined);

  const [returnDeadline, setReturnDeadline] = useState(defaults.returnDeadline ?? "");
  const [localTimezone] = useState(isValidTimezone(timezone) ? timezone : "America/Edmonton");
  const [exceptionalConfirmed, setExceptionalConfirmed] = useState(false);

  const errors = state && !state.ok ? state.errors : {};
  const formError = state && !state.ok ? state.formError : undefined;
  const saved = mode === "edit" && state?.ok === true;

  const deadlineError = errors["returnDeadline"];
  const exceptional = /before the purchase date|intentional/i.test(deadlineError ?? "");

  const previewLines = useMemo(() => {
    if (!ISO_DATE.test(returnDeadline)) return [];
    try {
      const anchor = new Date(`${todayISO}T12:00:00.000Z`);
      return previewReminderLines({
        deadlineISO: returnDeadline,
        timezone: localTimezone,
        offsets: reminderOffsets,
        hour: reminderHour,
        now: anchor,
        status: "OPEN",
        archivedAt: null,
      });
    } catch {
      return [];
    }
  }, [returnDeadline, todayISO, localTimezone, reminderOffsets, reminderHour]);

  const fieldError = (key: string) => errors[key];

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {mode === "edit" && itemId ? <input type="hidden" name="itemId" value={itemId} /> : null}
      {mode === "edit" ? (
        <input type="hidden" name="archived" value={defaults.archived ? "true" : "false"} />
      ) : null}

      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {saved ? <Notice tone="info">Your changes were saved.</Notice> : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">The purchase</h2>

        <Field label="Item name" htmlFor="name" required error={fieldError("name")}>
          <Input
            id="name"
            name="name"
            defaultValue={defaults.name ?? ""}
            required
            autoComplete="off"
            maxLength={200}
            aria-invalid={fieldError("name") ? true : undefined}
          />
        </Field>

        <Field
          label="Store name"
          htmlFor="storeName"
          required
          error={fieldError("storeName")}
          hint="Where you bought it."
        >
          <Input
            id="storeName"
            name="storeName"
            defaultValue={defaults.storeName ?? ""}
            required
            autoComplete="organization"
            maxLength={200}
            aria-invalid={fieldError("storeName") ? true : undefined}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Purchase date"
            htmlFor="purchaseDate"
            required
            error={fieldError("purchaseDate")}
            hint={mode === "edit" ? "Set when you added the purchase and cannot be changed." : undefined}
          >
            <Input
              id="purchaseDate"
              name="purchaseDate"
              type="date"
              defaultValue={defaults.purchaseDate ?? ""}
              required
              readOnly={mode === "edit"}
              aria-readonly={mode === "edit" ? true : undefined}
              aria-invalid={fieldError("purchaseDate") ? true : undefined}
            />
          </Field>

          <Field
            label="Return deadline"
            htmlFor="returnDeadline"
            required
            error={fieldError("returnDeadline")}
            hint="The last day you can return the item."
          >
            <Input
              id="returnDeadline"
              name="returnDeadline"
              type="date"
              value={returnDeadline}
              onChange={(e) => setReturnDeadline(e.target.value)}
              required
              aria-invalid={fieldError("returnDeadline") ? true : undefined}
            />
          </Field>
        </div>

        {exceptional ? (
          <label className="flex items-start gap-2 rounded-lg border border-warn-border bg-warn-bg p-3 text-sm">
            <input
              type="checkbox"
              name="confirmExceptionalDeadline"
              value="on"
              checked={exceptionalConfirmed}
              onChange={(e) => setExceptionalConfirmed(e.target.checked)}
              className="mt-0.5 size-5"
            />
            <span>
              The return deadline is before the purchase date. I understand this is unusual and want to
              save it anyway.
            </span>
          </label>
        ) : null}

        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium">When we&apos;ll remind you</legend>
          {previewLines.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {previewLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Pick a return deadline to see when reminders will be sent, in your time zone ({localTimezone}).
            </p>
          )}
        </fieldset>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Optional details</h2>

        <Field label="Order number" htmlFor="orderNumber" error={fieldError("orderNumber")}>
          <Input
            id="orderNumber"
            name="orderNumber"
            defaultValue={defaults.orderNumber ?? ""}
            maxLength={100}
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="amount" error={fieldError("amount")} hint="Optional. Stored exactly.">
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              defaultValue={formatCentsInput(defaults.amountCents)}
              placeholder="e.g. 49.99"
              autoComplete="off"
              aria-invalid={fieldError("amount") ? true : undefined}
            />
          </Field>

          <Field label="Currency" htmlFor="currency" error={fieldError("currency")} hint="3-letter code, e.g. USD, CAD.">
            <Input
              id="currency"
              name="currency"
              defaultValue={defaults.currency ?? ""}
              placeholder="USD"
              maxLength={3}
              autoComplete="off"
              className="uppercase"
            />
          </Field>
        </div>

        <Field label="Item link" htmlFor="itemUrl" error={fieldError("itemUrl")}>
          <Input
            id="itemUrl"
            name="itemUrl"
            type="url"
            defaultValue={defaults.itemUrl ?? ""}
            placeholder="https://…"
            autoComplete="off"
          />
        </Field>

        <Field label="Notes" htmlFor="notes" error={fieldError("notes")}>
          <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} maxLength={5000} rows={4} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add purchase" : "Save changes"}
        </Button>
        {cancelHref ? (
          <Link
            href={cancelHref}
            className={cx(
              "inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground",
            )}
          >
            Cancel
          </Link>
        ) : null}
      </div>

      {mode === "create" ? (
        <p className="text-xs text-muted">
          Buying more than one item in the same order? Add each item separately so every item gets its own
          return deadline.
        </p>
      ) : null}
    </form>
  );
}
