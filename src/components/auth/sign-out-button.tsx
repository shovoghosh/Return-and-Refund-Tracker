"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { signOutAction } from "@/app/(auth)/actions";

function Inner({
  variant = "secondary",
  compact = false,
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  compact?: boolean;
}) {
  const { pending } = useFormStatus();

  if (compact) {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-label={pending ? "Signing out" : "Sign out"}
        title="Sign out"
        className="grid size-9 place-items-center rounded-xl border border-border bg-surface text-muted transition hover:border-danger/30 hover:bg-danger-soft/40 hover:text-danger disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Button type="submit" variant={variant} size="sm" disabled={pending} aria-busy={pending}>
      <LogOut aria-hidden="true" className="size-3.5" />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function SignOutButton({
  variant = "secondary",
  compact = false,
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  compact?: boolean;
}) {
  return (
    <form action={signOutAction}>
      <Inner variant={variant} compact={compact} />
    </form>
  );
}
