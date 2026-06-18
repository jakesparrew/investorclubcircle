import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/members", label: "Leden" },
  { href: "/admin/tiers", label: "Tiers" },
  { href: "/admin/spaces", label: "Spaces" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/courses", label: "Cursussen" },
  { href: "/admin/paths", label: "Paden" },
  { href: "/admin/submissions", label: "Opdrachten" },
  { href: "/admin/streams", label: "Streams" },
  { href: "/admin/podcast", label: "Podcast" },
  { href: "/admin/newsletter", label: "Nieuwsbrief" },
  { href: "/admin/social", label: "AI Social" },
  { href: "/admin/moderation", label: "Moderatie" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/segments", label: "Segmenten" },
  { href: "/admin/revenue", label: "Omzet" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Admin</h1>
      <p className="mb-6 text-sm text-muted-foreground">Beheer leden, tiers en configuratie.</p>
      <nav className="mb-8 flex gap-4 overflow-x-auto whitespace-nowrap border-b border-border pb-3 text-sm">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
