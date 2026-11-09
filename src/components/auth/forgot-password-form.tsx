"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/ui";
import { FormFeedback, SubmitButton } from "@/components/auth/form-primitives";
import { requestPasswordResetAction } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/errors";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    requestPasswordResetAction,
    null,
  );
  const errors = state && !state.ok ? state.errors : {};
  const done = state?.ok === true;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} />
      {done ? (
        <p className="text-sm text-muted">
          If an account exists for that address, we have sent a reset link. It expires in one hour.
        </p>
      ) : (
        <Field
          label="Email"
          htmlFor="reset-email"
          required
          error={errors.email}
          hint="We will email you a link to choose a new password."
        >
          <Input id="reset-email" name="email" type="email" autoComplete="email" required />
        </Field>
      )}
      {!done ? <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton> : null}
      <p className="text-sm text-muted">
        <Link className="font-medium text-accent underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
