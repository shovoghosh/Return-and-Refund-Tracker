import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Return Tracker — never miss a return deadline again",
  description:
    "Track online purchases, get reminded before each store's return deadline, and confirm when your refund actually arrives.",
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    {children}
  </section>
);

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center justify-between gap-4">
        <span className="text-lg font-semibold tracking-tight">Return Tracker</span>
        <nav aria-label="Account">
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Track your online purchases and get a friendly reminder before each return deadline passes.
        </h1>
        <p className="max-w-2xl text-base text-muted">
          You add the item and the store&apos;s stated return-by date; we keep it in one place, remind
          you 7 days, 2 days, and 1 day ahead (and on the day itself if you like), and stay out of the
          way until you tell us the item was returned and the refund landed.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-medium text-accent-fg transition hover:opacity-90"
          >
            Create your free account
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-surface px-6 py-3 text-base font-medium transition hover:border-accent"
          >
            Sign in
          </Link>
        </div>
      </section>

      <Section title="What this app does">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Stores the purchases you want to track, and the return deadline you entered for each one.</li>
          <li>Shows your deadlines in the order they are coming up, in your own time zone.</li>
          <li>Sends reminder emails at the times you choose, and keeps a record of what was sent.</li>
          <li>Lets you follow a return from started to shipped to refund pending, and confirm for yourself when the money arrives.</li>
          <li>Exports or deletes everything you have entered, whenever you ask.</li>
        </ul>
      </Section>

      <Section title="What this app does not do">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>It never reads your email inbox or connects to your email account.</li>
          <li>It never guesses a store&apos;s return policy. You enter the deadline; the app does not look it up or invent one.</li>
          <li>It never connects to your bank, card, or payment accounts.</li>
          <li>It never claims a refund arrived. Only you can confirm that, and the app says so until you do.</li>
        </ul>
      </Section>

      <Section title="Your privacy">
        <p className="max-w-2xl text-sm text-muted">
          A purchase history can say a lot about a person, so we collect as little as possible. We
          store the purchases you enter, your reminder preferences, and your time zone — nothing more.
          We do not ask for bank details or inbox access, and nothing is shared with the stores you
          track. Your data is only ever read back to you: exports and reminders are built from your
          rows alone, and no other account can see them.
        </p>
        <p className="max-w-2xl text-sm text-muted">
          You can change your reminders or delete your account and its uploaded files at any time from
          Settings. If you want your data, one button produces a CSV or JSON file; if you want it gone,
          deletion removes your records and files on your account&apos;s normal backup rotation.
        </p>
      </Section>

      <Section title="Honest about outcomes">
        <p className="max-w-2xl text-sm text-muted">
          We do not claim the app has &ldquo;saved&rdquo; you money. A reminder is not proof that a
          refund was recovered. The app helps you remember; whether a return succeeds and a refund
          arrives is something only you can confirm.
        </p>
      </Section>

      <footer className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted">
        <p>
          Ready to start?{" "}
          <Link href="/sign-up" className="font-medium text-foreground underline underline-offset-2">
            Create a free account
          </Link>{" "}
          — it takes one item to see the value.
        </p>
      </footer>
    </div>
  );
}