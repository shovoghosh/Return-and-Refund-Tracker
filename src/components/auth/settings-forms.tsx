"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select, Notice } from "@/components/ui";
import { FormFeedback, SubmitButton } from "@/components/auth/form-primitives";
import { useTimezoneOptions } from "@/components/auth/timezone-options";
import {
  changePasswordAction,
  deleteAccountAction,
  updateSettingsAction,
} from "@/app/(auth)/actions";
import { REMINDER_OFFSET_TYPES, labelForReminder } from "@/lib/reminders";
import type { ActionResult } from "@/lib/errors";

export interface SettingsFormProps {
  email: string;
  timezone: string;
  reminderOffsets: number[];
  reminderHour: number;
  emailRemindersOn: boolean;
  emailVerified: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number): string {
  const d = new Date(Date.UTC(2000, 0, 1, h, 0));
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export function SettingsForm(props: SettingsFormProps) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateSettingsAction, null);
  const zones = useTimezoneOptions(props.timezone);
  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormFeedback state={state} successMessage="Settings saved. Your reminder schedule has been updated." />

      <Field label="Time zone" htmlFor="settings-timezone" required error={errors.timezone} hint="Used for deadlines and reminder send times.">
        <Select id="settings-timezone" name="timezone" defaultValue={props.timezone} required>
          {zones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Email reminders</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="emailRemindersOn"
            defaultChecked={props.emailRemindersOn}
            className="size-4"
          />
          Send deadline reminders by email
        </label>
        {!props.emailVerified ? (
          <Notice tone="warn">
            Reminders are paused until you confirm your email address.
          </Notice>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">When to remind me</legend>
        <input type="hidden" name="remindersField" value="1" />
        {REMINDER_OFFSET_TYPES.map(({ offset, type }) => (
          <label key={offset} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="reminderOffsets"
              value={offset}
              defaultChecked={props.reminderOffsets.includes(offset)}
              className="size-4"
            />
            {labelForReminder(type)}
          </label>
        ))}
        <Field label="Send reminders at" htmlFor="settings-hour" error={errors.reminderHour}>
          <Select id="settings-hour" name="reminderHour" defaultValue={String(props.reminderHour)}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted">Times are in your selected time zone.</p>
      </fieldset>

      <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} successMessage="Password changed. Other sessions were signed out." />
      <Field label="Current password" htmlFor="current-password" required error={errors.currentPassword}>
        <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="settings-new-password" required error={errors.newPassword} hint="At least 8 characters.">
        <Input
          id="settings-new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <Field label="Confirm new password" htmlFor="settings-confirm-password" required error={errors.confirmPassword}>
        <Input
          id="settings-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      <SubmitButton pendingLabel="Updating…">Change password</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm({ email }: { email: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(deleteAccountAction, null);
  const [arm, setArm] = useState(false);
  const errors = state && !state.ok ? state.errors : {};

  return (
    <div className="flex flex-col gap-3">
      <FormFeedback state={state} />
      {!arm ? (
        <button
          type="button"
          onClick={() => setArm(true)}
          className="inline-flex min-h-11 w-fit items-center rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger hover:text-white"
        >
          Delete my account
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <Notice tone="warn">
            This permanently removes your purchases, returns, files, and reminders. Type{" "}
            <span className="font-medium">{email}</span> to confirm.
          </Notice>
          <Field label="Confirm your email" htmlFor="delete-confirm" required error={errors.confirm}>
            <Input id="delete-confirm" name="confirm" type="email" autoComplete="off" required />
          </Field>
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingLabel="Deleting…">
              Permanently delete
            </SubmitButton>
            <button
              type="button"
              onClick={() => setArm(false)}
              className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
