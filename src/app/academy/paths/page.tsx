import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Route } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess, type TierKey } from "@/lib/access";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leerpaden — InvestorClub" };

type PathWithCourses = Prisma.LearningPathGetPayload<{
  include: {
    courses: {
      include: { course: { include: { modules: { include: { lessons: { select: { id: true } } } } } } };
    };
  };
}>;

export default async function PathsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/academy/paths");

  let paths: PathWithCourses[] = [];
  let doneIds = new Set<string>();
  let dbError = false;
  const ctx = await getAccessContext(session.user.id, session.user.role).catch(() => null);
  try {
    const [rows, progress] = await Promise.all([
      db.learningPath.findMany({
        where: { status: "published" },
        orderBy: { sortOrder: "asc" },
        include: {
          courses: {
            orderBy: { sortOrder: "asc" },
            include: {
              course: { include: { modules: { include: { lessons: { select: { id: true } } } } } },
            },
          },
        },
      }),
      db.lessonProgress.findMany({ where: { userId: session.user.id }, select: { lessonId: true } }),
    ]);
    paths = rows;
    doneIds = new Set(progress.map((p) => p.lessonId));
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/academy" className="text-sm text-muted-foreground hover:text-foreground">
        ← Academy
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Leerpaden</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Begeleide trajecten — meerdere cursussen in de juiste volgorde.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {paths.map((p) => {
          const lessons = p.courses.flatMap((pc) => pc.course.modules.flatMap((m) => m.lessons));
          const total = lessons.length;
          const done = lessons.filter((l) => doneIds.has(l.id)).length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const accessible = ctx
            ? canAccess(ctx, p.minTier ? { minTier: p.minTier as TierKey } : {}).ok
            : false;
          return (
            <Link
              key={p.id}
              href={accessible ? `/academy/paths/${p.slug}` : "/pricing"}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-input"
            >
              <div className="relative aspect-[5/2] w-full overflow-hidden bg-gradient-to-br from-primary/15 to-primary/5">
                {p.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Route className="size-9 text-primary/40" />
                  </div>
                )}
                {!accessible && (
                  <span className="absolute right-2 top-2">
                    <Badge variant="warning">🔒 {p.minTier ?? "leden"}</Badge>
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold break-words">{p.title}</h3>
                {p.description && (
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {p.courses.length} {p.courses.length === 1 ? "cursus" : "cursussen"}
                  </span>
                  {total > 0 && <span>· {pct}% voltooid</span>}
                </div>
                {total > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
        {paths.length === 0 && !dbError && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            Nog geen leerpaden. Maak er een aan in het adminpaneel.
          </p>
        )}
      </div>
    </div>
  );
}
