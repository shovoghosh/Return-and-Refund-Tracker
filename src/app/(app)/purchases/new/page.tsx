import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { localDateISO } from "@/lib/status";
import { PageHeader } from "@/components/ui";
import { PurchaseForm } from "../_components/purchase-form";

export const metadata: Metadata = { title: "Add purchase — Return Tracker" };

/**
 * Add purchase. Requires a signed-in user; the four required fields are enforced
 * server-side by createPurchaseSchema, and the reminder schedule is previewed in
 * the user's own time zone before saving.
 */
export default async function NewPurchasePage() {
  const user = await requireUser();
  const todayISO = localDateISO(new Date(), user.timezone);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Add purchase"
        subtitle="Four fields are required. Everything else can wait until later."
        action={
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← Back
          </Link>
        }
      />
      <PurchaseForm
        mode="create"
        timezone={user.timezone}
        reminderOffsets={user.reminderOffsets}
        reminderHour={user.reminderHour}
        todayISO={todayISO}
        cancelHref="/dashboard"
      />
    </div>
  );
}