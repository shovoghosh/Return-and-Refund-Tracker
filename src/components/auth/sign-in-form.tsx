"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
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
        <Input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={<Mail />}
          required
        />
      </Field>
      <Field label="Password" htmlFor="signin-password" required error={errors.password}>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          leadingIcon={<LockKeyhole />}
          required
        />
      </Field>
      <SubmitButton pendingLabel="Signing in…" className="group w-full">
        Sign in
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </SubmitButton>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link className="link-quiet font-medium text-muted" href="/reset-password">
          Forgot password?
        </Link>
        <Link className="font-medium text-accent underline-offset-4 hover:underline" href="/sign-up">
          Create an account
        </Link>
      </div>
    </form>
  );
}
