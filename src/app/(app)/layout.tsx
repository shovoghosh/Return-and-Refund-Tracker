import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Plus, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar, LinkButton, Logo } from "@/components/ui";
import { AppNav } from "./_components/app-nav";

/**
 * The authenticated app shell.
 *
 * Every page nested under `(app)` is protected by construction: `requireUser()`
 * runs before the shell renders, and a signed-out visitor is redirected to
 * /sign-in before any page code runs.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const emailName = user.email.split("@")[0] ?? user.email;

  return (
    <div className="relative min-h-dvh">
      <aside className="glass-bar fixed inset-y-0 left-0 z-40 hidden w-[17.5rem] flex-col border-r border-border/80 lg:flex">
        <div className="flex h-[4.6rem] items-center px-5">
          <Logo href="/dashboard" />
        </div>

        <div className="px-4">
          <LinkButton href="/purchases/new" size="lg" className="group w-full justify-between">
            <span className="inline-flex items-center gap-2">
              <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
              New purchase
            </span>
            <ArrowUpRight
              aria-hidden="true"
              className="size-4 opacity-70 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </LinkButton>
        </div>

        <div className="mt-7 flex-1 overflow-y-auto px-3">
          <p className="mb-2 px-3 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
            Workspace
          </p>
          <AppNav />
        </div>

        <div className="border-t border-border/70 p-3.5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-surface/70 p-2.5">
            <Avatar name={emailName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground" title={user.email}>
                {emailName}
              </p>
              <p className="truncate text-[0.65rem] text-muted" title={user.email}>
                {user.email}
              </p>
            </div>
            <SignOutButton compact />
          </div>
          <p className="mt-3 flex items-center gap-1.5 px-1 text-[0.62rem] leading-relaxed text-muted">
            <ShieldCheck className="size-3 text-moss" aria-hidden="true" />
            Private workspace ·{" "}
            <Link href="/privacy" className="link-quiet">
              Privacy
            </Link>
          </p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-[17.5rem]">
        <header className="glass-bar sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 lg:hidden">
          <Logo href="/dashboard" size="sm" />
          <LinkButton href="/purchases/new" size="sm" className="group">
            <Plus className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
            Add
          </LinkButton>
        </header>

        <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-14 lg:pt-10">
          <div
            aria-hidden="true"
            className="dot-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 opacity-[0.1] [mask-image:linear-gradient(to_bottom,black,transparent)]"
          />
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-28 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:hidden">
          <p className="truncate">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="link-quiet">
              Account settings
            </Link>
            <SignOutButton compact />
          </div>
        </footer>
      </div>

      <AppNav variant="mobile" />
    </div>
  );
}
