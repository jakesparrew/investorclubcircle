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
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_LOGIN !== "true") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "gaetanjansseune@gmail.com";

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return new Response(`Geen gebruiker met e-mail ${email}. Draai eerst: npm run db:seed`, {
      status: 404,
    });
  }

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { sessionToken, userId: user.id, expires } });

  const store = await cookies();
  store.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
