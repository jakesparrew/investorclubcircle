import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Zoeken — InvestorClub" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/search");
  const q = (await searchParams).q?.trim() ?? "";

  let posts: { id: string; title: string | null; slug: string; spaceSlug: string }[] = [];
  let courses: { id: string; title: string; slug: string }[] = [];
  let events: { id: string; title: string; slug: string }[] = [];

  if (q.length >= 2) {
    try {
      const ctx = await getAccessContext(session.user.id, session.user.role);
      const ci = { contains: q, mode: "insensitive" as const };

      const foundPosts = await db.post.findMany({
        where: { hiddenAt: null, OR: [{ title: ci }, { content: ci }] },
        include: { space: true },
        take: 20,
      });
      posts = foundPosts
        .filter((p) => canAccess(ctx, spaceRequirement(p.space)).ok)
        .map((p) => ({ id: p.id, title: p.title, slug: p.id, spaceSlug: p.space.slug }));

      const foundCourses = await db.course.findMany({
        where: { status: "published", OR: [{ title: ci }, { description: ci }] },
        take: 20,
      });
      courses = foundCourses.filter((c) => canAccess(ctx, spaceRequirement(c)).ok);

      const foundEvents = await db.event.findMany({
        where: { status: "published", OR: [{ title: ci }, { description: ci }] },
        take: 20,
      });
      events = foundEvents.filter((e) => canAccess(ctx, spaceRequirement(e)).ok);
    } catch {
      // DB not connected — show empty results.
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-4 text-2xl font-bold">Zoeken</h1>
      <form method="get" className="mb-8 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Zoek in posts, cursussen, events…" />
        <Button type="submit">Zoek</Button>
      </form>

      {q.length >= 2 && (
        <div className="flex flex-col gap-6 text-sm">
          <Section title="Posts" empty={posts.length === 0}>
            {posts.map((p) => (
              <Link key={p.id} href={`/community/${p.spaceSlug}/${p.id}`} className="block hover:underline">
                {p.title ?? "Post"}
              </Link>
            ))}
          </Section>
          <Section title="Cursussen" empty={courses.length === 0}>
            {courses.map((c) => (
              <Link key={c.id} href={`/academy/${c.slug}`} className="block hover:underline">
                {c.title}
              </Link>
            ))}
          </Section>
          <Section title="Events" empty={events.length === 0}>
            {events.map((e) => (
              <Link key={e.id} href={`/events/${e.slug}`} className="block hover:underline">
                {e.title}
              </Link>
            ))}
          </Section>
        </div>
      )}
      {q.length > 0 && q.length < 2 && (
        <p className="text-sm text-neutral-400">Typ minstens 2 tekens.</p>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
        {empty && <Badge variant="secondary">geen</Badge>}
      </div>
      {!empty && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  );
}
