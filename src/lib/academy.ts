"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement } from "@/lib/academy-access";
import { awardPoints } from "@/lib/points";

async function assertCourseAccess(session: Session, course: { isPublic: boolean; minTier: string | null }) {
  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, courseRequirement(course)).ok) throw new Error("Geen toegang tot deze cursus");
}

async function maybeIssueCertificate(userId: string, courseId: string) {
  const lessons = await db.lesson.findMany({ where: { module: { courseId } }, select: { id: true } });
  if (lessons.length === 0) return;
  const completed = await db.lessonProgress.count({
    where: { userId, lessonId: { in: lessons.map((l) => l.id) } },
  });
  if (completed >= lessons.length) {
    await db.certificate.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId, serial: `IC-${randomUUID().slice(0, 8).toUpperCase()}` },
    });
  }
}

export async function enrollInCourse(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return;

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "published") throw new Error("Cursus niet beschikbaar");
  await assertCourseAccess(session, course);

  await db.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    update: {},
    create: { userId: session.user.id, courseId },
  });
  revalidatePath(`/academy/${course.slug}`);
}

export async function completeLesson(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) return;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson) return;
  const course = lesson.module.course;
  await assertCourseAccess(session, course);

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  if (!enrollment) throw new Error("Schrijf je eerst in voor deze cursus");

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    update: {},
    create: { userId: session.user.id, lessonId },
  });
  await awardPoints(session.user.id, 15, "lesson_complete", "lesson", lessonId);
  await maybeIssueCertificate(session.user.id, course.id);

  revalidatePath(`/academy/${course.slug}/${lessonId}`);
  revalidatePath(`/academy/${course.slug}`);
}

export async function submitQuiz(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const quizId = String(formData.get("quizId") ?? "");
  if (!quizId) return;

  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { include: { answers: true } },
      lesson: { include: { module: { include: { course: true } } } },
    },
  });
  if (!quiz) return;
  const course = quiz.lesson.module.course;
  await assertCourseAccess(session, course);

  let correct = 0;
  for (const q of quiz.questions) {
    const selected = formData.getAll(`q_${q.id}`).map(String).sort();
    const correctIds = q.answers
      .filter((a) => a.isCorrect)
      .map((a) => a.id)
      .sort();
    const isCorrect =
      correctIds.length === selected.length && correctIds.every((id, i) => id === selected[i]);
    if (isCorrect) correct++;
  }
  const total = quiz.questions.length || 1;
  const score = Math.round((correct / total) * 100);
  const passed = score >= quiz.passPercent;

  await db.quizAttempt.create({ data: { userId: session.user.id, quizId, score, passed } });

  if (passed) {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: session.user.id, lessonId: quiz.lessonId } },
      update: {},
      create: { userId: session.user.id, lessonId: quiz.lessonId },
    });
    await maybeIssueCertificate(session.user.id, course.id);
  }

  revalidatePath(`/academy/${course.slug}/${quiz.lessonId}`);
}
