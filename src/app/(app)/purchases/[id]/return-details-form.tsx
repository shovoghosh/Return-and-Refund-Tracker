"use client";

import { useActionState, useState } from "react";
import {
  CalendarDays,
  CreditCard,
  Link2,
  Save,
  StickyNote,
  Truck,
  Wallet,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  IconTile,
  Input,
  Notice,
  Textarea,
} from "@/components/ui";
import { saveReturnDetailsAction } from "@/lib/core-tracking/actions";
import { formatCentsInput, suggestRefundCheckInISO } from "@/lib/core-tracking/logic";
import type { ActionResult } from "@/lib/errors";

export interface ReturnDetailsDefaults {
  returnStartedAt: string | null;
  returnedAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  expectedRefundCents: number | null;
  expectedRefundDate: string | null;
  actualRefundCents: number | null;
  actualRefundDate: string | null;
  notes: string | null;
}

/**
 * Optional return / refund facts. These are deliberately separate from the item
 * form: the return deadline is a calendar date about the store's policy, while
 * an expected refund date is only a reminder the user sets for themselves. The
 * copy keeps that distinction explicit, and the actual refund fields are only
 * offered once the user has moved the item into the refund part of the flow.
 */
export function ReturnDetailsForm({
  itemId,
  defaults,
  currency,
  showActual,
}: {
  itemId: string;
  defaults: ReturnDetailsDefaults;
  currency: string | null;
  showActual: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult<{ id: string }> | undefined, FormData>(
    saveReturnDetailsAction,
    undefined,
  );

  const errors = state && !state.ok ? state.errors : {};
  const formError = state && !state.ok ? state.formError : undefined;
  const saved = state?.ok === true;

  const [returnedAt, setReturnedAt] = useState(defaults.returnedAt ?? "");
  const [expectedRefundDate, setExpectedRefundDate] = useState(defaults.expectedRefundDate ?? "");
  const suggestedDate = suggestRefundCheckInISO(returnedAt);
  const currencyLabel = currency && /^[A-Z]{3}$/.test(currency) ? currency : "the purchase currency";

  return (
    <Card padding="lg">
      <div className="flex items-start gap-3">
        <IconTile tone="lilac" size="lg">
          <Wallet />
        </IconTile>
        <div>
          <h2 className="text-sm font-semibold">Return &amp; refund details</h2>
          <p className="mt-1 max-w-xl text-[0.7rem] leading-relaxed text-muted">
            All of this is optional. An expected refund date is a reminder you set for yourself — it
            is not a promise from the store, and the app never claims money arrived until you confirm
            it.
          </p>
        </div>
      </div>

      {formError ? <Notice tone="error" className="mt-4">{formError}</Notice> : null}
      {saved ? <Notice tone="success" className="mt-4">Return details saved.</Notice> : null}

      <form action={action} className="mt-5 flex flex-col gap-5">
        <input type="hidden" name="itemId" value={itemId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Return started"
            htmlFor="returnStartedAt"
            error={errors.returnStartedAt}
            hint="The day you began the retailer's return process."
          >
            <Input
              id="returnStartedAt"
              name="returnStartedAt"
              type="date"
              defaultValue={defaults.returnStartedAt ?? ""}
              leadingIcon={<CalendarDays />}
              aria-invalid={errors.returnStartedAt ? true : undefined}
            />
          </Field>

          <Field
            label="Returned on"
            htmlFor="returnedAt"
            error={errors.returnedAt}
            hint="The day you handed the item over or shipped it."
          >
            <Input
              id="returnedAt"
              name="returnedAt"
              type="date"
              value={returnedAt}
              onChange={(e) => setReturnedAt(e.target.value)}
              leadingIcon={<Truck />}
              aria-invalid={errors.returnedAt ? true : undefined}
            />
          </Field>

          <Field label="Carrier" htmlFor="carrier" error={errors.carrier}>
            <Input
              id="carrier"
              name="carrier"
              type="text"
              defaultValue={defaults.carrier ?? ""}
              placeholder="e.g. UPS, Canada Post"
              autoComplete="off"
              maxLength={100}
              leadingIcon={<Truck />}
            />
          </Field>

          <Field label="Tracking number" htmlFor="trackingNumber" error={errors.trackingNumber}>
            <Input
              id="trackingNumber"
              name="trackingNumber"
              type="text"
              defaultValue={defaults.trackingNumber ?? ""}
              autoComplete="off"
              maxLength={120}
              leadingIcon={<Link2 />}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border/70 bg-surface-2/40 p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <IconTile tone="moss" size="sm">
              <Wallet />
            </IconTile>
            <p className="text-xs font-semibold">Refund expectations</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Expected refund amount"
              htmlFor="expectedRefundAmount"
              error={errors.expectedRefundAmount}
              hint={`Optional. In ${currencyLabel}.`}
            >
              <Input
                id="expectedRefundAmount"
                name="expectedRefundAmount"
                inputMode="decimal"
                defaultValue={formatCentsInput(defaults.expectedRefundCents)}
                placeholder="e.g. 49.99"
                autoComplete="off"
                aria-invalid={errors.expectedRefundAmount ? true : undefined}
              />
            </Field>

            <Field
              label="Expected refund date"
              htmlFor="expectedRefundDate"
              error={errors.expectedRefundDate}
              hint="A reminder to check your payment method — not a retailer promise."
            >
              <Input
                id="expectedRefundDate"
                name="expectedRefundDate"
                type="date"
                value={expectedRefundDate}
                onChange={(e) => setExpectedRefundDate(e.target.value)}
                leadingIcon={<CalendarDays />}
                aria-invalid={errors.expectedRefundDate ? true : undefined}
              />
            </Field>
          </div>

          {suggestedDate && !expectedRefundDate ? (
            <p className="mt-3 text-[0.7rem] text-muted">
              Suggested check-in: {suggestedDate} (14 days after the return date).{" "}
              <button
                type="button"
                className="font-semibold text-accent underline underline-offset-2"
                onClick={() => setExpectedRefundDate(suggestedDate)}
              >
                Use this date
              </button>
            </p>
          ) : null}
        </div>

        {showActual ? (
          <div className="rounded-xl border border-moss/25 bg-moss-soft/40 p-3.5">
            <div className="mb-3 flex items-center gap-2">
              <IconTile tone="moss" size="sm">
                <CreditCard />
              </IconTile>
              <p className="text-xs font-semibold">Refund received</p>
            </div>
            <p className="mb-3 text-[0.7rem] leading-relaxed text-muted">
              Only fill these in after you have checked your payment method and confirmed the money
              arrived yourself.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Refund received"
                htmlFor="actualRefundAmount"
                error={errors.actualRefundAmount}
                hint={`Optional. In ${currencyLabel}.`}
              >
                <Input
                  id="actualRefundAmount"
                  name="actualRefundAmount"
                  inputMode="decimal"
                  defaultValue={formatCentsInput(defaults.actualRefundCents)}
                  placeholder="e.g. 49.99"
                  autoComplete="off"
                  aria-invalid={errors.actualRefundAmount ? true : undefined}
                />
              </Field>

              <Field label="Refund received on" htmlFor="actualRefundDate" error={errors.actualRefundDate}>
                <Input
                  id="actualRefundDate"
                  name="actualRefundDate"
                  type="date"
                  defaultValue={defaults.actualRefundDate ?? ""}
                  leadingIcon={<CalendarDays />}
                  aria-invalid={errors.actualRefundDate ? true : undefined}
                />
              </Field>
            </div>
          </div>
        ) : null}

        <Field label="Return notes" htmlFor="returnNotes" error={errors.notes}>
          <Textarea
            id="returnNotes"
            name="returnNotes"
            defaultValue={defaults.notes ?? ""}
            maxLength={5000}
            rows={3}
            placeholder="Return instructions, drop-off details, or anything you want to remember."
          />
        </Field>

        <div className="flex items-center gap-2.5">
          <Button type="submit" variant="secondary" disabled={pending}>
            <Save className="size-4" aria-hidden="true" />
            {pending ? "Saving…" : "Save return details"}
          </Button>
          <span className="hidden items-center gap-1.5 text-[0.65rem] text-muted sm:inline-flex">
            <StickyNote className="size-3.5" aria-hidden="true" />
            Only you can see these notes.
          </span>
        </div>
      </form>
    </Card>
  );
}
