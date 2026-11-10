"use client";

import { useSyncExternalStore, useActionState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Field, Input } from "@/components/ui";
import { FormFeedback, SubmitButton } from "@/components/auth/form-primitives";
import { signUpAction } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/errors";

/** Best-effort time zone from the browser; the server validates and defaults. */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/** Nothing to subscribe to: the browser's time zone does not change mid-session. */
const subscribeToNothing = () => () => {};

/** The server cannot know the visitor's time zone, so SSR renders no value. */
const serverTimezoneSnapshot = () => "";

export function SignUpForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(signUpAction, null);
  // Read through useSyncExternalStore so the server snapshot ("") and the first
  // client render agree. Using the server's own time zone during SSR would make
  // the client text differ and trigger a hydration mismatch.
  const tz = useSyncExternalStore(subscribeToNothing, detectTimezone, serverTimezoneSnapshot);

  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} />
      <Field label="Email" htmlFor="signup-email" required error={errors.email}>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={<Mail />}
          required
          aria-describedby={errors.email ? "signup-email-error" : undefined}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="signup-password"
        required
        error={errors.password}
        hint="At least 8 characters."
      >
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leadingIcon={<LockKeyhole />}
          required
          minLength={8}
        />
      </Field>
      <Field label="Confirm password" htmlFor="signup-confirm" required error={errors.confirmPassword}>
        <Input
          id="signup-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Same password again"
          leadingIcon={<LockKeyhole />}
          required
        />
      </Field>
      <input type="hidden" name="timezone" value={tz} />
      <SubmitButton pendingLabel="Creating account…" className="group w-full">
        Create account
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </SubmitButton>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-medium text-accent underline-offset-4 hover:underline" href="/sign-in">
          Sign in
        </Link>
      </p>
      <p className="flex items-start gap-1.5 rounded-lg border border-border/70 bg-surface-2/45 px-3 py-2 text-[0.68rem] leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-moss" aria-hidden="true" />
        We use the time zone your device reports ({tz || "your device default"}). You can change it
        in Settings at any time.
      </p>
    </form>
  );
}
