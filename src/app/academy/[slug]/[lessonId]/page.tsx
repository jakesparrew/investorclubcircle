import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement, isLessonAvailable } from "@/lib/academy-access";
import { completeLesson, submitQuiz, addLessonComment } from "@/lib/academy";
import { normalizeVideoUrl } from "@/lib/video";
import { renderRichText } from "@/lib/richtext";
import { timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type LessonDetail = Prisma.LessonGetPayload<{
  include: {
    module: { include: { course: true } };
    quiz: { include: { questions: { include: { answers: true } } } };
    comments: { include: { author: { select: { name: true; email: true; image: true } } } };
  };
}>;
type CurriculumModule = Prisma.CourseModuleGetPayload<{ include: { lessons: true } }>;

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/academy/${slug}/${lessonId}`);

  let lesson: LessonDetail | null = null;
  try {
    lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { include: { course: true } },
        quiz: { include: { questions: { include: { answers: true }, orderBy: { sortOrder: "asc" } } } },
        comments: {
          include: { author: { select: { name: true, email: true, image: true } } },
          orderBy: { createdAt: "asc" },
          take: 100,
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
  if (!lesson) notFound();

  const course = lesson.module.course;
  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, courseRequirement(course)).ok) redirect(`/academy/${slug}`);

  const [enrollment, doneLessons, lastAttempt, modules] = await Promise.all([
    db.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    }),
    db.lessonProgress.findMany({ where: { userId: session.user.id }, select: { lessonId: true } }),
    lesson.quiz
      ? db.quizAttempt.findFirst({
          where: { userId: session.user.id, quizId: lesson.quiz.id },
          orderBy: { submittedAt: "desc" },
        })
      : Promise.resolve(null),
    db.courseModule.findMany({
      where: { courseId: course.id },
      orderBy: { sortOrder: "asc" },
      include: { lessons: { orderBy: { sortOrder: "asc" } } },
    }) as Promise<CurriculumModule[]>,
  ]);

  const completed = new Set(doneLessons.map((p) => p.lessonId));
  const now = new Date();
  if (!isLessonAvailable(lesson, enrollment?.enrolledAt ?? null, completed, now)) {
    redirect(`/academy/${slug}`);
  }
  const isDone = completed.has(lesson.id);
  const video = normalizeVideoUrl(lesson.videoUrl);

  const flat = modules.flatMap((m) => m.lessons);
  const idx = flat.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  const isAvail = (l: CurriculumModule["lessons"][number]) =>
    isLessonAvailable(l, enrollment?.enrolledAt ?? null, completed, now);
  const totalDone = flat.filter((l) => completed.has(l.id)).length;
  const pct = flat.length ? Math.round((totalDone / flat.length) * 100) : 0;

  const curriculum = (onlyNav = false) => (
    <nav className={onlyNav ? "" : "lg:sticky lg:top-[4.5rem]"}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Inhoud</span>
        <span>
          {totalDone}/{flat.length}
        </span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-col gap-4">
        {modules.map((m) => (
          <div key={m.id}>
            <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {m.title}
            </div>
            <div className="flex flex-col">
              {m.lessons.map((l) => {
                const here = l.id === lesson.id;
                const done = completed.has(l.id);
                const available = isAvail(l);
                const inner = (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-muted-foreground">
                      {done ? "✓" : available ? "○" : <Lock className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  </span>
                );
                return available ? (
                  <Link
                    key={l.id}
                    href={`/academy/${slug}/${l.id}`}
                    aria-current={here ? "page" : undefined}
                    className={`rounded-md px-2 py-1.5 text-sm ${
                      here ? "bg-brand/10 font-medium text-brand" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <span key={l.id} className="rounded-md px-2 py-1.5 text-sm text-muted-foreground">
                    {inner}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:flex lg:gap-8">
      <div className="min-w-0 flex-1">
        <Link href={`/academy/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {course.title}
        </Link>

        {/* Mobile curriculum */}
        <details className="mt-3 rounded-lg border border-border bg-card p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Cursusinhoud · {totalDone}/{flat.length}
          </summary>
          <div className="mt-3">{curriculum(true)}</div>
        </details>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold break-words">{lesson.title}</h1>
          {isDone && <Badge variant="success">Voltooid</Badge>}
        </div>

        {video && (
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
            {video.kind === "file" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={video.src} controls className="h-full w-full" />
            ) : (
              <iframe
                src={video.src}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        )}

        <article className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {renderRichText(lesson.content)}
        </article>

        {lesson.quiz ? (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <h2 className="mb-1 font-semibold">{lesson.quiz.title}</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Slaagdrempel: {lesson.quiz.passPercent}%
                {lastAttempt &&
                  ` · laatste poging: ${lastAttempt.score}% (${lastAttempt.passed ? "geslaagd" : "niet geslaagd"})`}
              </p>
              <form action={submitQuiz} className="flex flex-col gap-5">
                <input type="hidden" name="quizId" value={lesson.quiz.id} />
                {lesson.quiz.questions.map((q) => (
                  <fieldset key={q.id} className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium">{q.prompt}</legend>
                    {q.answers.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <input
                          type={q.type === "multiple" ? "checkbox" : "radio"}
                          name={`q_${q.id}`}
                          value={a.id}
                          required={q.type !== "multiple"}
                        />
                        {a.text}
                      </label>
                    ))}
                    {q.type === "multiple" && (
                      <span className="text-xs text-muted-foreground">Meerdere antwoorden mogelijk</span>
                    )}
                  </fieldset>
                ))}
                <div>
                  <Button type="submit" size="sm" variant="brand">
                    Verstuur antwoorden
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          !isDone && (
            <form action={completeLesson} className="mt-8">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <Button type="submit" variant="brand">
                Markeer als voltooid
              </Button>
            </form>
          )
        )}

        {/* Prev / next */}
        <div className="mt-10 flex items-stretch justify-between gap-3 border-t border-border pt-5">
          {prev && isAvail(prev) ? (
            <Link
              href={`/academy/${slug}/${prev.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Vorige</span>
                <span className="block truncate text-sm font-medium">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next && isAvail(next) ? (
            <Link
              href={`/academy/${slug}/${next.id}`}
              className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-lg border border-border p-3 text-right hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Volgende</span>
                <span className="block truncate text-sm font-medium">{next.title}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Discussie ({lesson.comments.length})
          </h2>
          <form action={addLessonComment} className="mb-4 flex gap-2">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <input
              name="content"
              required
              placeholder="Stel een vraag of deel iets…"
              className="min-w-0 flex-1 rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            />
            <Button type="submit" size="sm" className="shrink-0">
              Plaats
            </Button>
          </form>
          <div className="flex flex-col gap-3">
            {lesson.comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Avatar src={c.author.image} name={c.author.name ?? c.author.email} size={24} />
                  <span className="min-w-0 truncate text-xs font-medium text-foreground">
                    {c.author.name ?? c.author.email}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">· {timeAgo(c.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">
                  {c.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Desktop curriculum */}
      <aside className="hidden w-72 shrink-0 lg:block">{curriculum()}</aside>
    </div>
  );
}
