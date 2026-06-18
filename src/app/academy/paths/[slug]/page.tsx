import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess, type TierKey } from "@/lib/access";
import { courseRequirement } from "@/lib/academy-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PathDetail = Prisma.LearningPathGetPayload<{
  include: {
    courses: {
      include: { course: { include: { modules: { include: { lessons: { select: { id: true } } } } } } };
    };
  };
}>;

export default async function PathDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/academy/paths/${slug}`);

  let path: PathDetail | null = null;
  try {
    path = await db.learningPath.findUnique({
      where: { slug },
      include: {
        courses: {
          orderBy: { sortOrder: "asc" },
          include: {
            course: { include: { modules: { include: { lessons: { select: { id: true } } } } } },
          },
        },
      },
    });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">Database nog niet gekoppeld.</p>
    );
  }
  if (!path) notFound();

  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, path.minTier ? { minTier: path.minTier as TierKey } : {}).ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Geen toegang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
            <p>Dit leerpad is voorbehouden aan {path.minTier ?? "leden"}.</p>
            <Link href="/pricing">
              <Button variant="brand" className="w-full">
                Bekijk lidmaatschappen
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = await db.lessonProgress.findMany({
    where: { userId: session.user.id },
    select: { lessonId: true },
  });
  const doneIds = new Set(progress.map((p) => p.lessonId));
  const allLessons = path.courses.flatMap((pc) => pc.course.modules.flatMap((m) => m.lessons));
  const totalDone = allLessons.filter((l) => doneIds.has(l.id)).length;
  const overallPct = allLessons.length ? Math.round((totalDone / allLessons.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/academy/paths" className="text-sm text-muted-foreground hover:text-foreground">
        ← Leerpaden
      </Link>
      <h1 className="mt-2 text-2xl font-bold break-words">{path.title}</h1>
      {path.description && <p className="mt-1 text-muted-foreground">{path.description}</p>}

      <div className="mt-5">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Totale voortgang</span>
          <span>{overallPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <ol className="mt-8 flex flex-col gap-3">
        {path.courses.map((pc, i) => {
          const c = pc.course;
          const lessons = c.modules.flatMap((m) => m.lessons);
          const done = lessons.filter((l) => doneIds.has(l.id)).length;
          const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
          const accessible = canAccess(ctx, courseRequirement(c)).ok;
          const complete = lessons.length > 0 && done === lessons.length;
          return (
            <li key={c.id}>
              <Link
                href={accessible ? `/academy/${c.slug}` : "/pricing"}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-input"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    complete
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {complete ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate font-medium">{c.title}</span>
                    {!accessible && <Badge variant="warning">🔒 {c.minTier ?? "leden"}</Badge>}
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>
              </Link>
            </li>
          );
        })}
        {path.courses.length === 0 && (
          <p className="text-sm text-muted-foreground">Dit pad heeft nog geen cursussen.</p>
        )}
      </ol>
    </div>
  );
}
