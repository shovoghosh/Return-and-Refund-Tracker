"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import {
  Bell,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Globe2,
  Mail,
  Settings2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  IconTile,
  Input,
  Notice,
  Select,
  buttonStyles,
  cx,
} from "@/components/ui";
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

function SwitchRow({
  name,
  value,
  defaultChecked,
  title,
  body,
  icon,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <label className="group flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border/80 bg-surface/55 p-3.5 transition hover:border-border-strong">
      <span className="flex min-w-0 gap-3">
        <IconTile tone="neutral" size="sm" className="mt-0.5">
          {icon}
        </IconTile>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="mt-0.5 block text-[0.7rem] leading-relaxed text-muted">{body}</span>
        </span>
      </span>
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full border border-border bg-surface-3 transition-colors duration-200 peer-checked:border-accent/30 peer-checked:bg-accent peer-checked:[&>span]:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
      >
        <span className="absolute left-0.5 top-0.5 size-[1.15rem] rounded-full bg-surface shadow-sm transition-transform duration-200" />
      </span>
    </label>
  );
}

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
      <form
        key={`settings-${offsets.join("-")}-${user.reminderHour}-${user.emailRemindersOn ? "on" : "off"}`}
        action={settingsAction}
        className="flex flex-col gap-4"
      >
        <Card padding="lg" className="relative overflow-hidden">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/10 blur-3xl"
          />
          <div className="relative flex items-start gap-3">
            <IconTile tone="accent" size="lg">
              <Settings2 />
            </IconTile>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-[-0.01em]">Time zone and reminders</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                We store your time zone so a &ldquo;return deadline&rdquo; means the end of that
                calendar day where you live. We store which reminders you want, the local hour to
                send them, and whether email reminders are on — nothing else.
              </p>
            </div>
          </div>

          <div className="relative mt-6 flex flex-col gap-6">
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Globe2 className="size-4 text-accent" aria-hidden="true" />
                Time zone
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: "list" as const, title: "Choose from the list", body: "Common zones, ready to go." },
                  { value: "custom" as const, title: "Enter a zone name", body: "Any IANA zone, e.g. Europe/Rome." },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={cx(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-sm transition focus-within:ring-2 focus-within:ring-ring",
                      zoneMode === option.value
                        ? "border-accent/35 bg-accent-soft/70"
                        : "border-border/80 bg-surface/55 hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="zoneMode"
                      value={option.value}
                      checked={zoneMode === option.value}
                      onChange={() => setZoneMode(option.value)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cx(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                        zoneMode === option.value ? "border-accent bg-accent text-accent-fg" : "border-border-strong",
                      )}
                    >
                      {zoneMode === option.value ? <Check className="size-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <span className="block font-medium">{option.title}</span>
                      <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-muted">{option.body}</span>
                    </span>
                  </label>
                ))}
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

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Bell className="size-4 text-accent" aria-hidden="true" />
                Deadline reminders to email me
              </legend>
              <p className="text-xs text-muted">Reminders are sent only while an item is still open.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {REMINDER_OFFSET_TYPES.map(({ offset, type }) => (
                  <label
                    key={type}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-surface/55 px-3 py-2.5 text-sm transition hover:border-border-strong has-[:checked]:border-accent/35 has-[:checked]:bg-accent-soft/55"
                  >
                    <input
                      type="checkbox"
                      name="offset"
                      value={offset}
                      defaultChecked={offsets.includes(offset)}
                      className="size-4 shrink-0 rounded accent-[var(--accent)]"
                    />
                    {labelForReminder(type)}
                  </label>
                ))}
              </div>
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

            <SwitchRow
              name="emailRemindersOn"
              defaultChecked={user.emailRemindersOn}
              title="Email me deadline reminders"
              body="When this is off, no reminder emails are sent. Security messages — verification and password resets — are always sent."
              icon={<Mail />}
            />

            {settingsState.formError ? <Notice tone="error">{settingsState.formError}</Notice> : null}
            {settingsState.saved ? <Notice tone="success">Settings saved.</Notice> : null}
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={settingsPending}>
            <Check className="size-4" aria-hidden="true" />
            {settingsPending ? "Saving…" : "Save settings"}
          </Button>
          <p className="text-xs text-muted">Changes apply to reminders scheduled from now on.</p>
        </div>
      </form>

      {/* ---- Export ---- */}
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <IconTile tone="moss" size="lg">
            <Download />
          </IconTile>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">Your data</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Download a copy of everything you have entered. The file contains only your purchases.
              Get it as a spreadsheet-friendly CSV or a structured JSON file.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <a href="/api/export?format=csv" className={buttonStyles({ variant: "secondary" })}>
            <FileSpreadsheet className="size-4 text-moss" aria-hidden="true" />
            Download CSV
          </a>
          <a href="/api/export?format=json" className={buttonStyles({ variant: "secondary" })}>
            <FileJson className="size-4 text-sky" aria-hidden="true" />
            Download JSON
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">
          Full details are on the{" "}
          <a href="/export" className="link-quiet font-medium text-foreground">
            export page
          </a>
          .
        </p>
      </Card>

      {/* ---- Delete account ---- */}
      <Card tone="danger" padding="lg">
        <div className="flex items-start gap-3">
          <IconTile tone="danger" size="lg">
            <ShieldAlert />
          </IconTile>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">Delete account</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              This permanently removes your account and every purchase, return, reminder record, and
              uploaded file we hold. It cannot be undone. Backups are rotated out on our normal
              schedule, so a copy may survive briefly before it ages out.
            </p>
          </div>
        </div>

        <form action={deleteAction} className="mt-5 flex flex-col gap-3">
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
              <Trash2 className="size-4" aria-hidden="true" />
              {deletePending ? "Deleting…" : "Delete my account"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
