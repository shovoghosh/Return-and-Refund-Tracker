import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Layout for the public information pages (help, privacy, terms, contact).
 *
 * These pages are readable without signing in so that a visitor — or a store's
 * support agent — can check how the app works and what it does with data before
 * creating an account.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
          Return Tracker
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            Create account
          </Link>
        </nav>
      </header>

      <main className="flex flex-col gap-6">{children}</main>

      <footer className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-sm text-muted">
        <Link href="/" className="underline-offset-2 hover:text-foreground hover:underline">
          Home
        </Link>
        <Link href="/help" className="underline-offset-2 hover:text-foreground hover:underline">
          Help
        </Link>
        <Link href="/contact" className="underline-offset-2 hover:text-foreground hover:underline">
          Contact
        </Link>
        <Link href="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
          Terms
        </Link>
      </footer>
    </div>
  );
}
