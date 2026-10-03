export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string>; formError?: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(errors: Record<string, string>, formError?: string): ActionResult<never> {
  return { ok: false, errors, formError };
}

/** Maps thrown Responses (401/403 from guards) and unknown errors to a message. */
export function toUserMessage(err: unknown): string {
  if (err instanceof Response) {
    if (err.status === 401) return "Your session expired. Sign in again.";
    if (err.status === 403) return "You do not have access to that.";
    return "Something went wrong. Try again.";
  }
  if (err instanceof Error) {
    if (process.env.NODE_ENV !== "production") return err.message;
    return "Something went wrong. Try again.";
  }
  return "Something went wrong. Try again.";
}
