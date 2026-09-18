import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * DEV-ONLY login bypass. Creates a real Auth.js database session for a seeded
 * user and sets the session cookie, so you can explore the app locally without
 * configuring Google/Resend. Disabled in production and unless ALLOW_DEV_LOGIN=true.
 *
 *   /api/dev-login                              -> log in as the admin
 *   /api/dev-login?email=sven@demo.investorclub.be -> log in as a demo member
 */
const DEMO_DOMAIN = "@demo.investorclub.be";

export async function GET(req: Request) {
  const prod = process.env.NODE_ENV === "production";
  // Local: any seeded user (ALLOW_DEV_LOGIN). Production: only seeded demo members, never
  // admins, and only when ALLOW_DEMO_LOGIN=true — the public demo site's "try it" login.
  const allowed = prod ? process.env.ALLOW_DEMO_LOGIN === "true" : process.env.ALLOW_DEV_LOGIN === "true";
  if (!allowed) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? (prod ? `lara${DEMO_DOMAIN}` : "gaetanjansseune@gmail.com");
  if (prod && !email.endsWith(DEMO_DOMAIN)) return new Response("Not found", { status: 404 });

  const user = await db.user.findUnique({ where: { email } });
  if (prod && user?.role === "ADMIN") return new Response("Not found", { status: 404 });
  if (!user) {
    return new Response(`Geen gebruiker met e-mail ${email}. Draai eerst: npm run db:seed`, {
      status: 404,
    });
  }

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { sessionToken, userId: user.id, expires } });

  const store = await cookies();
  // Auth.js uses the __Secure- prefixed cookie on https.
  const secure = url.protocol === "https:";
  store.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires,
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
