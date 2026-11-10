import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in — Return Tracker" };

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.emailVerifiedAt ? "/dashboard" : "/verify-email");

  return (
    <Card padding="lg" className="animate-fade-up">
      <PageHeader eyebrow="Welcome back" title="Sign in" subtitle="Pick up where you left off." />
      <div className="mt-6">
        <SignInForm />
      </div>
    </Card>
  );
}
