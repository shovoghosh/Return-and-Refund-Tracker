import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Card, IconTile, PageHeader } from "@/components/ui";
import { VerifyEmailForm } from "@/components/auth/verify-email-forms";

export const metadata: Metadata = { title: "Confirming your email — Return Tracker" };

/**
 * The confirmation target from the verification email. It renders a button
 * rather than confirming on load, so a link prefetcher or email scanner cannot
 * consume the one-time token.
 */
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card padding="lg" className="animate-fade-up">
      <IconTile tone="moss" size="lg">
        <MailCheck />
      </IconTile>
      <div className="mt-4">
        <PageHeader
          eyebrow="Almost there"
          title="Confirm your email"
          subtitle="One tap and reminders are ready."
        />
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {token ? (
          <VerifyEmailForm token={token} />
        ) : (
          <p className="text-sm text-muted">
            This link is missing its token. Request a new one from{" "}
            <Link className="font-medium text-accent underline-offset-4 hover:underline" href="/verify-email">
              the verification page
            </Link>
            .
          </p>
        )}
      </div>
    </Card>
  );
}
