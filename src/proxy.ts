// Next.js 16: middleware is renamed to `proxy` (Node.js runtime only).
// Gates /dashboard and /admin. Fine-grained tier/role checks happen server-side
// in the pages/actions via canAccess(); this is the coarse auth gate.
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;

  if (!isLoggedIn) {
    const login = new URL("/login", nextUrl);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  if (path.startsWith("/admin") && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
