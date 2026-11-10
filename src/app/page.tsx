import type { CSSProperties } from "react";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  Check,
  Clock3,
  CreditCard,
  Download,
  EyeOff,
  FileText,
  Globe2,
  Inbox,
  LockKeyhole,
  Mail,
  Package,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Truck,
  Wallet,
  Zap,
} from "lucide-react";
import { Reveal, ScrollProgress } from "@/components/motion";
import { Badge, IconTile, LinkButton } from "@/components/ui";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Return Tracker — never miss a return deadline again",
  description:
    "Track online purchases, get reminded before each store's return deadline, and confirm when your refund actually arrives.",
};

const MARQUEE = [
  { icon: CalendarClock, label: "7-day reminder" },
  { icon: Bell, label: "2-day reminder" },
  { icon: Clock3, label: "1-day reminder" },
  { icon: Mail, label: "Day-of reminder" },
  { icon: Wallet, label: "Refund check-in" },
  { icon: ShieldCheck, label: "Private by default" },
];

const STEPS = [
  {
    number: "01",
    icon: ReceiptText,
    title: "Add the purchase",
    body: "Item, store, purchase date, and the return-by date the store gave you. Four fields. About thirty seconds.",
    tone: "accent" as const,
  },
  {
    number: "02",
    icon: CalendarClock,
    title: "We watch the clock",
    body: "We schedule gentle reminders before the deadline — 7, 2, and 1 day ahead, plus the morning it is due.",
    tone: "sky" as const,
  },
  {
    number: "03",
    icon: BadgeCheck,
    title: "You confirm the refund",
    body: "Follow the return from started to shipped to refund pending. Mark the money received only when you see it.",
    tone: "moss" as const,
  },
];

const FEATURES = [
  {
    icon: CalendarClock,
    title: "A deadline radar, not a spreadsheet",
    body: "Every return is sorted by what is actually urgent. Today, this week, refunds pending — no sorting required.",
    tone: "accent" as const,
    className: "lg:col-span-2",
    visual: "radar",
  },
  {
    icon: Bell,
    title: "Reminders that feel like a nudge",
    body: "Choose the days and the local hour. Every offset can be turned off. No daily nagging.",
    tone: "sky" as const,
    visual: "reminder",
  },
  {
    icon: Wallet,
    title: "Refund truth, kept honest",
    body: "Expected dates are your notes. The app never claims money arrived until you confirm it.",
    tone: "moss" as const,
    visual: "refund",
  },
  {
    icon: LockKeyhole,
    title: "Private by design",
    body: "No inbox access. No bank connection. No analytics or ad scripts. Your receipts stay yours.",
    tone: "lilac" as const,
    visual: "privacy",
  },
  {
    icon: Download,
    title: "Yours to take or delete",
    body: "Export every purchase as CSV or JSON, or delete your account and files in a couple of taps.",
    tone: "accent" as const,
    visual: "export",
  },
  {
    icon: EyeOff,
    title: "Nothing to connect",
    body: "We do not read email, guess store policies, or talk to retailers. You stay in control of every date.",
    tone: "sky" as const,
    className: "lg:col-span-2",
    visual: "nothing",
  },
  {
    icon: Globe2,
    title: "Your time zone, not ours",
    body: "Deadlines and reminder hours follow the zone you choose, so “today” means today where you live.",
    tone: "lilac" as const,
    visual: "timezone",
  },
];

