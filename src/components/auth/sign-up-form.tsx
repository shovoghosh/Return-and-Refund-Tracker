"use client";

import { useSyncExternalStore, useActionState } from "react";
import Link from "next/link";
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
          required
          minLength={8}
        />
      </Field>
      <Field label="Confirm password" htmlFor="signup-confirm" required error={errors.confirmPassword}>
        <Input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <input type="hidden" name="timezone" value={tz} />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link className="font-medium text-accent underline" href="/sign-in">
          Sign in
        </Link>
      </p>
      <p className="text-xs text-muted">
        We will show the time zone we detected ({tz || "your device default"}) — you can change it in Settings.
      </p>
    </form>
  );
}
