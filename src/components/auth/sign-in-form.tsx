"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/ui";
import { FormFeedback, SubmitButton } from "@/components/auth/form-primitives";
import { signInAction } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/errors";

export function SignInForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(signInAction, null);
  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} />
      <Field label="Email" htmlFor="signin-email" required error={errors.email}>
        <Input id="signin-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="signin-password" required error={errors.password}>
        <Input id="signin-password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link className="font-medium text-accent underline" href="/reset-password">
          Forgot password?
        </Link>
        <Link className="font-medium text-accent underline" href="/sign-up">
          Create an account
        </Link>
      </div>
    </form>
  );
}
