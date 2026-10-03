import { z } from "zod";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = z
  .string()
  .regex(ISO_DATE, "Use the date format YYYY-MM-DD")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "That is not a real calendar date");

export const optionalIsoDate = z
  .union([isoDate, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const timezone = z.string().min(1).refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone");

export const email = z.string().trim().toLowerCase().email("Enter a valid email address");

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long");

/** Money is stored as integer minor units; never binary floating point. */
export const moneyCents = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) return Number.NaN;
    return Math.round(n * 100);
  })
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Enter a valid amount");

export const currency = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v ? v.toUpperCase() : null))
  .refine((v) => v === null || /^[A-Z]{3}$/.test(v), "Use a 3-letter currency code");

export const itemName = z.string().trim().min(1, "Item name is required").max(200);
export const storeName = z.string().trim().min(1, "Store name is required").max(200);
export const orderNumber = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))
  .refine((v) => v === null || v.length <= 100, "Order number is too long");
export const notes = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))
  .refine((v) => v === null || v.length <= 5000, "Notes are too long");
export const itemUrl = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null))
  .refine((v) => v === null || /^https?:\/\//.test(v), "Enter a full http(s) link");

export const reminderOffsets = z
  .array(z.number().int().min(0).max(7))
  .optional()
  .transform((v) => (v === undefined ? undefined : [...new Set(v)].sort((a, b) => b - a)));

export const reminderHour = z.number().int().min(0).max(23);

/** Create-purchase payload. Four required fields, everything else optional. */
export const createPurchaseSchema = z
  .object({
    name: itemName,
    storeName,
    purchaseDate: isoDate,
    returnDeadline: isoDate,
    orderNumber,
    amount: moneyCents,
    currency,
    itemUrl,
    notes,
    /** When the user accepts a deadline that precedes the purchase date. */
    confirmExceptionalDeadline: z.boolean().optional().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.returnDeadline < val.purchaseDate && !val.confirmExceptionalDeadline) {
      ctx.addIssue({
        code: "custom",
        path: ["returnDeadline"],
        message: "The return deadline is before the purchase date. Confirm this is intentional.",
      });
    }
  });

export type CreatePurchaseInput = z.input<typeof createPurchaseSchema>;
export type CreatePurchaseParsed = z.output<typeof createPurchaseSchema>;

export const updateItemSchema = z.object({
  name: itemName.optional(),
  storeName: storeName.optional(),
  orderNumber,
  amount: moneyCents,
  currency,
  itemUrl,
  notes,
  returnDeadline: isoDate.optional(),
  archived: z.boolean().optional(),
});

export const statusChangeSchema = z.object({
  status: z.enum([
    "OPEN",
    "RETURN_STARTED",
    "RETURNED",
    "REFUND_PENDING",
    "REFUND_RECEIVED",
    "KEPT",
  ]),
  confirm: z.boolean().optional().default(false),
  note: notes,
});

export const returnDetailsSchema = z.object({
  returnStartedAt: optionalIsoDate,
  returnedAt: optionalIsoDate,
  carrier: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  trackingNumber: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  expectedRefundAmount: moneyCents,
  expectedRefundDate: optionalIsoDate,
  actualRefundAmount: moneyCents,
  actualRefundDate: optionalIsoDate,
  notes,
});

export const settingsSchema = z.object({
  timezone,
  reminderOffsets,
  reminderHour: reminderHour.optional(),
  emailRemindersOn: z.boolean().optional(),
});

export const signUpSchema = z.object({
  email,
  password,
  timezone: timezone.optional(),
});

export const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password") });

/** Flattens a Zod error into field -> message for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Runs a schema and returns either data or flat field errors. */
export function parseWith<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): { ok: true; data: z.output<T> } | { ok: false; errors: Record<string, string> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, errors: fieldErrors(parsed.error) };
}
