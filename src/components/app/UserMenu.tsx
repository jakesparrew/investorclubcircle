"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LayoutDashboard, User, Bookmark, Settings, LogOut, Moon, Sun } from "lucide-react";

type MenuUser = { id: string; name: string | null; image: string | null; role: string };

export function UserMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (user.name ?? "?").trim().slice(0, 1).toUpperCase() || "?";

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore storage failures (private mode)
    }
    setDark(next);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: `/members/${user.id}`, label: "Mijn profiel", Icon: User },
    { href: "/bookmarks", label: "Bewaard", Icon: Bookmark },
    { href: "/profile/edit", label: "Profiel bewerken", Icon: Settings },
  ];

  return (
    <div className="relative ml-1 shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Profielmenu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-muted text-sm font-medium">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <div className="truncate text-sm font-medium text-foreground">{user.name ?? "Lid"}</div>
            <div className="truncate text-xs text-muted-foreground">{user.role}</div>
          </div>
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{label}</span>
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted"
            >
              <Settings className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">Adminpaneel</span>
            </Link>
          )}
          <button
            role="menuitem"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
          >
            {dark ? (
              <Sun className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <Moon className="size-4 shrink-0 text-muted-foreground" />
            )}
            {dark ? "Licht thema" : "Donker thema"}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/" });
            }}
            className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
          >
            <LogOut className="size-4 shrink-0 text-muted-foreground" />
            Uitloggen
          </button>
        </div>
      )}
    </div>
  );
}
