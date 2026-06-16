import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Referral capture: store the code in a cookie, then send the visitor to the landing page. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const store = await cookies();
  store.set("ic_ref", code, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return NextResponse.redirect(new URL("/", req.url));
}
