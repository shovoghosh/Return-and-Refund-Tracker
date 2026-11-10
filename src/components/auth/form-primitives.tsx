"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button, Notice, type ButtonSize, type ButtonVariant } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";

/** Submit button that reflects the surrounding form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-busy={pending}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
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
    return successMessage ? <Notice tone="success">{successMessage}</Notice> : null;
  }
  if (state.formError) return <Notice tone="error">{state.formError}</Notice>;
  return null;
}
