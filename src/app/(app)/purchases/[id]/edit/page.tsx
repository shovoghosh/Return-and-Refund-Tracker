import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getPurchase } from "@/lib/dal";
import { LinkButton, PageHeader } from "@/components/ui";
import { PurchaseForm } from "../../_components/purchase-form";

export const metadata: Metadata = { title: "Edit purchase — Return Tracker" };

/**
 * Edit purchase. The purchase date is shown read-only because the shared update
 * schema does not accept a change to it; everything else stays editable, even an
 * expired item (Expired is a display state, never a locked status).
 */
export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const item = await getPurchase(user.id, id, user.timezone);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Edit purchase"
        title={item.name}
        subtitle="Corrections are welcome. The return deadline is whatever the store told you."
        action={
          <LinkButton href={`/purchases/${item.id}`} variant="ghost" size="sm">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to purchase
          </LinkButton>
        }
      />
      <PurchaseForm
        mode="edit"
        itemId={item.id}
        timezone={user.timezone}
        reminderOffsets={user.reminderOffsets}
        reminderHour={user.reminderHour}
        todayISO={item.purchaseDate}
        cancelHref={`/purchases/${item.id}`}
        defaults={{
          name: item.name,
          storeName: item.storeName,
          purchaseDate: item.purchaseDate,
          returnDeadline: item.returnDeadline,
          orderNumber: item.orderNumber ?? "",
          amountCents: item.amountCents,
          currency: item.currency,
          itemUrl: item.itemUrl,
          notes: item.notes,
          archived: Boolean(item.archivedAt),
        }}
      />
    </div>
  );
}
