import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Card, IconTile, PageHeader } from "@/components/ui";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset your password — Return Tracker" };

/**
 * Without a token this is the request form; with one it is the choose-a-new
 * password form. Keeping both on /reset-password means the emailed link works
 * even if the request step is retried.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (token) {
    return (
      <Card padding="lg" className="animate-fade-up">
        <IconTile tone="accent" size="lg">
          <KeyRound />
        </IconTile>
        <div className="mt-4">
          <PageHeader
            eyebrow="One-time link"
            title="Choose a new password"
            subtitle="This link works once and expires in one hour."
          />
        </div>
        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="animate-fade-up">
      <IconTile tone="accent" size="lg">
        <KeyRound />
      </IconTile>
      <div className="mt-4">
        <PageHeader
          eyebrow="Password help"
          title="Reset your password"
          subtitle="We will email you a secure link."
        />
      </div>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-sm text-muted">
        <Link className="font-medium text-accent underline-offset-4 hover:underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
