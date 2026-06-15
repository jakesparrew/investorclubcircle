import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import type { Role } from "@/lib/access";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // The magic-link (Resend) provider requires database sessions + an adapter.
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  providers: [
    Google, // reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
    Resend({
      // reads AUTH_RESEND_KEY
      from: process.env.EMAIL_FROM ?? "InvestorClub <noreply@investorclub.be>",
    }),
  ],
  callbacks: {
    // Database strategy: `user` is the AdapterUser row — copy id + role onto the session.
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: Role }).role ?? "MEMBER";
      }
      return session;
    },
  },
});
