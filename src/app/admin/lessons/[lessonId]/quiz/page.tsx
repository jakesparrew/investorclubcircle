import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createQuiz, addQuestion, addAnswer } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type LessonQuiz = Prisma.LessonGetPayload<{
  include: {
    module: { include: { course: true } };
    quiz: { include: { questions: { include: { answers: true } } } };
  };
}>;

export default async function LessonQuizPage({ params }: { params: Promise<{ lessonId: string }> }) {
  await requireAdminPage();
  const { lessonId } = await params;

  let lesson: LessonQuiz | null = null;
  try {
    lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: { include: { course: true } },
        quiz: {
          include: {
            questions: { orderBy: { sortOrder: "asc" }, include: { answers: { orderBy: { sortOrder: "asc" } } } },
          },
        },
      },
    });
  } catch {
    return <p className="text-sm text-amber-700">Database nog niet gekoppeld.</p>;
  }
  if (!lesson) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/courses/${lesson.module.course.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {lesson.module.course.title}
        </Link>
        <h1 className="mt-1 text-xl font-bold">Quiz · {lesson.title}</h1>
      </div>

      {!lesson.quiz ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 font-semibold">Quiz aanmaken</h2>
            <form action={createQuiz} className="flex flex-col gap-3">
              <input type="hidden" name="lessonId" value={lesson.id} />
              <Input name="title" placeholder="Quiztitel" defaultValue="Quiz" />
              <Input name="passPercent" type="number" placeholder="Slaagdrempel %" defaultValue="70" />
              <div>
                <Button type="submit">Aanmaken</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Slaagdrempel: {lesson.quiz.passPercent}%</p>

          {lesson.quiz.questions.map((q) => (
            <Card key={q.id}>
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium">{q.prompt}</span>
                  <Badge variant="secondary">{q.type}</Badge>
                </div>
                <div className="mb-3 flex flex-col gap-1">
                  {q.answers.map((a) => (
                    <div key={a.id} className="text-sm">
                      {a.isCorrect ? "✅" : "○"} {a.text}
                    </div>
                  ))}
                  {q.answers.length === 0 && <p className="text-sm text-muted-foreground">Nog geen antwoorden.</p>}
                </div>
                <form action={addAnswer} className="flex items-center gap-2 border-t border-border pt-3">
                  <input type="hidden" name="questionId" value={q.id} />
                  <input type="hidden" name="lessonId" value={lesson.id} />
                  <Input name="text" placeholder="Antwoord" required />
                  <label className="flex items-center gap-1 whitespace-nowrap text-sm">
                    <input type="checkbox" name="isCorrect" /> juist
                  </label>
                  <Button type="submit" size="sm" variant="outline">
                    +
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-3 font-semibold">Vraag toevoegen</h2>
              <form action={addQuestion} className="flex flex-col gap-3">
                <input type="hidden" name="quizId" value={lesson.quiz.id} />
                <input type="hidden" name="lessonId" value={lesson.id} />
                <Input name="prompt" placeholder="Vraag" required />
                <select name="type" className="h-10 rounded-md border border-input px-2 text-sm">
                  <option value="single">één juist antwoord</option>
                  <option value="multiple">meerdere juist</option>
                  <option value="truefalse">waar/onwaar</option>
                </select>
                <div>
                  <Button type="submit">Vraag +</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
