"use client";

import { useActionState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { FormFeedback, SubmitButton } from "@/components/auth/form-primitives";
import { resendVerificationAction, verifyEmailAction } from "@/app/(auth)/actions";
import type { ActionResult } from "@/lib/errors";

/** Confirms an email token (button, so email clients cannot prefetch it). */
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(verifyEmailAction, null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Confirming…" className="w-full">
        <Check className="size-4" aria-hidden="true" />
        Confirm my email
      </SubmitButton>
    </form>
  );
}

/** Re-sends a verification link for a signed-in, unverified account. */
export function ResendVerificationForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    resendVerificationAction,
    null,
  );
  const sent = state?.ok === true;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormFeedback state={state} successMessage="Verification email sent. Check your inbox." />
      {!sent ? (
        <SubmitButton variant="secondary" pendingLabel="Sending…" className="w-full">
          <RefreshCw className="size-4" aria-hidden="true" />
          Resend verification email
        </SubmitButton>
      ) : null}
    </form>
  );
}
