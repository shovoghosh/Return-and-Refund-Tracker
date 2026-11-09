"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { signOutAction } from "@/app/(auth)/actions";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Inner />
    </form>
  );
}
