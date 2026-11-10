import Link from "next/link";
import { DateTime } from "luxon";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Package,
  Plus,
  Sparkles,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { buildDashboardSections, listPurchases, type PurchaseListItem } from "@/lib/dal";
import { STATUS_LABELS, formatDeadline, type ItemDisplayStatus, type ItemStatus } from "@/lib/status";
import {
  Button,
  Card,
  EmptyState,
  LinkButton,
  Notice,
  PageHeader,
  SectionHeading,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { DashboardFilters, type StatusOption } from "./_components/dashboard-filters";
import { PurchaseRow, formatMoney } from "./_components/purchase-row";

const STATUS_FILTER_OPTIONS: StatusOption[] = (
  ["OPEN", "RETURN_STARTED", "RETURNED", "REFUND_PENDING", "REFUND_RECEIVED", "KEPT"] as ItemStatus[]
).map((value) => ({ value, label: STATUS_LABELS[value as ItemDisplayStatus] }));

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function displayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  const words = local.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return local;
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function Section({
  id,
  title,
  hint,
  items,
  timezone,
  emptyTitle,
  emptyBody,
  icon,
  showRefund = false,
}: {
  id: string;
  title: string;
  hint?: string;
  items: PurchaseListItem[];
  timezone: string;
  emptyTitle: string;
  emptyBody: string;
  icon: React.ReactNode;
  showRefund?: boolean;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-border/70 px-4 py-4 sm:px-5">
        <SectionHeading id={id} title={title} hint={hint} icon={icon} count={items.length} />
      </div>
      <div className="p-1.5 sm:p-2">
        {items.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            body={emptyBody}
            icon={icon}
            action={
              <Link href="/purchases/new">
                <Button variant="secondary" size="sm">
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add purchase
                </Button>
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

  const now = new Date();
  const localNow = DateTime.fromJSDate(now, { zone: "utc" }).setZone(user.timezone);
  const hour = localNow.hour;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = displayName(user.email);
  const dateLabel = localNow.toFormat("cccc, LLLL d");
  const dueThisWeek = sections.upcoming.filter((item) => item.daysRemaining <= 7).length;
  const overdueCount = sections.needsAttention.filter((item) => item.displayStatus === "EXPIRED").length;
  const refundTotal = sections.refundsPending.reduce(
    (sum, item) => sum + (item.expectedRefundCents ?? 0),
    0,
  );
  const refundCurrencies = new Set(
    sections.refundsPending
      .filter((item) => item.expectedRefundCents !== null)
      .map((item) => item.currency ?? "USD"),
  );
  // Only show one combined amount when every pending refund uses the same
  // currency. Mixing currencies into one number would be a lie.
  const refundMoney =
    refundTotal > 0 && refundCurrencies.size === 1
      ? formatMoney(refundTotal, [...refundCurrencies][0] ?? null)
      : null;

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <PageHeader
        eyebrow="Your workspace"
        title={
          <>
            {greeting}, <span className="serif-italic text-gradient">{name}.</span>
          </>
        }
        subtitle={`${dateLabel} · Deadlines in ${user.timezone}`}
      />

      {today.length > 0 ? (
        <div
          role="alert"
          className="animate-fade-up relative overflow-hidden rounded-2xl border border-warn-border bg-warn-bg p-4 sm:p-5"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-warn/10 blur-2xl"
          />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-warn-border bg-warn/10 text-warn">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {today.length === 1
                  ? "One return deadline is today."
                  : `${today.length} return deadlines are today.`}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground-soft">
                {today.map((item) => (
                  <li key={item.id}>
                    <Link href={`/purchases/${item.id}`} className="font-medium underline decoration-warn/40 underline-offset-2 hover:decoration-warn">
                      {item.name}
                    </Link>{" "}
                    from {item.storeName} is due{" "}
                    <span className="font-medium">{formatDeadline(item.returnDeadline, user.timezone)}</span>.
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 max-w-2xl text-[0.72rem] leading-relaxed text-muted">
                Today is the last full local day to start a return. Check the store&apos;s own
                instructions before midnight — this app does not guarantee a store accepts returns
                until midnight.
              </p>
            </div>
            <LinkButton href={`/purchases/${today[0].id}`} variant="secondary" size="sm" className="shrink-0">
              Review item
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </LinkButton>
          </div>
        </div>
      ) : null}

      {!hasAnyData ? (
        <Card padding="lg" className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative mx-auto max-w-lg py-4 text-center sm:py-8">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-accent/20 bg-accent-soft text-accent">
              <Sparkles className="size-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-[-0.035em]">
              {filtering ? "No purchases match those filters." : "A fresh, empty drawer."}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              {filtering
                ? "Try a different search term or status, or clear the filters to see everything again."
                : "Add your first purchase and we will keep the return deadline in view — 7, 2, and 1 day before it arrives."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <LinkButton href="/purchases/new">
                <Plus className="size-4" aria-hidden="true" />
                Add your first purchase
              </LinkButton>
              {filtering ? (
                <LinkButton href="/dashboard" variant="secondary">
                  Clear filters
                </LinkButton>
              ) : null}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <StatCard
              index={0}
              label="Needs attention"
              value={sections.needsAttention.length}
              detail={
                overdueCount > 0
                  ? `${overdueCount} past deadline${sections.refundsPending.length > 0 ? ` · ${sections.refundsPending.length} refund${sections.refundsPending.length === 1 ? "" : "s"} waiting` : ""}`
                  : sections.refundsPending.length > 0
                    ? `${sections.refundsPending.length} refund${sections.refundsPending.length === 1 ? "" : "s"} waiting`
                    : "Nothing overdue right now"
              }
              icon={<TriangleAlert />}
              tone="warn"
              href="#needs-attention"
            />
            <StatCard
              index={1}
              label="Due in 7 days"
              value={dueThisWeek}
              detail={sections.upcoming[0]?.name ? `Next: ${sections.upcoming[0].name}` : "The week is clear"}
              icon={<CalendarClock />}
              tone="sky"
              href="#upcoming"
            />
            <StatCard
              index={2}
              label="Refunds pending"
              value={sections.refundsPending.length}
              detail={
                refundMoney
                  ? `${refundMoney} expected`
                  : sections.refundsPending.length > 0
                    ? `${sections.refundsPending.length} waiting on a check-in`
                    : "No money in limbo"
              }
              icon={<Wallet />}
              tone="moss"
              href="#refunds-pending"
            />
            <StatCard
              index={3}
              label="Items tracked"
              value={sections.all.length}
              detail={archived ? "Archived included" : "Active purchases"}
              icon={<Package />}
              tone="accent"
              href="#all-purchases"
            />
          </section>

          <Card padding="sm" className="animate-fade-up">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-accent" aria-hidden="true" />
                <p className="text-sm font-semibold">Find a purchase</p>
              </div>
              <p className="text-[0.7rem] text-muted">
                {filtering ? "Filters are active" : "Search, filter, or sort the list"}
              </p>
            </div>
            <DashboardFilters q={q} status={status} sort={sortRaw} archived={archived} statusOptions={STATUS_FILTER_OPTIONS} />
          </Card>

          <Section
            id="needs-attention"
            title="Needs attention"
            hint="Past the deadline, or a refund you are waiting on."
            items={sections.needsAttention}
            timezone={user.timezone}
            emptyTitle="Nothing needs your attention"
            emptyBody="No overdue items and no refunds waiting. A very good place to be."
            icon={<TriangleAlert />}
          />

          <Section
            id="upcoming"
            title="Upcoming deadlines"
            hint="Soonest first."
            items={sections.upcoming}
            timezone={user.timezone}
            emptyTitle="No upcoming deadlines"
            emptyBody="You have no open items with a deadline ahead."
            icon={<CalendarClock />}
          />

          <Section
            id="refunds-pending"
            title="Refunds pending"
            hint="Money you have not confirmed receiving yet."
            items={sections.refundsPending}
            timezone={user.timezone}
            emptyTitle="No refunds pending"
            emptyBody="When you mark an item refund pending it appears here until you confirm it arrived."
            icon={<Wallet />}
            showRefund
          />

          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-border/70 px-4 py-4 sm:px-5">
              <SectionHeading
                id="all-purchases"
                title="All purchases"
                hint={archived ? "Archived items are included." : "Your complete return history."}
                icon={<Package />}
                count={sections.all.length}
                action={
                  <LinkButton href="/export" variant="ghost" size="sm">
                    Export
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </LinkButton>
                }
              />
            </div>
            <div className="overflow-x-auto px-4 pb-4 sm:px-5">
              <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
                <caption className="sr-only">
                  All of your purchases with return deadline, days remaining, and status.
                </caption>
                <thead>
                  <tr className="border-b border-border/70 text-[0.62rem] uppercase tracking-[0.13em] text-muted">
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Item</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Store</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Return by</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Time left</th>
                    <th scope="col" className="py-2.5 pr-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.all.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-2/60"
                    >
                      <td className="py-3 pr-3">
                        <Link
                          href={`/purchases/${item.id}`}
                          className="font-medium underline-offset-2 group-hover:text-accent group-hover:underline"
                        >
                          {item.name}
                        </Link>
                        {item.archivedAt ? (
                          <span className="ml-2 text-[0.65rem] text-muted">(archived)</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 text-muted">{item.storeName}</td>
                      <td className="py-3 pr-3 text-foreground-soft">{formatDeadline(item.returnDeadline, user.timezone)}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={
                            item.displayStatus === "EXPIRED"
                              ? "font-medium text-danger"
                              : item.daysRemaining === 0
                                ? "font-medium text-warn"
                                : "text-muted"
                          }
                        >
                          {item.daysRemaining === 0
                            ? "Due today"
                            : item.daysRemaining > 0
                              ? `${item.daysRemaining} days`
                              : `${Math.abs(item.daysRemaining)} past`}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={item.displayStatus} label={STATUS_LABELS[item.displayStatus]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Notice tone="info" title="Two very different dates">
            A return deadline is when the store must receive or accept the item back. An expected
            refund date is your own reminder to check whether the money arrived.{" "}
            <Link href="/notifications" className="font-medium text-accent underline underline-offset-2">
              View reminder delivery
            </Link>
            .
          </Notice>
        </>
      )}
    </div>
  );
}
