import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement, isLessonAvailable } from "@/lib/academy-access";
import { enrollInCourse, submitCourseReview } from "@/lib/academy";
import { buyCourse } from "@/lib/billing";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={className} aria-label={`${value.toFixed(1)} van 5`}>
      <span className="text-amber-500">{"★".repeat(full)}</span>
      <span className="text-muted-foreground">{"★".repeat(5 - full)}</span>
    </span>
  );
}

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
    const paid = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
      select: { paidAccess: true },
    });
    if (!paid?.paidAccess) {
      const product = await db.product.findFirst({
        where: { courseId: course.id, active: true },
        include: { prices: { where: { active: true }, take: 1 } },
      });
      const price = product?.prices[0] ?? null;
      return (
        <div className="mx-auto max-w-md px-4 py-16">
          <Card>
            <CardHeader>
              <CardTitle>Geen toegang</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
              <p>Deze cursus is voorbehouden aan {course.minTier ?? "leden"}.</p>
              <Link href="/pricing">
                <Button variant="outline" className="w-full">
                  Bekijk lidmaatschappen
                </Button>
              </Link>
              {price && (
                <form action={buyCourse}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <Button type="submit" variant="brand" className="w-full">
                    Koop los voor {formatMoney(price.amount, price.currency)}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
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

  const [reviewAgg, reviews] = await Promise.all([
    db.courseReview.aggregate({
      where: { courseId: course.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    db.courseReview.findMany({
      where: { courseId: course.id },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const avg = reviewAgg._avg.rating ?? 0;
  const reviewCount = reviewAgg._count._all;
  const myReview = reviews.find((r) => r.userId === session.user.id) ?? null;

  const completed = new Set(progress.map((p) => p.lessonId));
  const now = new Date();
  const pct = allLessons.length ? Math.round((completed.size / allLessons.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/academy" className="text-sm text-muted-foreground hover:text-foreground">
        ← Academy
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{course.title}</h1>
      {reviewCount > 0 && (
        <div className="mt-1 flex items-center gap-2 text-sm">
          <Stars value={avg} />
          <span className="font-medium">{avg.toFixed(1)}</span>
          <span className="text-muted-foreground">
            ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
          </span>
        </div>
      )}
      {course.description && <p className="mt-1 text-muted-foreground">{course.description}</p>}

      <div className="mt-5 flex items-center gap-4">
        {enrollment ? (
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Voortgang</span>
              <span>
                {completed.size}/{allLessons.length}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          <form action={enrollInCourse}>
            <input type="hidden" name="courseId" value={course.id} />
            <Button type="submit" variant="brand">
              Schrijf je in
            </Button>
          </form>
        )}
        {certificate && <Badge variant="success">🎓 Certificaat behaald</Badge>}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {course.modules.map((module) => (
          <div key={module.id}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {module.title}
            </h2>
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {module.lessons.map((lesson) => {
                const isDone = completed.has(lesson.id);
                const available = isLessonAvailable(lesson, enrollment?.enrolledAt ?? null, completed, now);
                return available ? (
                  <Link
                    key={lesson.id}
                    href={`/academy/${slug}/${lesson.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      {isDone ? "✓" : "○"} {lesson.title}
                      {lesson.isPreview && <Badge variant="secondary">Preview</Badge>}
                      {lesson.quiz && <Badge variant="secondary">Quiz</Badge>}
                    </span>
                    <span className="text-muted-foreground">→</span>
                  </Link>
                ) : (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between p-4 text-muted-foreground"
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

      {certificate &&
        (() => {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
          const verifyUrl = `${appUrl}/verify/${certificate.serial}`;
          const linkedIn =
            "https://www.linkedin.com/profile/add?" +
            new URLSearchParams({
              startTask: "CERTIFICATION_NAME",
              name: course.title,
              organizationName: "InvestorClub",
              certUrl: verifyUrl,
              certId: certificate.serial,
            }).toString();
          return (
            <div className="mt-8 rounded-xl border border-primary/20 bg-accent/40 p-5">
              <div className="flex items-center gap-2 font-semibold">🎓 Certificaat behaald</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Serienummer <span className="font-mono">{certificate.serial}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/verify/${certificate.serial}`}>Bekijk &amp; verifieer</Link>
                </Button>
                <Button asChild size="sm" variant="brand">
                  <a href={linkedIn} target="_blank" rel="noopener noreferrer">
                    Voeg toe aan LinkedIn
                  </a>
                </Button>
              </div>
            </div>
          );
        })()}

      {/* Reviews */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reviews ({reviewCount})
        </h2>

        {enrollment ? (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <form action={submitCourseReview} className="flex flex-col gap-3">
                <input type="hidden" name="courseId" value={course.id} />
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Jouw score</label>
                  <select
                    name="rating"
                    defaultValue={myReview?.rating ?? 5}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {"★".repeat(n)} ({n})
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  name="body"
                  rows={2}
                  defaultValue={myReview?.body ?? ""}
                  placeholder="Wat vond je van deze cursus? (optioneel)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="brand">
                    {myReview ? "Review bijwerken" : "Plaats review"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">Schrijf je in om een review achter te laten.</p>
        )}

        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Avatar src={r.user.image} name={r.user.name ?? r.user.email} size={28} />
                <span className="min-w-0 truncate text-sm font-medium">
                  {r.user.name ?? r.user.email}
                </span>
                <Stars value={r.rating} className="text-sm" />
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {timeAgo(r.createdAt)}
                </span>
              </div>
              {r.body && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm">{r.body}</p>}
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-sm text-muted-foreground">Nog geen reviews — wees de eerste.</p>
          )}
        </div>
      </section>
    </div>
  );
}