const PREVIEW_ITEMS = [
  {
    name: "Noise-cancelling headphones",
    store: "Amazon",
    amount: "$329.00",
    status: "OPEN",
    label: "3 days left",
    deadline: "Return by Nov 12",
    tone: "warm" as const,
    icon: Package,
  },
  {
    name: "Linen duvet set",
    store: "Parachute",
    amount: "$249.00",
    status: "REFUND_PENDING",
    label: "Refund pending",
    deadline: "Shipped back Nov 4",
    tone: "lilac" as const,
    icon: Truck,
  },
  {
    name: "Trail running shoes",
    store: "REI",
    amount: "$168.00",
    status: "REFUND_RECEIVED",
    label: "Refund received",
    deadline: "$168.00 back",
    tone: "moss" as const,
    icon: BadgeCheck,
  },
];

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[35rem]">
      <div
        aria-hidden="true"
        className="hero-aurora -right-8 -top-10 size-64 bg-accent/35 sm:size-80"
      />
      <div
        aria-hidden="true"
        className="hero-aurora -bottom-12 -left-10 size-56 bg-accent-2/35 sm:size-72"
      />

      <div className="preview-window relative rounded-[2rem] border border-white/60 p-2.5 sm:p-3">
        <div className="overflow-hidden rounded-[1.5rem] border border-border/80 bg-background">
          <div className="flex items-center justify-between border-b border-border/80 bg-surface/80 px-4 py-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="size-2 rounded-full bg-danger/60" />
              <span className="size-2 rounded-full bg-warn/60" />
              <span className="size-2 rounded-full bg-moss/60" />
            </div>
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted">
              Return Tracker
            </span>
            <span className="size-6 rounded-full border border-accent/20 bg-accent-soft" aria-hidden="true" />
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">
                  <span className="size-1.5 rounded-full bg-accent" />
                  Dashboard
                </p>
                <p className="mt-1.5 font-display text-2xl font-semibold leading-none tracking-[-0.035em]">
                  Good evening, Alex.
                </p>
                <p className="mt-1 text-[0.7rem] text-muted">Sunday, November 9 · America/Edmonton</p>
              </div>
              <span className="grid size-8 place-items-center rounded-xl bg-accent text-accent-fg shadow-[0_8px_18px_-10px_var(--ring)]">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Needs attention", value: "2", tone: "text-warn" },
                { label: "Due in 7 days", value: "3", tone: "text-sky" },
                { label: "Refunds pending", value: "1", tone: "text-moss" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/80 bg-surface p-2.5">
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-muted">
                    {stat.label}
                  </p>
                  <p className={`mt-1 font-display text-xl font-semibold leading-none ${stat.tone}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-warn-border/80 bg-warn-bg px-3 py-2.5">
              <span className="flex items-center gap-2 text-[0.7rem] font-medium">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn opacity-40" />
                  <span className="relative inline-flex size-2 rounded-full bg-warn" />
                </span>
                One deadline is today
              </span>
              <ArrowRight className="size-3.5 text-warn" aria-hidden="true" />
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-border/80 bg-surface">
              {PREVIEW_ITEMS.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className={`flex items-center gap-2.5 px-3 py-2.5 ${index !== 0 ? "border-t border-border/70" : ""}`}
                  >
                    <IconTile tone={item.tone} size="sm">
                      <Icon />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.72rem] font-semibold">{item.name}</p>
                      <p className="mt-0.5 truncate text-[0.6rem] text-muted">
                        {item.store} · {item.amount}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.58rem] font-semibold text-foreground-soft">{item.label}</p>
                      <p className="mt-0.5 text-[0.55rem] text-muted">{item.deadline}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className="animate-float absolute -left-10 -top-14 z-20 hidden items-center gap-2 rounded-2xl border border-border bg-surface/95 px-3 py-2.5 shadow-lift backdrop-blur sm:flex"
        style={{ "--tilt": "-3deg", animationDelay: "0.4s" } as CSSProperties}
      >
        <span className="grid size-8 place-items-center rounded-xl bg-warn-bg text-warn">
          <Clock3 className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted">Don&apos;t forget</p>
          <p className="text-xs font-semibold">3 days left to return</p>
        </div>
      </div>

      <div
        className="animate-float-slow absolute -bottom-14 -right-2 z-20 hidden items-center gap-2 rounded-2xl border border-moss/20 bg-surface/95 px-3 py-2.5 shadow-lift backdrop-blur sm:flex"
        style={{ "--tilt": "2.5deg", animationDelay: "1.1s" } as CSSProperties}
      >
        <span className="grid size-8 place-items-center rounded-xl bg-moss-soft text-moss">
          <BadgeCheck className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-muted">Confirmed by you</p>
          <p className="text-xs font-semibold">$168.00 refund received</p>
        </div>
      </div>
    </div>
  );
}

function FeatureVisual({ kind }: { kind: string }) {
  if (kind === "radar") {
    return (
      <div className="mt-5 rounded-2xl border border-border/80 bg-surface/75 p-3">
        <div className="flex items-center justify-between text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted">
          <span>This week</span>
          <span className="text-accent">2 due</span>
        </div>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5" aria-hidden="true">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5">
              <span className="text-[0.55rem] font-medium text-muted">{day}</span>
              <span
                className={`h-10 w-full rounded-md border ${
                  index === 2
                    ? "border-accent/40 bg-accent/80"
                    : index === 5
                      ? "border-warn-border bg-warn-bg"
                      : "border-border/80 bg-surface-2/60"
                }`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-accent-soft/70 px-2.5 py-2 text-[0.65rem] font-medium text-accent">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          Headphones · due Wednesday
        </div>
      </div>
    );
  }

  if (kind === "reminder") {
    return (
      <div className="mt-5 space-y-2">
        {[
          { label: "7 days before", active: true },
          { label: "2 days before", active: true },
          { label: "1 day before", active: true },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/75 px-3 py-2 text-[0.7rem]"
          >
            <span className="text-muted">{row.label}</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-moss">
              <Check className="size-3.5" aria-hidden="true" /> On
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "refund") {
    return (
      <div className="mt-5 rounded-2xl border border-moss/20 bg-moss-soft/45 p-3">
        <div className="flex items-center gap-2 text-[0.7rem] font-semibold text-moss">
          <BadgeCheck className="size-4" aria-hidden="true" />
          Refund received · $168.00
        </div>
        <p className="mt-1.5 text-[0.65rem] leading-relaxed text-muted">
          Recorded on Nov 7. Only you can confirm this — not the app, and not the store.
        </p>
      </div>
    );
  }

  if (kind === "privacy") {
    return (
      <div className="mt-5 grid grid-cols-2 gap-2">
        {[
          { icon: Inbox, label: "Inbox", value: "Untouched" },
          { icon: CreditCard, label: "Bank", value: "Not linked" },
        ].map((row) => (
          <div key={row.label} className="rounded-xl border border-border/80 bg-surface/75 p-2.5">
            <row.icon className="size-4 text-muted" aria-hidden="true" />
            <p className="mt-2 text-[0.6rem] uppercase tracking-[0.1em] text-muted">{row.label}</p>
            <p className="text-[0.72rem] font-semibold">{row.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "export") {
    return (
      <div className="mt-5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.65rem] font-medium">
          <FileText className="size-3.5 text-accent" aria-hidden="true" /> CSV
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[0.65rem] font-medium">
          <FileText className="size-3.5 text-sky" aria-hidden="true" /> JSON
        </span>
        <span className="text-[0.62rem] text-muted">Any time</span>
      </div>
    );
  }

  if (kind === "timezone") {
    return (
      <div className="mt-5 rounded-2xl border border-border/80 bg-surface/75 p-3">
        <div className="flex items-center gap-2 text-[0.7rem] font-semibold">
          <Globe2 className="size-3.5 text-lilac" aria-hidden="true" />
          America/Edmonton
        </div>
        <div className="mt-2 flex items-center gap-2 text-[0.65rem] text-muted">
          <Clock3 className="size-3.5" aria-hidden="true" />
          Reminders arrive at 9:00 am, your time.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Badge tone="moss" icon={<Check className="size-3" aria-hidden="true" />}>
        No inbox
      </Badge>
      <Badge tone="moss" icon={<Check className="size-3" aria-hidden="true" />}>
        No bank
      </Badge>
      <Badge tone="moss" icon={<Check className="size-3" aria-hidden="true" />}>
        No guessing
      </Badge>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-clip">
      <ScrollProgress />
      <SiteHeader />

      <main className="flex-1">
        {/* ---------------------------------------------------------------- */}
        {/*  Hero                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative">
          <div
            aria-hidden="true"
            className="hero-aurora -left-24 top-16 size-[26rem] bg-accent/25 sm:size-[34rem]"
          />
          <div
            aria-hidden="true"
            className="hero-aurora right-0 top-40 size-[22rem] bg-accent-2/20 sm:size-[30rem]"
          />
          <div
            aria-hidden="true"
            className="dot-grid pointer-events-none absolute inset-x-0 top-0 h-[36rem] opacity-[0.18] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
          />

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="max-w-3xl">
              <div className="animate-fade-up">
                <Badge tone="accent" icon={<Sparkles className="size-3.5" aria-hidden="true" />}>
                  The calm way to handle returns
                </Badge>
              </div>

              <h1
                className="animate-fade-up mt-5 font-display text-[2.9rem] font-semibold leading-[0.96] tracking-[-0.045em] sm:text-[4rem] lg:text-[4.6rem] xl:text-[5.15rem]"
                style={{ animationDelay: "80ms" }}
              >
                Never lose money to a{" "}
                <span className="serif-italic text-gradient">forgotten return</span>.
              </h1>

              <p
                className="animate-fade-up mt-5 max-w-xl text-[0.98rem] leading-relaxed text-muted sm:text-[1.05rem]"
                style={{ animationDelay: "150ms" }}
              >
                One quiet place for every return deadline, every package on its way back, and every
                refund you are still waiting on. We remember the dates so you can get on with your day.
              </p>

              <div
                className="animate-fade-up mt-7 flex flex-col gap-2.5 sm:flex-row sm:items-center"
                style={{ animationDelay: "220ms" }}
              >
                <LinkButton href="/sign-up" size="lg" className="group">
                  Create your free account
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </LinkButton>
                <LinkButton href="/#how-it-works" size="lg" variant="secondary">
                  See how it works
                </LinkButton>
              </div>

              <ul
                className="animate-fade-up mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem] font-medium text-muted"
                style={{ animationDelay: "290ms" }}
              >
                {["No card required", "Set up in about 30 seconds", "Private by default"].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <span className="grid size-4 place-items-center rounded-full bg-moss-soft text-moss">
                      <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative animate-fade-in lg:pl-4" style={{ animationDelay: "200ms" }}>
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Marquee                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="What Return Tracker does" className="border-y border-border/70 bg-surface/55">
          <p className="sr-only">
            Reminders seven days, two days, one day, and the day of the deadline. Refund check-ins.
            Private by default.
          </p>
          <div className="marquee-mask relative overflow-hidden py-3.5" aria-hidden="true">
            <div className="animate-marquee flex w-max items-center gap-8 pl-6">
              {[...MARQUEE, ...MARQUEE].map((item, index) => (
                <span
                  key={`${item.label}-${index}`}
                  className="inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted"
                >
                  <item.icon className="size-3.5 text-accent" />
                  {item.label}
                  <span className="ml-6 size-1 rounded-full bg-border-strong" />
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  How it works                                                    */}
        {/* ---------------------------------------------------------------- */}
        <section id="how-it-works" className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <Reveal>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">
                  <span className="size-1.5 rounded-full bg-accent" />
                  How it works
                </p>
                <h2 className="mt-3 max-w-2xl font-display text-[2.1rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[2.9rem]">
                  Three steps. <span className="serif-italic text-muted">Zero mental tabs.</span>
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                The hard part is not the app. It is the moment a return window quietly closes while
                you are busy living.
              </p>
            </div>
          </Reveal>

          <div className="relative mt-12">
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-[3.35rem] hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent lg:block"
            />
            <div className="stagger grid gap-4 lg:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.number} className="card card-hover relative p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <IconTile tone={step.tone} size="lg">
                      <step.icon />
                    </IconTile>
                    <span className="font-display text-3xl font-semibold text-border-strong/80">{step.number}</span>
                  </div>
                  <h3 className="mt-6 font-display text-2xl font-semibold tracking-[-0.025em]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Features                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section id="features" className="relative border-y border-border/70 bg-surface/45">
          <div
            aria-hidden="true"
            className="hero-aurora -right-24 top-24 size-80 bg-accent/15"
          />
          <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <Reveal>
              <div className="max-w-2xl">
                <p className="eyebrow">
                  <span className="size-1.5 rounded-full bg-accent" />
                  Built for real life
                </p>
                <h2 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[2.9rem]">
                  All the useful bits.{" "}
                  <span className="serif-italic text-muted">None of the surveillance.</span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  No inbox scraping, no bank links, no “smart” guesses about a store&apos;s policy.
                  Just the dates you enter, kept beautifully.
                </p>
              </div>
            </Reveal>

            <div className="stagger mt-11 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className={`card card-hover group relative overflow-hidden p-5 sm:p-6 ${feature.className ?? ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <IconTile tone={feature.tone} size="lg">
                      <feature.icon />
                    </IconTile>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 text-border-strong transition group-hover:text-accent"
                    />
                  </div>
                  <h3 className="mt-5 text-[1.02rem] font-semibold tracking-[-0.01em]">{feature.title}</h3>
                  <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{feature.body}</p>
                  <FeatureVisual kind={feature.visual} />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Honesty panel                                                   */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-[#191510] px-5 py-10 text-[#f5eee3] sm:px-10 sm:py-14 lg:px-14">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/35 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-accent-2/25 blur-3xl"
              />
              <div className="relative grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[#f5eee3]/70">
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    The honest bit
                  </p>
                  <h2 className="mt-5 max-w-2xl font-display text-[2.3rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[3.2rem]">
                    A reminder is not a refund.{" "}
                    <span className="serif-italic text-accent-2">We will never pretend otherwise.</span>
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#f5eee3]/65">
                    We cannot start a return, speak to a store, or make money appear. What we can do
                    is keep the deadline visible, keep the next step clear, and let you be the one who
                    confirms the refund.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      icon: CalendarClock,
                      title: "The deadline is yours",
                      body: "The date you enter is the date we use. We do not guess store policies.",
                    },
                    {
                      icon: Wallet,
                      title: "The refund is your call",
                      body: "Expected dates are notes. Refunds are recorded only when you confirm them.",
                    },
                    {
                      icon: LockKeyhole,
                      title: "The data stays private",
                      body: "Only your account can read your purchases. Export or delete it any time.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 backdrop-blur"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-accent-2">
                        <item.icon className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#f5eee3]/60">{item.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Final CTA                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <Reveal>
            <div className="marketing-panel relative overflow-hidden rounded-[2rem] border border-accent/15 px-5 py-12 text-center sm:px-10 sm:py-16">
              <div
                aria-hidden="true"
                className="hero-aurora left-1/2 top-0 size-80 -translate-x-1/2 bg-accent/20"
              />
              <div className="relative mx-auto max-w-2xl">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-accent/20 bg-accent-soft text-accent">
                  <Zap className="size-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 font-display text-[2.2rem] font-semibold leading-[1.03] tracking-[-0.04em] sm:text-[3rem]">
                  Your next return window is already open.
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
                  Add one purchase and see how it feels to stop carrying the deadline in your head.
                  Free to start. No card. No inbox access.
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                  <LinkButton href="/sign-up" size="lg" className="group">
                    Start tracking for free
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </LinkButton>
                  <LinkButton href="/sign-in" size="lg" variant="secondary">
                    I already have an account
                  </LinkButton>
                </div>
                <p className="mt-4 text-[0.68rem] text-muted">
                  Takes about 30 seconds. You can delete everything later in two taps.
                </p>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
