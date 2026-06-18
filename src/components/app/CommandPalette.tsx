"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  GraduationCap,
  CalendarDays,
  Users,
  Trophy,
  MessageSquare,
  Bell,
  Bookmark,
  LineChart,
  LayoutDashboard,
  CreditCard,
  Search as SearchIcon,
  Settings,
  Radio,
  Mic,
} from "lucide-react";

type Cmd = { href: string; label: string; hint?: string; Icon: React.ComponentType<{ className?: string }> };

const BASE: Cmd[] = [
  { href: "/community", label: "Feed", hint: "Community", Icon: Home },
  { href: "/academy", label: "Academy", hint: "Cursussen", Icon: GraduationCap },
  { href: "/events", label: "Events", Icon: CalendarDays },
  { href: "/members", label: "Leden", hint: "Directory", Icon: Users },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
  { href: "/messages", label: "Berichten", Icon: MessageSquare },
  { href: "/notifications", label: "Meldingen", Icon: Bell },
  { href: "/bookmarks", label: "Bewaard", Icon: Bookmark },
  { href: "/live", label: "Live", Icon: Radio },
  { href: "/podcast", label: "Podcast", Icon: Mic },
  { href: "/portfolio", label: "Portfolio", Icon: LineChart },
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/profile/edit", label: "Profiel bewerken", Icon: Settings },
  { href: "/pricing", label: "Lidmaatschap", Icon: CreditCard },
  { href: "/search", label: "Zoeken", Icon: SearchIcon },
];

export function CommandPalette({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Cmd[]>(
    () => (isAdmin ? [...BASE, { href: "/admin", label: "Adminpaneel", Icon: Settings }] : BASE),
    [isAdmin],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q),
    );
  }, [query, commands]);

  // Global Cmd/Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      document.body.style.overflow = "hidden";
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Commandopalet"
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4">
          <SearchIcon className="size-4 shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                go(results[active].href);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Spring naar…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-neutral-400"
          />
          <kbd className="hidden rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-400 sm:block">
            ESC
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.map((c, i) => (
            <li key={c.href}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c.href)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                  i === active ? "bg-brand/10 text-brand" : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <c.Icon className="size-4 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.hint && <span className="shrink-0 text-xs text-neutral-400">{c.hint}</span>}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-neutral-400">Geen resultaten.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
