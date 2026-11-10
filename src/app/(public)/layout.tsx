import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

/**
 * Layout for the public information pages (help, privacy, terms, contact).
 *
 * These pages are readable without signing in so that a visitor — or a store's
 * support agent — can check how the app works and what it does with data before
 * creating an account.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-72 opacity-[0.14] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <SiteHeader compact />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
