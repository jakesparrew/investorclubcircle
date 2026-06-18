import Link from "next/link";
import { redirect } from "next/navigation";
import type { Course } from "@prisma/client";
import { GraduationCap } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement } from "@/lib/academy-access";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Academy — InvestorClub" };

type Row = { course: Course; accessible: boolean; enrolled: boolean; total: number; completed: number };

export default async function AcademyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/academy");

  let rows: Row[] = [];
  let dbError = false;
  try {
    const ctx = await getAccessContext(session.user.id, session.user.role);
    const [courses, enrollments, progress] = await Promise.all([
      db.course.findMany({
        where: { status: "published" },
        orderBy: { sortOrder: "asc" },
        include: { modules: { include: { lessons: { select: { id: true } } } } },
      }),
      db.enrollment.findMany({ where: { userId: session.user.id }, select: { courseId: true } }),
      db.lessonProgress.findMany({ where: { userId: session.user.id }, select: { lessonId: true } }),
    ]);
    const enrolled = new Set(enrollments.map((e) => e.courseId));
    const done = new Set(progress.map((p) => p.lessonId));
    rows = courses.map((c) => {
      const lessons = c.modules.flatMap((m) => m.lessons);
      return {
        course: c,
        accessible: canAccess(ctx, courseRequirement(c)).ok,
        enrolled: enrolled.has(c.id),
        total: lessons.length,
        completed: lessons.filter((l) => done.has(l.id)).length,
      };
    });
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Academy</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Cursussen met video, quizzes, voortgang en certificaten.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — cursussen verschijnen zodra de verbinding live is.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(({ course, accessible, enrolled, total, completed }) => {
          const pct = total ? Math.round((completed / total) * 100) : 0;
          const href = accessible ? `/academy/${course.slug}` : "/pricing";
          return (
            <Link
              key={course.id}
              href={href}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-input"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-brand/15 to-brand/5">
                {course.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.coverImage}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <GraduationCap className="size-10 text-brand/40" />
                  </div>
                )}
                {!accessible && (
                  <span className="absolute right-2 top-2">
                    <Badge variant="warning">🔒 {course.minTier ?? "leden"}</Badge>
                  </span>
                )}
                {enrolled && (
                  <span className="absolute left-2 top-2">
                    <Badge variant="success">Ingeschreven</Badge>
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold break-words">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{course.description}</p>
                )}

                {enrolled && total > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Voortgang</span>
                      <span>
                        {completed}/{total}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-4 text-sm font-medium text-brand">
                  {!accessible
                    ? "Bekijk lidmaatschap →"
                    : enrolled
                      ? pct >= 100
                        ? "Bekijk opnieuw →"
                        : "Ga verder →"
                      : "Start cursus →"}
                </div>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && !dbError && (
          <p className="col-span-full text-center text-sm text-muted-foreground">Nog geen cursussen.</p>
        )}
      </div>
    </div>
  );
}
