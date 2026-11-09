import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
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
    <Card>
      <PageHeader title="Confirm your email" subtitle="One tap and reminders are ready." />
      <div className="mt-5 flex flex-col gap-4">
        {token ? (
          <VerifyEmailForm token={token} />
        ) : (
          <p className="text-sm text-muted">
            This link is missing its token. Request a new one from{" "}
            <Link className="font-medium text-accent underline" href="/verify-email">
              the verification page
            </Link>
            .
          </p>
        )}
      </div>
    </Card>
  );
}
