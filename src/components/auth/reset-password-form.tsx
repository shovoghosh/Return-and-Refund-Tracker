"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Field, Input } from "@/components/ui";
import { FormFeedback, SubmitButton } from "@/components/auth/form-primitives";
import { resetPasswordAction } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/errors";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(resetPasswordAction, null);
  const errors = state && !state.ok ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="New password"
        htmlFor="new-password"
        required
        error={errors.password}
        hint="At least 8 characters."
      >
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leadingIcon={<LockKeyhole />}
          required
          minLength={8}
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm-new-password" required error={errors.confirmPassword}>
        <Input
          id="confirm-new-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Same password again"
          leadingIcon={<LockKeyhole />}
          required
        />
      </Field>
      <SubmitButton pendingLabel="Saving…" className="w-full">
        Set new password
      </SubmitButton>
      <p className="text-sm text-muted">
        <Link className="font-medium text-accent underline-offset-4 hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
