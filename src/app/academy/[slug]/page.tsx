import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement, isLessonAvailable } from "@/lib/academy-access";
import { enrollInCourse } from "@/lib/academy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type CourseDetail = Prisma.CourseGetPayload<{
  include: { modules: { include: { lessons: { include: { quiz: { select: { id: true } } } } } } };
}>;

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/academy/${slug}`);

  let course: CourseDetail | null = null;
  try {
    course = await db.course.findUnique({
      where: { slug },
      include: {
        modules: {
          orderBy: { sortOrder: "asc" },
          include: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              include: { quiz: { select: { id: true } } },
            },
          },
        },
      },
    });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">
        Database nog niet gekoppeld.
      </p>
    );
  }
  if (!course) notFound();

  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, courseRequirement(course)).ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Geen toegang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-neutral-600">
            <p>Deze cursus is voorbehouden aan {course.minTier ?? "leden"}.</p>
            <Link href="/pricing">
              <Button className="w-full">Bekijk lidmaatschappen</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const [enrollment, progress, certificate] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    }),
    db.lessonProgress.findMany({
      where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) } },
      select: { lessonId: true },
    }),
    db.certificate.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    }),
  ]);

  const completed = new Set(progress.map((p) => p.lessonId));
  const now = new Date();
  const pct = allLessons.length ? Math.round((completed.size / allLessons.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/academy" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Academy
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{course.title}</h1>
      {course.description && <p className="mt-1 text-neutral-600">{course.description}</p>}

      <div className="mt-5 flex items-center gap-4">
        {enrollment ? (
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-xs text-neutral-500">
              <span>Voortgang</span>
              <span>
                {completed.size}/{allLessons.length}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-neutral-900" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <form action={enrollInCourse}>
            <input type="hidden" name="courseId" value={course.id} />
            <Button type="submit">Schrijf je in</Button>
          </form>
        )}
        {certificate && <Badge variant="success">🎓 Certificaat behaald</Badge>}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {course.modules.map((module) => (
          <div key={module.id}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {module.title}
            </h2>
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
              {module.lessons.map((lesson) => {
                const isDone = completed.has(lesson.id);
                const available = isLessonAvailable(lesson, enrollment?.enrolledAt ?? null, completed, now);
                return available ? (
                  <Link
                    key={lesson.id}
                    href={`/academy/${slug}/${lesson.id}`}
                    className="flex items-center justify-between p-4 hover:bg-neutral-50"
                  >
                    <span className="flex items-center gap-2">
                      {isDone ? "✓" : "○"} {lesson.title}
                      {lesson.isPreview && <Badge variant="secondary">Preview</Badge>}
                      {lesson.quiz && <Badge variant="secondary">Quiz</Badge>}
                    </span>
                    <span className="text-neutral-400">→</span>
                  </Link>
                ) : (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between p-4 text-neutral-400"
                  >
                    <span className="flex items-center gap-2">🔒 {lesson.title}</span>
                    <span className="text-xs">
                      {lesson.dripOffsetDays ? `over ${lesson.dripOffsetDays}d` : "vergrendeld"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
