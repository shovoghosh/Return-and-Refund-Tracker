import type { Metadata } from "next";
import Link from "next/link";
import { Bug, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { getEnv } from "@/lib/env";
import { Card, IconTile, PageHeader, buttonStyles } from "@/components/ui";

/**
 * Rendered per request: the support address comes from the runtime environment,
 * so a deployment can change where reports go without rebuilding the app. The
 * page is a few paragraphs of static markup, so request-time rendering costs
 * nothing meaningful.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact — Return Tracker",
  description: "Report a bug, ask for help, tell us about a privacy request, or flag a security issue.",
};

const BUG_SUBJECT = "Return Tracker: bug report";
const HELP_SUBJECT = "Return Tracker: help request";
const PRIVACY_SUBJECT = "Return Tracker: privacy request";

export default function ContactPage() {
  const { SUPPORT_EMAIL } = getEnv();

  const mailto = (subject: string) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Talk to a person"
        title="Contact"
        subtitle="One person reads this inbox. Say what happened and we will get back to you."
      />

      <Card padding="lg" className="relative overflow-hidden">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <IconTile tone="accent" size="lg">
            <Mail />
          </IconTile>
          <div>
            <p className="text-sm font-semibold">Email</p>
            <a
              className="mt-1 inline-block break-all font-display text-xl font-semibold tracking-[-0.02em] text-foreground underline decoration-accent/40 decoration-2 underline-offset-4 hover:decoration-accent"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This is a real mailbox, not a form that disappears into a queue. Replies usually take a
              few days; we cannot promise a same-day answer.
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <a href={mailto(BUG_SUBJECT)} className={buttonStyles({})}>
            <Bug className="size-4" aria-hidden="true" />
            Report a bug
          </a>
          <a href={mailto(HELP_SUBJECT)} className={buttonStyles({ variant: "secondary" })}>
            <LifeBuoy className="size-4" aria-hidden="true" />
            Ask for help
          </a>
          <a href={mailto(PRIVACY_SUBJECT)} className={buttonStyles({ variant: "secondary" })}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            Privacy request
          </a>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />A bug report that we can act on
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          <li>What you were doing, step by step.</li>
          <li>What you expected to happen, and what happened instead.</li>
          <li>The time it happened, including your time zone if the bug concerns a reminder or deadline.</li>
          <li>Your browser and device, or whether you were on a phone.</li>
          <li>The exact text of any error message, if one appeared.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="size-1.5 rounded-full bg-danger" aria-hidden="true" />
          Please do not send
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          No passwords, full card numbers, or other payment credentials. You never need to send those
          to ask for help. If we need to check your account, we will look it up on our side rather than
          ask you to prove who you are with a secret.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="size-1.5 rounded-full bg-moss" aria-hidden="true" />
          Security reports
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          If you believe you have found a security problem, email the address above with{" "}
          <span className="font-medium text-foreground">Security</span> at the start of the subject.
          Please describe the issue and how to reproduce it, and give us a reasonable chance to fix it
          before posting details publicly. We will not pursue anyone who reports a problem in good
          faith.
        </p>
      </section>

      <Card padding="lg" tone="moss">
        <h2 className="text-base font-semibold tracking-tight">Faster answers</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Many questions are already answered on the{" "}
          <Link href="/help" className="font-medium text-foreground underline underline-offset-2">
            help page
          </Link>
          : where the return date comes from, when reminders are sent, how to record a refund, and
          how to export or delete your data. The{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
            privacy page
          </Link>{" "}
          covers what is stored.
        </p>
      </Card>
    </article>
  );
}
