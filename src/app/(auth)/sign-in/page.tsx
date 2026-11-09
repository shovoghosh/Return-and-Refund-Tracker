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
    <Card>
      <PageHeader title="Sign in" subtitle="Welcome back." />
      <div className="mt-5">
        <SignInForm />
      </div>
    </Card>
  );
}
