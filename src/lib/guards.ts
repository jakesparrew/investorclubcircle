import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Server-side admin guard for pages. Use IN ADDITION to the admin layout guard
 * (defense-in-depth): every admin page re-checks rather than trusting the layout.
 */
export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return session;
}

/** Only allow same-origin relative paths as a post-login redirect target. */
export function safeRedirectPath(raw: unknown, fallback = "/dashboard"): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}
