"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Bell,
  MessageSquare,
  Bookmark,
  Menu,
  X,
  Radio,
  Mic,
  LineChart,
  Lock,
  LayoutGrid,
  Hash,
} from "lucide-react";

type SpaceItem = { name: string; slug: string; accessible: boolean };
type Group = { name: string; spaces: SpaceItem[] };
type ShellUser = { id: string; name: string | null; image: string | null; role: string };

const TABS = [
  { href: "/community", label: "Home" },
  { href: "/academy", label: "Academy" },
  { href: "/events", label: "Events" },
  { href: "/members", label: "Leden" },
  { href: "/leaderboard", label: "Leaderboard" },
];

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function AppShell({
  user,
  groups,
  children,
}: {
  user: ShellUser;
  groups: Group[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const initials = (user.name ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <button
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/community" className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-brand text-sm text-white">IC</span>
            <span className="hidden sm:inline">InvestorClub</span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 md:flex">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cx(
                  "rounded-full px-3 py-1.5 text-sm transition-colors",
                  isActive(t.href)
                    ? "bg-neutral-100 font-medium text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-50",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            {[
              { href: "/search", label: "Zoek", Icon: Search },
              { href: "/notifications", label: "Meldingen", Icon: Bell },
              { href: "/messages", label: "Berichten", Icon: MessageSquare },
              { href: "/bookmarks", label: "Bewaard", Icon: Bookmark },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              >
                <Icon className="size-5" />
              </Link>
            ))}
            <Link href="/dashboard" aria-label="Profiel" className="ml-1">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-8 rounded-full object-cover" />
              ) : (
                <span className="grid size-8 place-items-center rounded-full bg-neutral-200 text-sm font-medium">
                  {initials}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-neutral-200 bg-surface px-3 py-4 lg:block">
          <SidebarContent groups={groups} isActive={isActive} role={user.role} />
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-surface px-3 py-4 shadow-xl">
              <div className="mb-2 flex justify-end">
                <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-neutral-200">
                  <X className="size-5" />
                </button>
              </div>
              <SidebarContent
                groups={groups}
                isActive={isActive}
                role={user.role}
                onNavigate={() => setOpen(false)}
              />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  groups,
  isActive,
  role,
  onNavigate,
}: {
  groups: Group[];
  isActive: (h: string) => boolean;
  role: string;
  onNavigate?: () => void;
}) {
  const item = (href: string, label: React.ReactNode, opts?: { locked?: boolean }) => (
    <Link
      href={opts?.locked ? "/pricing" : href}
      onClick={onNavigate}
      className={cx(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive(href)
          ? "bg-brand/10 font-medium text-brand"
          : "text-neutral-700 hover:bg-neutral-200/60",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">{label}</span>
      {opts?.locked && <Lock className="size-3.5 shrink-0 text-neutral-400" />}
    </Link>
  );

  return (
    <nav className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        {item("/community", (
          <>
            <LayoutGrid className="size-4 shrink-0" /> Feed
          </>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.name} className="flex flex-col gap-0.5">
          <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {g.name}
          </div>
          {g.spaces.map((s) =>
            item(
              `/community/${s.slug}`,
              (
                <>
                  <Hash className="size-4 shrink-0 text-neutral-400" /> {s.name}
                </>
              ),
              { locked: !s.accessible },
            ),
          )}
        </div>
      ))}

      <div className="flex flex-col gap-0.5">
        <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Kanalen
        </div>
        {item("/live", (
          <>
            <Radio className="size-4 shrink-0 text-neutral-400" /> Live
          </>
        ))}
        {item("/podcast", (
          <>
            <Mic className="size-4 shrink-0 text-neutral-400" /> Podcast
          </>
        ))}
        {item("/portfolio", (
          <>
            <LineChart className="size-4 shrink-0 text-neutral-400" /> Portfolio
          </>
        ))}
      </div>

      <div className="mt-1">
        <Link
          href={role === "ADMIN" || role === "EXPERT" ? "/admin/streams" : "/live"}
          onClick={onNavigate}
          className="block rounded-md bg-neutral-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-neutral-800"
        >
          Go live
        </Link>
      </div>
    </nav>
  );
}
