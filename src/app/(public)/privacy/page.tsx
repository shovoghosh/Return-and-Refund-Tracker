import type { Metadata } from "next";
import Link from "next/link";
import { getEnv } from "@/lib/env";
import { PageHeader } from "@/components/ui";

/** Rendered per request so SUPPORT_EMAIL reflects the deployment, like /contact. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy — Return Tracker",
  description:
    "What Return Tracker stores, why it stores it, who can see it, and how to export or delete it.",
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

function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{children}</ul>;
}

export default function PrivacyPage() {
  const { SUPPORT_EMAIL } = getEnv();

  return (
    <article className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Privacy"
        subtitle="A purchase history can reveal a lot about someone. Here is exactly what this app keeps, and what it does not."
      />

      <p className="text-xs text-muted">Last updated: {LAST_UPDATED}</p>

      <Section title="The short version">
        <List>
          <li>We store the purchases you type in, the reminder settings you choose, and your email address.</li>
          <li>We do not read your inbox, connect to your bank, or share your data with the stores you track.</li>
          <li>You can export everything as CSV or JSON, or delete your account and its files, from Settings at any time.</li>
        </List>
      </Section>

      <Section title="What we store">
        <p className="text-sm text-muted">
          We keep only what the product needs to work. If you never enter a field, it is empty rather
          than guessed.
        </p>
        <List>
          <li>
            <strong className="text-foreground">Account:</strong> your email address, a bcrypt hash of
            your password (never the password itself), whether your email is verified, your time zone,
            and your reminder preferences: which day offsets to use, the local hour reminders go out,
            and whether email reminders are on.
          </li>
          <li>
            <strong className="text-foreground">Purchases:</strong> item name, store name, order number,
            purchase date, return deadline, status, amount and currency, item URL, and notes you write.
          </li>
          <li>
            <strong className="text-foreground">Returns and refunds:</strong> the return start and
            handover dates, carrier, tracking number, expected and actual refund amounts and dates, and
            any notes you add.
          </li>
          <li>
            <strong className="text-foreground">Files you upload:</strong> a receipt or return-proof
            image or PDF, plus its original filename, content type, and size.
          </li>
          <li>
            <strong className="text-foreground">Activity:</strong> a history of status changes you
            made, and a log of reminder messages: when one was scheduled, when it was sent, and whether
            it failed.
          </li>
        </List>
      </Section>

      <Section title="What we do not collect">
        <List>
          <li>No inbox access, email forwarding, or automatic receipt scanning.</li>
          <li>No bank, card, or payment-provider connection.</li>
          <li>No analytics, advertising, or cross-site tracking scripts.</li>
          <li>No location data, contacts, or device identifiers.</li>
          <li>We ask for no information about the contents of a package beyond what you choose to type.</li>
        </List>
      </Section>

      <Section title="Cookies and sessions">
        <p className="text-sm text-muted">
          This app sets one cookie: a session cookie that keeps you signed in. It is httpOnly,
          SameSite=Lax, and does not contain your email or any purchase data — only an opaque token.
          The database stores a hash of that token, not the token itself, so a database leak does not
          hand out live sessions. We set no advertising or analytics cookies.
        </p>
      </Section>

      <Section title="Uploaded files">
        <p className="text-sm text-muted">
          Receipts and proof photos are stored privately. They are never served from a public URL: the
          browser fetches them through an authenticated route that checks the file belongs to your
          signed-in account before reading it. Content type is checked from the file&apos;s actual bytes,
          not just its extension.
        </p>
      </Section>

      <Section title="Emails we send">
        <p className="text-sm text-muted">
          Transactional messages only: email verification, password reset, and the return and refund
          reminders you configure. There is no marketing list and no newsletter. To keep purchase
          details out of inbox previews, reminder emails identify the item in the body rather than
          putting it in the subject line.
        </p>
      </Section>

      <Section title="Who can see your data">
        <p className="text-sm text-muted">
          Your rows are scoped to your account on every read and write, using the user id taken from
          your session cookie rather than anything the browser can send. No other account can list,
          edit, export, or download your purchases or files.
        </p>
        <p className="text-sm text-muted">
          We do not sell data and do not share it with the stores you track. The only third parties
          involved are infrastructure providers that host the app, the database, the file storage, and
          the email delivery — and they process the data solely to run those services for us. If the
          deployment enables error monitoring, that monitoring may receive technical error context, but
          not your purchase list.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p className="text-sm text-muted">
          We keep your data until you delete it. Deleting your account removes your profile, purchases,
          returns, uploaded files, events, and reminder history. Attachments are purged from file
          storage as part of that deletion, not left behind as orphans.
        </p>
        <p className="text-sm text-muted">
          Backups are the honest caveat: a deleted row can remain in a provider&apos;s backup rotation
          for a limited period before it ages out. We cannot promise that a backup taken before your
          deletion is rewritten, but it is not used to serve your data back to you and is not
          deliberately retained beyond that rotation.
        </p>
      </Section>

      <Section title="Your choices">
        <p className="text-sm text-muted">
          From{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Settings
          </Link>{" "}
          you can change your time zone and reminder schedule, turn email reminders off, export your
          purchases as CSV or JSON, and delete your account. If you are in a region with specific data
          rights, contact us and we will help you exercise them.
        </p>
      </Section>

      <Section title="Security">
        <p className="text-sm text-muted">
          Passwords are hashed with bcrypt. Sessions use random tokens stored only as hashes and
          expire. Verification and reset links are single-use and time-limited. Inputs are validated on
          the server, uploads are size- and type-limited, and sign-in, sign-up, and upload endpoints are
          rate-limited. No system is perfectly secure, so use a unique password and tell us promptly if
          you suspect a problem.
        </p>
      </Section>

      <Section title="Children">
        <p className="text-sm text-muted">
          This app is not directed at children and is not intended for anyone under 16. We do not
          knowingly collect data from children.
        </p>
      </Section>

      <Section title="Changes to this page">
        <p className="text-sm text-muted">
          If what we store or how we use it changes materially, we will update this page and change the
          date at the top. Continuing to use the app after a change means you accept the updated
          description.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-sm text-muted">
          Questions about privacy, or a request to access or delete your data: email{" "}
          <a className="font-medium text-foreground underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          , or use the{" "}
          <Link href="/contact" className="underline underline-offset-2">
            contact page
          </Link>
          . See also the{" "}
          <Link href="/terms" className="underline underline-offset-2">
            terms
          </Link>{" "}
          and the{" "}
          <Link href="/help" className="underline underline-offset-2">
            help page
          </Link>
          .
        </p>
      </Section>
    </article>
  );
}
