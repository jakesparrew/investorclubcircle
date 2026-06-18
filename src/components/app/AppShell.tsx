"use client";

import { useEffect, useState } from "react";
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
  Home,
  GraduationCap,
  CalendarDays,
  Users,
  Trophy,
} from "lucide-react";
import { UserMenu } from "@/components/app/UserMenu";
import { CommandPalette } from "@/components/app/CommandPalette";

type SpaceItem = { name: string; slug: string; accessible: boolean };
type Group = { name: string; spaces: SpaceItem[] };
type ShellUser = { id: string; name: string | null; image: string | null; role: string };
type Unread = { messages: number; notifications: number };

const TABS = [
  { href: "/community", label: "Home", Icon: Home },
  { href: "/academy", label: "Academy", Icon: GraduationCap },
  { href: "/events", label: "Events", Icon: CalendarDays },
  { href: "/members", label: "Leden", Icon: Users },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
];

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function AppShell({
  user,
  groups,
  unread,
  children,
}: {
  user: ShellUser;
  groups: Group[];
  unread?: Unread;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const badgeFor = (href: string) =>
    href === "/notifications" ? unread?.notifications ?? 0 : href === "/messages" ? unread?.messages ?? 0 : 0;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="min-h-full">
      <CommandPalette isAdmin={user.role === "ADMIN"} />
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          <button
            className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu openen"
          >
            <Menu className="size-5" />
          </button>
          <Link href="/community" className="flex shrink-0 items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-brand text-sm text-white">IC</span>
            <span className="hidden sm:inline">InvestorClub</span>
          </Link>

          <nav className="mx-auto hidden min-w-0 items-center gap-1 md:flex">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={isActive(t.href) ? "page" : undefined}
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

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {[
              { href: "/search", label: "Zoek", Icon: Search },
              { href: "/notifications", label: "Meldingen", Icon: Bell },
              { href: "/messages", label: "Berichten", Icon: MessageSquare },
              { href: "/bookmarks", label: "Bewaard", Icon: Bookmark },
            ].map(({ href, label, Icon }) => {
              const count = badgeFor(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={count ? `${label} (${count} nieuw)` : label}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={cx(
                    "relative hidden rounded-md p-2 hover:bg-neutral-100 sm:block",
                    isActive(href) ? "text-brand" : "text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  <Icon className="size-5" />
                  {count > 0 && (
                    <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-white">
                      {count > 9 ? "9+" : count}
                    </span>
                  )}
                </Link>
              );
            })}
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-neutral-200 bg-surface px-3 py-4 lg:block">
          <SidebarContent groups={groups} isActive={isActive} role={user.role} />
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigatie">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto bg-surface px-3 py-4 shadow-xl">
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Menu sluiten"
                  className="rounded-md p-1 hover:bg-neutral-200"
                >
                  <X className="size-5" />
                </button>
              </div>
              <SidebarContent
                groups={groups}
                isActive={isActive}
                role={user.role}
                onNavigate={() => setOpen(false)}
                showTabs
              />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function NavRow({
  href,
  icon,
  text,
  active,
  locked,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  text: string;
  active: boolean;
  locked?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={locked ? "/pricing" : href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-brand/10 font-medium text-brand" : "text-neutral-700 hover:bg-neutral-200/60",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {locked && <Lock className="size-3.5 shrink-0 text-neutral-400" />}
    </Link>
  );
}

function SidebarContent({
  groups,
  isActive,
  role,
  onNavigate,
  showTabs,
}: {
  groups: Group[];
  isActive: (h: string) => boolean;
  role: string;
  onNavigate?: () => void;
  showTabs?: boolean;
}) {
  return (
    <nav className="flex flex-col gap-4">
      {showTabs && (
        <div className="flex flex-col gap-0.5 border-b border-neutral-200 pb-3">
          {TABS.map((t) => (
            <NavRow
              key={t.href}
              href={t.href}
              icon={<t.Icon className="size-4" />}
              text={t.label}
              active={isActive(t.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <NavRow
          href="/community"
          icon={<LayoutGrid className="size-4" />}
          text="Feed"
          active={isActive("/community")}
          onNavigate={onNavigate}
        />
      </div>

      {groups.map((g) => (
        <div key={g.name} className="flex flex-col gap-0.5">
          <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {g.name}
          </div>
          {g.spaces.map((s) => (
            <NavRow
              key={s.slug}
              href={`/community/${s.slug}`}
              icon={<Hash className="size-4 text-neutral-400" />}
              text={s.name}
              active={isActive(`/community/${s.slug}`)}
              locked={!s.accessible}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}

      <div className="flex flex-col gap-0.5">
        <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Kanalen
        </div>
        <NavRow href="/live" icon={<Radio className="size-4 text-neutral-400" />} text="Live" active={isActive("/live")} onNavigate={onNavigate} />
        <NavRow href="/podcast" icon={<Mic className="size-4 text-neutral-400" />} text="Podcast" active={isActive("/podcast")} onNavigate={onNavigate} />
        <NavRow href="/portfolio" icon={<LineChart className="size-4 text-neutral-400" />} text="Portfolio" active={isActive("/portfolio")} onNavigate={onNavigate} />
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
