import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button, Select } from "@/components/ui";

/**
 * Dashboard search / filter / sort controls.
 *
 * A plain GET form bound to the page's URL search params
 * (?q=&status=&sort=&archived=) so it works with no client-side state, survives
 * refresh and back/forward, and remains fully keyboard operable.
 */

export type StatusOption = { value: string; label: string };

export function DashboardFilters({
  q,
  status,
  sort,
  archived,
  statusOptions,
}: {
  q: string;
  status: string;
  sort: string;
  archived: boolean;
  statusOptions: StatusOption[];
}) {
  const hasFilters = Boolean(q) || status !== "ALL" || sort !== "deadline" || archived;

  return (
    <form method="get" action="/dashboard" className="flex flex-col gap-3" role="search">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_auto]">
        <div className="relative">
          <label htmlFor="f-q" className="sr-only">
            Search purchases
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <input
            id="f-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search item, store, or order number…"
            className="field-input min-h-11 pl-10"
          />
        </div>

        <div>
          <label htmlFor="f-status" className="sr-only">
            Filter by status
          </label>
          <Select id="f-status" name="status" defaultValue={status} aria-label="Filter by status">
            <option value="ALL">All statuses</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="f-sort" className="sr-only">
            Sort purchases
          </label>
          <Select id="f-sort" name="sort" defaultValue={sort} aria-label="Sort purchases">
            <option value="deadline">Nearest deadline</option>
            <option value="newest">Newest purchase</option>
          </Select>
        </div>

        <Button type="submit" className="w-full lg:w-auto">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Apply
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2.5 text-xs font-medium text-muted">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} className="peer sr-only" />
          <span
            aria-hidden="true"
            className="relative h-5 w-9 rounded-full border border-border bg-surface-3 transition-colors duration-200 peer-checked:border-accent/30 peer-checked:bg-accent peer-checked:[&>span]:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
          >
            <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-surface shadow-sm transition-transform duration-200" />
          </span>
          Include archived
        </label>

        {hasFilters ? (
          <Link
            href="/dashboard"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear filters
          </Link>
        ) : (
          <p className="text-[0.68rem] text-muted">Filters stay in the URL — refresh safe.</p>
        )}
      </div>
    </form>
  );
}
