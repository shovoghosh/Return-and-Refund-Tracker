import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./auth";

/**
 * Server-side gate for every authenticated page and action. Redirecting (rather
 * than returning null) keeps page code linear and makes an unauthenticated hit
 * impossible to accidentally render.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireVerifiedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) redirect("/verify-email");
  return user;
}

/** For route handlers: throws a 401 Response instead of redirecting. */
export async function requireUserApi(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Not signed in" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}
