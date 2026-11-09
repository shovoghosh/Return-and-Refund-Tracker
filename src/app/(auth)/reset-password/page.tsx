import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
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
      <Card>
        <PageHeader title="Choose a new password" subtitle="This link works once and expires in one hour." />
        <div className="mt-5">
          <ResetPasswordForm token={token} />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <PageHeader title="Reset your password" subtitle="We will email you a secure link." />
      <div className="mt-5">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-sm text-muted">
        <Link className="font-medium text-accent underline" href="/sign-in">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
