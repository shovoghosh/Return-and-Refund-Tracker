"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
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
        <p className="rounded-xl border border-moss/20 bg-moss-soft/45 px-3.5 py-3 text-sm leading-relaxed text-muted">
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
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            leadingIcon={<Mail />}
            required
          />
        </Field>
      )}
      {!done ? (
        <SubmitButton pendingLabel="Sending…" className="group w-full">
          Send reset link
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </SubmitButton>
      ) : null}
      <p className="text-sm text-muted">
        <Link className="font-medium text-accent underline-offset-4 hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
