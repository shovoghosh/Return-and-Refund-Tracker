import { FileJson, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { Card, IconTile, PageHeader, buttonStyles } from "@/components/ui";

/**
 * Data export page. The two download links hit the authenticated route handler,
 * which reads the owner from the session — so a downloaded file never contains
 * anyone else's data.
 */
export default async function ExportPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your data"
        title="Export everything"
        subtitle={`Downloads are generated for ${user.email} only — never emailed, never shared.`}
      />

      <Card padding="lg" className="relative overflow-hidden">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-moss/10 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <IconTile tone="moss" size="lg">
            <FileSpreadsheet />
          </IconTile>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em]">Download a copy</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Choose CSV for spreadsheets, or JSON if you plan to move the data into another tool. The
              download starts immediately and is never emailed.
            </p>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2.5">
          <a href="/api/export?format=csv" className={buttonStyles({})}>
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            Download CSV
          </a>
          <a href="/api/export?format=json" className={buttonStyles({ variant: "secondary" })}>
            <FileJson className="size-4" aria-hidden="true" />
            Download JSON
          </a>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card padding="lg">
          <div className="flex items-center gap-2.5">
            <IconTile tone="sky" size="sm">
              <FileSpreadsheet />
            </IconTile>
            <h2 className="text-base font-semibold tracking-[-0.01em]">What is included</h2>
          </div>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
            <li>Every purchase you added: item name, store, order number, purchase date, and return deadline.</li>
            <li>The current status of each item, and its amount and currency if you entered them.</li>
            <li>Return details you recorded: return date, carrier, tracking number, expected and actual refund amounts and dates, and refund-received time.</li>
            <li>Your notes, item links, attachment counts, and creation time.</li>
          </ul>
        </Card>

        <Card padding="lg" tone="moss">
          <div className="flex items-center gap-2.5">
            <IconTile tone="moss" size="sm">
              <ShieldCheck />
            </IconTile>
            <h2 className="text-base font-semibold tracking-[-0.01em]">What is never included</h2>
          </div>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
            <li>Another account&apos;s purchases, returns, or reminders — ever.</li>
            <li>Your password, session tokens, or email-verification tokens.</li>
            <li>Anything from a bank, card, or email inbox. The app never connects to those.</li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            The export is compiled on the server from the rows you own and is swept from request to
            response in one go.
          </p>
        </Card>
      </div>
    </div>
  );
}
