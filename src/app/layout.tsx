import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvestorClub — Community & Academy",
  description:
    "Het eigen platform van InvestorClub: community, events, livestreams, podcast, cursussen en lidmaatschap.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight">
              InvestorClub
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/community" className="text-neutral-600 hover:text-neutral-900">
                Community
              </Link>
              <Link href="/leaderboard" className="text-neutral-600 hover:text-neutral-900">
                Leaderboard
              </Link>
              <Link href="/pricing" className="text-neutral-600 hover:text-neutral-900">
                Lidmaatschap
              </Link>
              <Link href="/dashboard" className="text-neutral-600 hover:text-neutral-900">
                Dashboard
              </Link>
              <Link
                href="/login"
                className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-800"
              >
                Inloggen
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-neutral-500">
            InvestorClub — het eigen community- &amp; academy-platform.
          </div>
        </footer>
      </body>
    </html>
  );
}
