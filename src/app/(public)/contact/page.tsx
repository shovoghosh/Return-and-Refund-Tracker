import type { Metadata } from "next";
import Link from "next/link";
import { getEnv } from "@/lib/env";
import { Card, PageHeader } from "@/components/ui";

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
        title="Contact"
        subtitle="One person reads this inbox. Say what happened and we will get back to you."
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Email</p>
          <a
            className="w-fit text-base font-medium text-foreground underline underline-offset-2"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="text-sm text-muted">
            This is a real mailbox, not a form that disappears into a queue. Replies usually take a few
            days; we cannot promise a same-day answer.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={mailto(BUG_SUBJECT)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition hover:opacity-90"
          >
            Report a bug
          </a>
          <a
            href={mailto(HELP_SUBJECT)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent"
          >
            Ask for help
          </a>
          <a
            href={mailto(PRIVACY_SUBJECT)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent"
          >
            Privacy request
          </a>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">A bug report that we can act on</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>What you were doing, step by step.</li>
          <li>What you expected to happen, and what happened instead.</li>
          <li>The time it happened, including your time zone if the bug concerns a reminder or deadline.</li>
          <li>Your browser and device, or whether you were on a phone.</li>
          <li>The exact text of any error message, if one appeared.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">Please do not send</h2>
        <p className="text-sm text-muted">
          No passwords, full card numbers, or other payment credentials. You never need to send those to
          ask for help. If we need to check your account, we will look it up on our side rather than ask
          you to prove who you are with a secret.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">Security reports</h2>
        <p className="text-sm text-muted">
          If you believe you have found a security problem, email the address above with{" "}
          <span className="font-medium text-foreground">Security</span> at the start of the subject.
          Please describe the issue and how to reproduce it, and give us a reasonable chance to fix it
          before posting details publicly. We will not pursue anyone who reports a problem in good
          faith.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">Faster answers</h2>
        <p className="text-sm text-muted">
          Many questions are already answered on the{" "}
          <Link href="/help" className="underline underline-offset-2">
            help page
          </Link>
          : where the return date comes from, when reminders are sent, how to record a refund, and how to
          export or delete your data. The{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy page
          </Link>{" "}
          covers what is stored.
        </p>
      </section>
    </article>
  );
}
