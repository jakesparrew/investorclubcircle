import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { AppShell } from "@/components/app/AppShell";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { listAccessibleSpaceGroups } from "@/lib/spaces";
import { getUnreadCounts, type UnreadCounts } from "@/lib/unread";

export const metadata: Metadata = {
  title: "InvestorClub — Community & Academy",
  description:
    "Het eigen platform van InvestorClub: community, events, livestreams, podcast, cursussen en lidmaatschap.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "InvestorClub", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f7a4d",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  let groups: { name: string; spaces: { name: string; slug: string; accessible: boolean }[] }[] = [];
  let unread: UnreadCounts = { messages: 0, notifications: 0 };
  if (session?.user) {
    try {
      const org = await db.organization.findFirst();
      if (org) {
        const ctx = await getAccessContext(session.user.id, session.user.role);
        const g = await listAccessibleSpaceGroups(org.id, ctx);
        groups = g.map((x) => ({
          name: x.name,
          spaces: x.spaces.map((s) => ({ name: s.name, slug: s.slug, accessible: s.accessible })),
        }));
      }
      unread = await getUnreadCounts(session.user.id);
    } catch {
      // DB not connected — render shell without spaces.
    }
  }

  return (
    <html lang="nl" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})()",
          }}
        />
        <PWARegister />
        {session?.user ? (
          <AppShell
            user={{
              id: session.user.id,
              name: session.user.name ?? null,
              image: session.user.image ?? null,
              role: session.user.role,
            }}
            groups={groups}
            unread={unread}
          >
            {children}
          </AppShell>
        ) : (
          <div className="flex min-h-full flex-col">
            <header className="border-b border-border bg-card">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                  <span className="grid size-7 place-items-center rounded-md bg-brand text-sm text-white">
                    IC
                  </span>
                  InvestorClub
                </Link>
                <nav className="flex items-center gap-4 text-sm">
                  <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                    Lidmaatschap
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-md bg-brand px-3 py-1.5 font-medium text-white hover:bg-brand-hover"
                  >
                    Inloggen
                  </Link>
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
