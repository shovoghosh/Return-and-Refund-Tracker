import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { buildDashboardSections, listPurchases, type PurchaseListItem } from "@/lib/dal";
import { STATUS_LABELS, formatDeadline, type ItemDisplayStatus, type ItemStatus } from "@/lib/status";
import { Button, Card, EmptyState, Notice, PageHeader } from "@/components/ui";
import { DashboardFilters, type StatusOption } from "./_components/dashboard-filters";
import { PurchaseRow, formatMoney } from "./_components/purchase-row";

function SummaryStat({
  label,
  value,
  detail,
  tone = "plain",
}: {
  label: string;
  value: number;
  detail?: string;
  tone?: "plain" | "warn";
}) {
  return (
    <div
      className={
        tone === "warn"
          ? "rounded-xl border border-warn-border bg-warn-bg p-3 sm:p-4"
          : "rounded-xl border border-border bg-surface p-3 sm:p-4"
      }
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

const STATUS_FILTER_OPTIONS: StatusOption[] = (
  ["OPEN", "RETURN_STARTED", "RETURNED", "REFUND_PENDING", "REFUND_RECEIVED", "KEPT"] as ItemStatus[]
).map((value) => ({ value, label: STATUS_LABELS[value as ItemDisplayStatus] }));

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function Section({
  id,
  title,
  hint,
  items,
  timezone,
  emptyTitle,
  emptyBody,
  showRefund = false,
}: {
  id: string;
  title: string;
  hint?: string;
  items: PurchaseListItem[];
  timezone: string;
  emptyTitle: string;
  emptyBody: string;
  showRefund?: boolean;
}) {
  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-4 sm:px-5">
        <h2 id={id} className="text-base font-semibold">
          {title}{" "}
          <span className="text-sm font-normal text-muted">({items.length})</span>
        </h2>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="px-2 py-2 sm:px-3">
        {items.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            body={emptyBody}
            action={
              <Link href="/purchases/new">
                <Button variant="secondary">Add purchase</Button>
              </Link>
            }
          />
        ) : (
          <ul aria-labelledby={id}>
            {items.map((item) => (
              <PurchaseRow key={item.id} item={item} timezone={timezone} showRefund={showRefund} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const q = first(sp.q).trim();
  const statusRaw = first(sp.status) || "ALL";
  const sortRaw = first(sp.sort) === "newest" ? "newest" : "deadline";
  const archived = ["1", "true", "on"].includes(first(sp.archived).toLowerCase());

  const statusValid = statusRaw === "ALL" || STATUS_FILTER_OPTIONS.some((o) => o.value === statusRaw);
  const status: ItemStatus | "ALL" = statusValid ? (statusRaw as ItemStatus | "ALL") : "ALL";

  const items = await listPurchases(user.id, user.timezone, {
    search: q || undefined,
    status,
    sort: sortRaw,
    includeArchived: archived,
    limit: 500,
  });

  const sections = buildDashboardSections(items);
  const today = sections.deadlineToday;

  const hasAnyData = items.length > 0;
  const filtering = Boolean(q) || status !== "ALL" || sortRaw === "newest" || archived;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Return deadlines are shown in your time zone (${user.timezone}).`}
        action={
          <Link href="/purchases/new">
            <Button>Add purchase</Button>
          </Link>
        }
      />

      {today.length > 0 ? (
        <div role="alert" className="rounded-xl border border-warn-border bg-warn-bg p-4">
          <p className="text-sm font-semibold">
            {today.length === 1
              ? "One return deadline is today."
              : `${today.length} return deadlines are today.`}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {today.map((item) => (
              <li key={item.id}>
                <Link href={`/purchases/${item.id}`} className="underline underline-offset-2">
                  <span className="font-medium">{item.name}</span>
                </Link>{" "}
                from {item.storeName} is due{" "}
                <span className="font-medium">{formatDeadline(item.returnDeadline, user.timezone)}</span>.
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Today is the last full local day to start a return. Check the store&apos;s own
            instructions <em>before midnight</em>, because many stores use their own cutoff time —
            this app does not guarantee that a store accepts returns until midnight.
          </p>
        </div>
      ) : null}

      <section aria-label="Summary" className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryStat label="Needs attention" value={sections.needsAttention.length} tone={sections.needsAttention.length > 0 ? "warn" : "plain"} />
        <SummaryStat
          label="Due in 7 days"
          value={sections.upcoming.filter((i) => i.daysRemaining <= 7).length}
        />
        <SummaryStat
          label="Refunds pending"
          value={sections.refundsPending.length}
          detail={(() => {
            const total = sections.refundsPending.reduce((sum, i) => sum + (i.expectedRefundCents ?? 0), 0);
            return total > 0 ? `${formatMoney(total, sections.refundsPending[0]?.currency ?? null)} expected` : undefined;
          })()}
        />
      </section>

      <section aria-label="Search and filters" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <DashboardFilters q={q} status={status} sort={sortRaw} archived={archived} statusOptions={STATUS_FILTER_OPTIONS} />
      </section>

      {!hasAnyData ? (
        <EmptyState
          title={filtering ? "No purchases match your filters" : "No purchases yet"}
          body={
            filtering
              ? "Try a different search term, status, or clear the filters."
              : "Add your first purchase and we will track its return deadline for you."
          }
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/purchases/new">
                <Button>Add purchase</Button>
              </Link>
              {filtering ? (
                <Link href="/dashboard">
                  <Button variant="secondary">Clear filters</Button>
                </Link>
              ) : null}
            </div>
          }
        />
      ) : (
        <>
          <Section
            id="needs-attention"
            title="Needs attention"
            hint="Past the deadline, or a refund you are waiting on."
            items={sections.needsAttention}
            timezone={user.timezone}
            emptyTitle="Nothing needs your attention"
            emptyBody="No overdue items and no refunds waiting. Good place to be."
          />

          <Section
            id="upcoming"
            title="Upcoming deadlines"
            hint="Soonest first."
            items={sections.upcoming}
            timezone={user.timezone}
            emptyTitle="No upcoming deadlines"
            emptyBody="You have no open items with a deadline ahead."
          />

          <Section
            id="refunds-pending"
            title="Refunds pending"
            hint="Money you have not confirmed receiving yet."
            items={sections.refundsPending}
            timezone={user.timezone}
            emptyTitle="No refunds pending"
            emptyBody="When you mark an item as refund pending it appears here until you confirm it arrived."
            showRefund
          />

          <Card className="p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-4 sm:px-5">
              <h2 id="all-purchases" className="text-base font-semibold">
                All purchases <span className="text-sm font-normal text-muted">({sections.all.length})</span>
              </h2>
              {archived ? <p className="text-xs text-muted">Archived items included.</p> : null}
            </div>
            <div className="overflow-x-auto px-4 pb-4 sm:px-5">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <caption className="sr-only">
                  All of your purchases with return deadline, days remaining, and status.
                </caption>
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">Item</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Store</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Return by</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Time left</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.all.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-b-0">
                      <td className="py-2 pr-3">
                        <Link href={`/purchases/${item.id}`} className="font-medium underline-offset-2 hover:underline">
                          {item.name}
                        </Link>
                        {item.archivedAt ? (
                          <span className="ml-2 text-xs text-muted">(archived)</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-muted">{item.storeName}</td>
                      <td className="py-2 pr-3">{formatDeadline(item.returnDeadline, user.timezone)}</td>
                      <td className="py-2 pr-3 text-muted">
                        {item.daysRemaining === 0
                          ? "Due today"
                          : item.daysRemaining > 0
                            ? `${item.daysRemaining} days`
                            : `${Math.abs(item.daysRemaining)} past`}
                      </td>
                      <td className="py-2 pr-3">{STATUS_LABELS[item.displayStatus]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Notice tone="info">
            Return deadlines and expected refund dates are different things. A return deadline is
            when the store must receive or accept the item back; an expected refund date is your own
            reminder to check whether the money has arrived.{" "}
            <Link href="/notifications" className="underline underline-offset-2">
              View reminder delivery
            </Link>
            .
          </Notice>
        </>
      )}
    </div>
  );
}