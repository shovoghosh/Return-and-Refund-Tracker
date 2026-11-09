import { requireUser } from "@/lib/auth-guard";
import { Button, Card, PageHeader } from "@/components/ui";

/**
 * Data export page. The two buttons hit the authenticated route handler, which
 * reads the owner from the session — so a downloaded file never contains anyone
 * else's data.
 */
export default async function ExportPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Export your data"
        subtitle={`Downloads are generated for ${user.email} only.`}
      />

      <Card>
        <h2 className="text-base font-semibold">Download a copy</h2>
        <p className="mt-1 text-sm text-muted">
          Choose CSV for spreadsheets, or JSON if you plan to move the data into another tool. The
          download starts immediately and is never emailed.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/api/export?format=csv">
            <Button>Download CSV</Button>
          </a>
          <a href="/api/export?format=json">
            <Button variant="secondary">Download JSON</Button>
          </a>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">What is included</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Every purchase you added: item name, store, order number, purchase date, and return deadline.</li>
          <li>The current status of each item, and its amount and currency if you entered them.</li>
          <li>Return details you recorded: return date, carrier, tracking number, expected and actual refund amounts and dates, and refund-received time.</li>
          <li>Your notes, item links, attachment counts, and creation time.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">What is never included</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Another account&apos;s purchases, returns, or reminders — ever.</li>
          <li>Your password, session tokens, or email-verification tokens.</li>
          <li>Anything from a bank, card, or email inbox. The app never connects to those.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          The export is compiled on the server from the rows you own and is swept from request to
          response in one go.
        </p>
      </Card>
    </div>
  );
}