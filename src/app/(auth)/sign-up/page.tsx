import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your account — Return Tracker" };

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.emailVerifiedAt ? "/dashboard" : "/verify-email");

  return (
    <Card>
      <PageHeader
        title="Create your account"
        subtitle="Track purchases, catch return deadlines, and confirm refunds arrived."
      />
      <div className="mt-5">
        <SignUpForm />
      </div>
    </Card>
  );
}
