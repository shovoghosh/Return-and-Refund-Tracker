import { requireUserApi } from "@/lib/auth-guard";
import { exportUserData, toCsv } from "@/lib/dal";
import { toUserMessage } from "@/lib/errors";
import { recordEvent } from "@/lib/dal/events";

/**
 * GET /api/export?format=csv|json
 *
 * Returns ONLY the signed-in user's rows. `exportUserData` takes userId from the
 * verified session (never from the request) and filters every query by it, so no
 * other account's data can appear in the file.
 */
export async function GET(request: Request): Promise<Response> {
  let userId: string;
  try {
    const user = await requireUserApi();
    userId = user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: toUserMessage(err) }, { status: 500 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  if (format !== "csv" && format !== "json") {
    return Response.json({ error: "Unsupported format. Use ?format=csv or ?format=json." }, { status: 400 });
  }

  let data: Awaited<ReturnType<typeof exportUserData>>;
  try {
    data = await exportUserData(userId);
  } catch (err) {
    return Response.json({ error: toUserMessage(err) }, { status: 500 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const commonHeaders = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };

  // Audit: one DATA_EXPORTED event per exported item, scoped to the item so the
  // event table stays item-oriented even when the export covers many rows.
  await Promise.all(
    data.items.map((row) =>
      recordEvent({
        userId,
        itemId: row.item_id,
        eventType: "DATA_EXPORTED",
        metadata: { format },
      }),
    ),
  );

  if (format === "csv") {
    return new Response(toCsv(data.items), {
      headers: {
        ...commonHeaders,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="return-tracker-export-${stamp}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      ...commonHeaders,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="return-tracker-export-${stamp}.json"`,
    },
  });
}