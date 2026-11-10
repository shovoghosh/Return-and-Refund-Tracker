import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Card, IconTile, PageHeader } from "@/components/ui";
import { ResendVerificationForm } from "@/components/auth/verify-email-forms";
import { requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = { title: "Confirm your email — Return Tracker" };

export default async function VerifyEmailPage() {
  const user = await requireUser();

  return (
    <Card padding="lg" className="animate-fade-up">
      <IconTile tone="accent" size="lg">
        <MailCheck />
      </IconTile>
      <div className="mt-4">
        <PageHeader
          eyebrow="One quick step"
          title="Confirm your email"
          subtitle={`We sent a verification link to ${user.email}. Reminders stay paused until you confirm it.`}
        />
      </div>
      <div className="mt-6 flex flex-col gap-4">
        <ResendVerificationForm />
        <p className="text-sm text-muted">
          Already confirmed?{" "}
          <Link className="font-medium text-accent underline-offset-4 hover:underline" href="/dashboard">
            Go to your dashboard
          </Link>
        </p>
      </div>
    </Card>
  );
}
