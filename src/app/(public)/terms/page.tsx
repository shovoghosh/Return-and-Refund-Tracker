import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY_NAME } from "@/lib/brand";
import { getEnv } from "@/lib/env";
import { PageHeader } from "@/components/ui";

/** Rendered per request so SUPPORT_EMAIL reflects the deployment, like /contact. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms — Return Tracker",
  description:
    "The plain-language terms for using Return Tracker by MXSXLAB Inc.: what the service is, what it is not, and what we each agree to.",
};

const LAST_UPDATED = "November 9, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  const { SUPPORT_EMAIL } = getEnv();

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="The fine print"
        title="Terms"
        subtitle="Short and in plain language. By creating an account you agree to these terms."
      />

      <p className="text-xs text-muted">
        Last updated: {LAST_UPDATED} · Operated by {COMPANY_NAME}
      </p>

      <Section title="What this service is">
        <p className="text-sm text-muted">
          Return Tracker is a personal record-keeping tool operated by {COMPANY_NAME}. You enter
          purchases, the return-by date a store gave you, and details of any return or refund. The
          app stores those records, displays them in your time zone, and sends you the reminders you
          configure. These terms are between you and {COMPANY_NAME}.
        </p>
      </Section>

      <Section title="What this service is not">
        <p className="text-sm text-muted">This matters more than the rest of the page, so it comes early.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            <strong className="text-foreground">We are not the retailer.</strong> We cannot start a
            return, issue a refund, or speak to a store on your behalf.
          </li>
          <li>
            <strong className="text-foreground">We do not know a store&apos;s policy.</strong> The
            return deadline is the date you entered. If it is wrong, the reminder is wrong, and the app
            will not correct it for you.
          </li>
          <li>
            <strong className="text-foreground">We never claim a refund arrived.</strong> A refund is
            recorded only when you confirm it. A pending refund and an expected date are your notes, not
            a promise from the store.
          </li>
          <li>
            <strong className="text-foreground">A reminder is not a guarantee.</strong> Email can be
            delayed, filtered, or lost, and the app can be unavailable. Check your deadlines yourself
            when the outcome matters.
          </li>
        </ul>
      </Section>

      <Section title="Your account">
        <p className="text-sm text-muted">
          You must provide an email address you control, keep your password confidential, and verify
          your email before reminders are delivered. You are responsible for activity under your
          account. Tell us promptly if you believe someone else has access to it.
        </p>
        <p className="text-sm text-muted">
          You must be old enough to form a binding contract in your jurisdiction, and at least 16 years
          old.
        </p>
      </Section>

      <Section title="Your content">
        <p className="text-sm text-muted">
          The purchases, notes, and files you add remain yours. You give us permission to store and
          display them back to you, and to send them in the reminders and exports you request — nothing
          more. You are responsible for having the right to upload what you upload, and for not
          including other people&apos;s sensitive information without their permission.
        </p>
        <p className="text-sm text-muted">
          Do not use the app to store payment card numbers, government identifiers, or passwords in a
          notes field. It is not designed or secured for that.
        </p>
      </Section>

      <Section title="Acceptable use">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Do not attempt to access another person&apos;s account or data.</li>
          <li>Do not probe, scan, or overload the service, or work around its rate limits.</li>
          <li>Do not upload malware, or files that are not the receipt or proof they claim to be.</li>
          <li>Do not use the service to break the law or to harass anyone.</li>
          <li>Do not resell or rebrand the service without permission.</li>
        </ul>
      </Section>

      <Section title="Our content">
        <p className="text-sm text-muted">
          The app&apos;s interface, text, and code are ours or used with permission. You may not copy or
          redistribute them except as the law allows. Your own data is covered by the section above, not
          this one.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p className="text-sm text-muted">
          The service is provided as-is. We may change, pause, or discontinue features, and we may
          perform maintenance that makes the app briefly unavailable. If we plan to shut the service
          down, we will give you a reasonable chance to export your data first.
        </p>
      </Section>

      <Section title="Ending your use">
        <p className="text-sm text-muted">
          You can stop using the service and delete your account at any time from{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Settings
          </Link>
          . We may suspend or close an account that seriously or repeatedly breaks these terms, or where
          we are required to by law. Where practical, we will tell you why and give you a chance to
          export your data.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p className="text-sm text-muted">
          To the extent the law allows, the service is provided without warranties of any kind,
          including fitness for a particular purpose and uninterrupted or error-free operation. We do
          not warrant that a reminder will be delivered on time, that a deadline you entered is correct,
          or that a return or refund will succeed. Nothing here limits rights you have under mandatory
          consumer law in your jurisdiction.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p className="text-sm text-muted">
          To the extent the law allows, we are not liable for indirect or consequential losses, or for
          lost profits, arising from your use of the service — including a missed return window or an
          unconfirmed refund. Where liability cannot be excluded, it is limited to the amount you paid
          us in the twelve months before the claim, or to the minimum the law requires if greater. This
          does not exclude liability for fraud or for anything else that cannot lawfully be excluded.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p className="text-sm text-muted">
          If these terms change materially, we will update this page and the date at the top. If you
          keep using the app after a change, you accept the updated terms. If you do not agree, you can
          export your data and delete your account.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-sm text-muted">
          Questions about these terms, or about {COMPANY_NAME}: email{" "}
          <a className="font-medium text-foreground underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          or use the{" "}
          <Link href="/contact" className="underline underline-offset-2">
            contact page
          </Link>
          . The{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            privacy page
          </Link>{" "}
          explains what data the app stores.
        </p>
      </Section>
    </article>
  );
}
