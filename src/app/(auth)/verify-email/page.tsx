import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { ResendVerificationForm } from "@/components/auth/verify-email-forms";
import { requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Confirm your email — Return Tracker" };

export default async function VerifyEmailPage() {
  const user = await requireUser();

  return (
    <Card>
      <PageHeader
        title="Confirm your email"
        subtitle={`We sent a verification link to ${user.email}. Reminders stay paused until you confirm it.`}
      />
      <div className="mt-5 flex flex-col gap-4">
        <ResendVerificationForm />
        <p className="text-sm text-muted">
          Already confirmed?{" "}
          <Link className="font-medium text-accent underline" href="/dashboard">
            Go to your dashboard
          </Link>
        </p>
      </div>
    </Card>
  );
}
