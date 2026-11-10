import Link from "next/link";
import { ArrowUpRight, Heart, ShieldCheck } from "lucide-react";
import { COMPANY_EMAIL, COMPANY_NAME, PRODUCT_NAME } from "@/lib/brand";
import { LinkButton, Logo } from "@/components/ui";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/help", label: "Help" },
];

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Logo href="/" size={compact ? "sm" : "md"} />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/sign-in"
            className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <LinkButton href="/sign-up" size="sm" className="group">
            Start free
            <ArrowUpRight
              aria-hidden="true"
              className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </LinkButton>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-border/80">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo href="/" size="sm" />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A calm, private place for return deadlines, return progress, and the refund you are
              still waiting on.
            </p>
            <p className="mt-2 text-xs text-muted">
              {PRODUCT_NAME} is a product of {COMPANY_NAME}.
            </p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck aria-hidden="true" className="size-3.5 text-moss" />
              No inbox access. No bank connection. No ads.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-6 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-2.5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">Product</p>
              <Link href="/#how-it-works" className="text-foreground-soft transition hover:text-accent">
                How it works
              </Link>
              <Link href="/#features" className="text-foreground-soft transition hover:text-accent">
                Features
              </Link>
              <Link href="/sign-up" className="text-foreground-soft transition hover:text-accent">
                Create account
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">Support</p>
              <Link href="/help" className="text-foreground-soft transition hover:text-accent">
                Help centre
              </Link>
              <Link href="/contact" className="text-foreground-soft transition hover:text-accent">
                Contact
              </Link>
              <a href={`mailto:${COMPANY_EMAIL}`} className="text-foreground-soft transition hover:text-accent">
                {COMPANY_EMAIL}
              </a>
              <Link href="/sign-in" className="text-foreground-soft transition hover:text-accent">
                Sign in
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">Legal</p>
              <Link href="/privacy" className="text-foreground-soft transition hover:text-accent">
                Privacy
              </Link>
              <Link href="/terms" className="text-foreground-soft transition hover:text-accent">
                Terms
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/70 pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {COMPANY_NAME} · {PRODUCT_NAME}. Built for real life, not
            perfect shoppers.
          </p>
          <p className="inline-flex flex-wrap items-center gap-1.5">
            <a href={`mailto:${COMPANY_EMAIL}`} className="link-quiet">
              {COMPANY_EMAIL}
            </a>
            <span aria-hidden="true">·</span>
            Made with <Heart aria-hidden="true" className="size-3.5 text-accent" /> for people with a
            receipt drawer.
          </p>
        </div>
      </div>
    </footer>
  );
}
