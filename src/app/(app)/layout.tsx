import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth-guard";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppNav } from "./_components/app-nav";

/**
 * The authenticated app shell.
 *
 * This is a Server Component that calls `requireUser()` before rendering
 * anything: every page nested under `(app)` is therefore protected by
 * construction, and a signed-out visitor is redirected to /sign-in before any
 * page code runs. This file is the nested layout — the root layout is untouched.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col gap-5 pb-24 sm:pb-0">
      <header className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <Link
          href="/dashboard"
          className="rounded-md text-lg font-semibold tracking-tight text-foreground"
        >
          Return Tracker
        </Link>
        <Link
          href="/purchases/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          Add purchase
        </Link>
      </header>

      <AppNav />

      <main id="app-content" className="flex-1">
        {children}
      </main>

      <footer className="flex flex-col gap-3 border-t border-border pt-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Signed in as <span className="font-medium text-foreground">{user.email}</span>.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Account settings
          </Link>
        </p>
        <SignOutButton />
      </footer>
    </div>
  );
}