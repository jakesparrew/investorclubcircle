import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement, isLessonAvailable } from "@/lib/academy-access";
import { completeLesson, submitQuiz, addLessonComment } from "@/lib/academy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type LessonDetail = Prisma.LessonGetPayload<{
  include: {
    module: { include: { course: true } };
    quiz: { include: { questions: { include: { answers: true } } } };
    comments: { include: { author: { select: { name: true; email: true } } } };
  };
}>;

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
          include: { author: { select: { name: true, email: true } } },
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

  const [enrollment, doneLessons, lastAttempt] = await Promise.all([
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
  ]);

  const completed = new Set(doneLessons.map((p) => p.lessonId));
  if (!isLessonAvailable(lesson, enrollment?.enrolledAt ?? null, completed, new Date())) {
    redirect(`/academy/${slug}`);
  }
  const isDone = completed.has(lesson.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/academy/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900">
        ← {course.title}
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        {isDone && <Badge variant="success">Voltooid</Badge>}
      </div>

      {lesson.videoUrl && (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-black">
          <iframe
            src={lesson.videoUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <article className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
        {lesson.content}
      </article>

      {lesson.quiz ? (
        <Card className="mt-8">
          <CardContent className="pt-6">
            <h2 className="mb-1 font-semibold">{lesson.quiz.title}</h2>
            <p className="mb-4 text-xs text-neutral-500">
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
                      />
                      {a.text}
                    </label>
                  ))}
                </fieldset>
              ))}
              <div>
                <Button type="submit" size="sm">
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
            <Button type="submit">Markeer als voltooid</Button>
          </form>
        )
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-neutral-500">
          Discussie ({lesson.comments.length})
        </h2>
        <form action={addLessonComment} className="mb-4 flex gap-2">
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input
            name="content"
            required
            placeholder="Stel een vraag of deel iets…"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          />
          <Button type="submit" size="sm">
            Plaats
          </Button>
        </form>
        <div className="flex flex-col gap-3">
          {lesson.comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="text-xs text-neutral-400">{c.author.name ?? c.author.email}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{c.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
