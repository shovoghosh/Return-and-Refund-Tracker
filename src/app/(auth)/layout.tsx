import Link from "next/link";
import {
  CalendarClock,
  Check,
  Clock3,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-[1.04fr_0.96fr]">
      <aside className="relative hidden overflow-hidden bg-[#1b1712] px-8 py-9 text-[#f5eee3] lg:flex lg:flex-col lg:justify-between xl:px-12 xl:py-12">
        <div
          aria-hidden="true"
          className="dot-grid pointer-events-none absolute inset-0 opacity-[0.12] [mask-image:radial-gradient(80%_70%_at_30%_20%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-24 size-[28rem] rounded-full bg-accent/35 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-24 size-[26rem] rounded-full bg-accent-2/25 blur-3xl"
        />

        <div className="relative">
          <Logo href="/" tone="light" />
        </div>

        <div className="relative my-12 max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-background/65">
            <Sparkles className="size-3.5 text-accent-2" aria-hidden="true" />
            The calmest place for the least fun errand
          </p>
          <h1 className="mt-6 font-display text-[2.7rem] font-semibold leading-[1.02] tracking-[-0.045em] xl:text-[3.4rem]">
            The receipt drawer,{" "}
            <span className="serif-italic text-accent-2">finally under control.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-background/60">
            Keep every return deadline visible, every package accounted for, and every refund
            confirmed by you — not guessed by an app.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              {
                icon: CalendarClock,
                title: "Deadlines sorted by what is urgent",
                body: "Today, this week, and later — in your own time zone.",
              },
              {
                icon: Wallet,
                title: "Refunds, tracked honestly",
                body: "Expected dates are notes. Money received is your confirmation.",
              },
              {
                icon: ShieldCheck,
                title: "Private from the first tap",
                body: "No inbox access, no bank link, no ad scripts.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-accent-2">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-background/55">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 backdrop-blur">
            <span className="grid size-9 place-items-center rounded-xl bg-warn/15 text-accent-2">
              <Clock3 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold">3 days left to return</p>
              <p className="mt-0.5 text-[0.65rem] text-background/50">
                A gentle nudge, before the window closes.
              </p>
            </div>
            <span className="ml-auto grid size-5 place-items-center rounded-full bg-moss/20 text-moss">
              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
            </span>
          </div>
        </div>

        <p className="relative max-w-md text-xs leading-relaxed text-[#f5eee3]/40">
          Return Tracker keeps the dates you give it. It cannot start a return or issue a refund —
          it just makes sure you do not miss your chance.
        </p>
      </aside>

      <div className="relative flex min-h-dvh flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 top-10 size-72 rounded-full bg-accent/10 blur-3xl"
        />
        <header className="relative flex items-center justify-between px-4 py-4 sm:px-6 lg:hidden">
          <Logo href="/" />
          <Link
            href="/sign-in"
            className="rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Sign in
          </Link>
        </header>

        <main className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <div className="w-full max-w-[27rem]">{children}</div>
        </main>

        <footer className="relative px-4 py-5 text-center text-[0.68rem] text-muted sm:px-6 lg:hidden">
          <Link href="/privacy" className="link-quiet">
            Privacy
          </Link>
          <span aria-hidden="true" className="mx-2">
            ·
          </span>
          <Link href="/terms" className="link-quiet">
            Terms
          </Link>
          <span aria-hidden="true" className="mx-2">
            ·
          </span>
          <Link href="/help" className="link-quiet">
            Help
          </Link>
        </footer>
      </div>
    </div>
  );
}
