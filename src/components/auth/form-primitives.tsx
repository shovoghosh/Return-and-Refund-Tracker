"use client";

import { useFormStatus } from "react-dom";
import { Button, Notice } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

/** Submit button that reflects the surrounding form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}

/**
 * Renders a form-level failure (`formError`) or success message from an
 * ActionResult. Field-level errors are rendered by each Field.
 */
export function FormFeedback({
  state,
  successMessage,
}: {
  state: ActionResult | null;
  successMessage?: string;
}) {
  if (!state) return null;
  if (state.ok) {
    return successMessage ? <Notice tone="info">{successMessage}</Notice> : null;
  }
  if (state.formError) return <Notice tone="error">{state.formError}</Notice>;
  return null;
}
