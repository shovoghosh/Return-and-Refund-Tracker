"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Check,
  CreditCard,
  Link2,
  Package,
  ReceiptText,
  Save,
  Store,
  StickyNote,
  Tag,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  IconTile,
  Input,
  Notice,
  Textarea,
  buttonStyles,
} from "@/components/ui";
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
      {saved ? <Notice tone="success">Your changes were saved.</Notice> : null}

      <Card padding="lg">
        <div className="flex items-start gap-3">
          <IconTile tone="accent" size="lg">
            <Package />
          </IconTile>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">The purchase</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The four required fields are the whole story: what it is, where it came from, when you
              bought it, and when the return window closes.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="Item name" htmlFor="name" required error={fieldError("name")}>
            <Input
              id="name"
              name="name"
              defaultValue={defaults.name ?? ""}
              required
              autoComplete="off"
              maxLength={200}
              placeholder="e.g. Noise-cancelling headphones"
              leadingIcon={<Tag />}
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
              placeholder="e.g. Amazon"
              leadingIcon={<Store />}
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
                leadingIcon={<CalendarDays />}
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
                leadingIcon={<CalendarDays />}
                aria-invalid={fieldError("returnDeadline") ? true : undefined}
              />
            </Field>
          </div>

          {exceptional ? (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-warn-border bg-warn-bg p-3.5 text-sm">
              <input
                type="checkbox"
                name="confirmExceptionalDeadline"
                value="on"
                checked={exceptionalConfirmed}
                onChange={(e) => setExceptionalConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                The return deadline is before the purchase date. I understand this is unusual and want
                to save it anyway.
              </span>
            </label>
          ) : null}

          <div className="rounded-xl border border-accent/20 bg-accent-soft/35 p-3.5">
            <div className="flex items-center gap-2">
              <IconTile tone="accent" size="sm">
                <Bell />
              </IconTile>
              <p className="text-xs font-semibold">When we&apos;ll remind you</p>
              <span className="ml-auto text-[0.62rem] text-muted">{localTimezone}</span>
            </div>
            {previewLines.length > 0 ? (
              <ol className="mt-3 flex flex-col gap-1.5">
                {previewLines.map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-foreground-soft">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-moss" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2.5 text-[0.72rem] leading-relaxed text-muted">
                Pick a return deadline to see when reminders will be sent, in your time zone.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <div className="flex items-start gap-3">
          <IconTile tone="sky" size="lg">
            <ReceiptText />
          </IconTile>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">Optional details</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Helpful when you need to find the order again, or when the refund amount matters.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="Order number" htmlFor="orderNumber" error={fieldError("orderNumber")}>
            <Input
              id="orderNumber"
              name="orderNumber"
              defaultValue={defaults.orderNumber ?? ""}
              maxLength={100}
              autoComplete="off"
              placeholder="e.g. A-10293"
              leadingIcon={<ReceiptText />}
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
                leadingIcon={<CreditCard />}
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
              leadingIcon={<Link2 />}
            />
          </Field>

          <Field label="Notes" htmlFor="notes" error={fieldError("notes")}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={defaults.notes ?? ""}
              maxLength={5000}
              rows={4}
              placeholder="Return instructions, packaging details, or anything you want to remember."
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {mode === "create" ? <Package className="size-4" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {pending ? "Saving…" : mode === "create" ? "Add purchase" : "Save changes"}
        </Button>
        {cancelHref ? (
          <Link href={cancelHref} className={buttonStyles({ variant: "ghost" })}>
            Cancel
          </Link>
        ) : null}
        {mode === "create" ? (
          <p className="flex items-center gap-1.5 text-[0.68rem] text-muted">
            <StickyNote className="size-3.5" aria-hidden="true" />
            Buying more than one item? Add each separately so every deadline is tracked.
          </p>
        ) : null}
      </div>
    </form>
  );
}
