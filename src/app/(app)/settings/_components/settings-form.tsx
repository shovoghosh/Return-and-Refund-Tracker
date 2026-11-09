"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { REMINDER_OFFSET_TYPES, labelForReminder, normalizeOffsets } from "@/lib/reminders";
import { saveSettingsAction, deleteAccountAction, type SettingsFormState, type DeleteFormState } from "../_settings-actions";

export interface SettingsUser {
  email: string;
  timezone: string;
  reminderOffsets: number[];
  reminderHour: number;
  emailRemindersOn: boolean;
}

/** A short, practical list of common zones, always including the user's own. */
const COMMON_ZONES = [
  "America/St_Johns",
  "America/Halifax",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Edmonton",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

const INITIAL_SETTINGS: SettingsFormState = { errors: {} };
const INITIAL_DELETE: DeleteFormState = {};

export function SettingsForm({ user }: { user: SettingsUser }) {
  const offsets = normalizeOffsets(user.reminderOffsets);
  const [settingsState, settingsAction, settingsPending] = useActionState(saveSettingsAction, INITIAL_SETTINGS);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccountAction, INITIAL_DELETE);

  const inList = COMMON_ZONES.includes(user.timezone);
  const [zoneMode, setZoneMode] = useState<"list" | "custom">(inList ? "list" : "custom");
  const [confirmEmail, setConfirmEmail] = useState("");

  const errors = settingsState.errors ?? {};

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Reminder & time-zone preferences ---- */}
      <form action={settingsAction} className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">Time zone and reminders</h2>
          <p className="mt-1 text-sm text-muted">
            We store your time zone so a &ldquo;return deadline&rdquo; means the end of that calendar
            day where you live. We store which reminders you want, the local hour to send them, and
            whether email reminders are on — nothing else.
          </p>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">Time zone</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="zoneMode"
                value="list"
                checked={zoneMode === "list"}
                onChange={() => setZoneMode("list")}
                className="size-4"
              />
              Choose from the list
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="zoneMode"
                value="custom"
                checked={zoneMode === "custom"}
                onChange={() => setZoneMode("custom")}
                className="size-4"
              />
              Enter a zone name
            </label>
          </div>

          {zoneMode === "list" ? (
            <Field label="Time zone name" htmlFor="timezone" error={errors.timezone}>
              <Select id="timezone" name="timezone" defaultValue={user.timezone} disabled={zoneMode !== "list"}>
                {!inList ? <option value={user.timezone}>{user.timezone}</option> : null}
                {COMMON_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field
              label="Time zone name"
              htmlFor="timezoneOther"
              error={errors.timezone}
              hint="An IANA name such as America/Edmonton or Europe/London."
            >
              <Input
                id="timezoneOther"
                name="timezoneOther"
                type="text"
                defaultValue={inList ? "" : user.timezone}
                placeholder="America/Edmonton"
              />
            </Field>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Deadline reminders to email me</legend>
          <p className="text-xs text-muted">Reminders are sent only while an item is still open.</p>
          {REMINDER_OFFSET_TYPES.map(({ offset, type }) => (
            <label key={type} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="offset"
                value={offset}
                defaultChecked={offsets.includes(offset)}
                className="size-5 rounded border-border"
              />
              {labelForReminder(type)}
            </label>
          ))}
          {errors.reminderOffsets ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {errors.reminderOffsets}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Send reminders at (your local time)"
            htmlFor="reminderHour"
            error={errors.reminderHour}
            hint="Used for deadline reminders and refund check-ins."
          >
            <Select id="reminderHour" name="reminderHour" defaultValue={String(user.reminderHour)}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              name="emailRemindersOn"
              defaultChecked={user.emailRemindersOn}
              className="size-5 rounded border-border"
            />
            Email me deadline reminders
          </label>
          <p className="text-xs text-muted">
            When this is off, no reminder emails are sent. Account and security messages (like
            verifying your email or resetting your password) are always sent and cannot be turned
            off.
          </p>
        </div>

        {settingsState.formError ? <Notice tone="error">{settingsState.formError}</Notice> : null}
        {settingsState.saved ? <Notice tone="info">Settings saved.</Notice> : null}

        <div>
          <Button type="submit" disabled={settingsPending}>
            {settingsPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>

      {/* ---- Export ---- */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">
          Download a copy of everything you have entered. The file contains only your purchases. Get
          it as a spreadsheet-friendly CSV or a structured JSON file.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <a href="/api/export?format=csv">
            <Button variant="secondary">Download CSV</Button>
          </a>
          <a href="/api/export?format=json">
            <Button variant="secondary">Download JSON</Button>
          </a>
        </div>
        <p className="mt-2 text-xs text-muted">
          Full details are on the{" "}
          <a href="/export" className="underline underline-offset-2">
            export page
          </a>
          .
        </p>
      </section>

      {/* ---- Delete account ---- */}
      <section className="flex flex-col gap-3 rounded-xl border border-danger/50 bg-surface p-4 sm:p-5">
        <h2 className="text-base font-semibold">Delete account</h2>
        <p className="text-sm text-muted">
          This permanently removes your account and every purchase, return, reminder record, and
          uploaded file we hold. It cannot be undone. Backups are rotated out on our normal schedule,
          so a copy may survive briefly before it ages out.
        </p>
        <form action={deleteAction} className="flex flex-col gap-3">
          <Field
            label="Type your email address to confirm"
            htmlFor="confirmEmail"
            error={deleteState.error}
            hint={`Type ${user.email} to enable the button below.`}
          >
            <Input
              id="confirmEmail"
              name="confirmEmail"
              type="email"
              autoComplete="off"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email}
            />
          </Field>
          <div>
            <Button
              type="submit"
              variant="danger"
              disabled={deletePending || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()}
            >
              {deletePending ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}