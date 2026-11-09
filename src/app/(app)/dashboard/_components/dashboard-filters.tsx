import Link from "next/link";
import { Button, Field, Input, Select } from "@/components/ui";

/**
 * Dashboard search / filter / sort controls.
 *
 * These are a plain GET form bound to the page's URL search params
 * (?q=&status=&sort=&archived=) so they work with no client-side state, survive
 * refresh and back/forward, and remain fully keyboard operable.
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Search" htmlFor="f-q" hint="Item, store, or order number">
          <Input
            id="f-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="e.g. headphones, Acme, A-10293"
          />
        </Field>

        <Field label="Status" htmlFor="f-status">
          <Select id="f-status" name="status" defaultValue={status}>
            <option value="ALL">All statuses</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sort by" htmlFor="f-sort">
          <Select id="f-sort" name="sort" defaultValue={sort}>
            <option value="deadline">Nearest return deadline</option>
            <option value="newest">Newest purchase</option>
          </Select>
        </Field>

        <div className="flex items-end">
          <div className="flex w-full items-center gap-2">
            <input
              id="f-archived"
              name="archived"
              type="checkbox"
              value="1"
              defaultChecked={archived}
              className="size-5 rounded border-border"
            />
            <label htmlFor="f-archived" className="text-sm">
              Include archived
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Apply</Button>
        {hasFilters ? (
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-2 hover:text-foreground"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}