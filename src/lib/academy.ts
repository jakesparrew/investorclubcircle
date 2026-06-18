"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement, isLessonAvailable } from "@/lib/academy-access";
import { awardPointsOnce } from "@/lib/points";

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

  // Enforce drip / prerequisites server-side (not just in the page).
  const doneLessons = await db.lessonProgress.findMany({
    where: { userId: session.user.id },
    select: { lessonId: true },
  });
  if (!isLessonAvailable(lesson, enrollment.enrolledAt, new Set(doneLessons.map((p) => p.lessonId)), new Date())) {
    throw new Error("Deze les is nog niet beschikbaar");
  }

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    update: {},
    create: { userId: session.user.id, lessonId },
  });
  await awardPointsOnce(session.user.id, 15, "lesson_complete", "lesson", lessonId);
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

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  if (!enrollment) throw new Error("Schrijf je eerst in voor deze cursus");
  const doneLessons = await db.lessonProgress.findMany({
    where: { userId: session.user.id },
    select: { lessonId: true },
  });
  if (
    !isLessonAvailable(quiz.lesson, enrollment.enrolledAt, new Set(doneLessons.map((p) => p.lessonId)), new Date())
  ) {
    throw new Error("Deze les is nog niet beschikbaar");
  }

  let correct = 0;
  for (const q of quiz.questions) {
    const correctIds = q.answers
      .filter((a) => a.isCorrect)
      .map((a) => a.id)
      .sort();
    if (correctIds.length === 0) continue; // ungradeable (no correct answer) — never counts as correct
    const selected = formData.getAll(`q_${q.id}`).map(String).sort();
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

export async function submitCourseReview(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const courseId = String(formData.get("courseId") ?? "");
  const rating = Math.max(0, Math.min(5, parseInt(String(formData.get("rating") ?? ""), 10) || 0));
  const body = String(formData.get("body") ?? "").trim() || null;
  if (!courseId || !rating) return;

  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return;
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (!enrollment) throw new Error("Schrijf je eerst in om te beoordelen");

  await db.courseReview.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    update: { rating, body },
    create: { userId: session.user.id, courseId, rating, body },
  });
  revalidatePath(`/academy/${course.slug}`);
}

export async function submitAssignment(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!assignmentId || !content) return;

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { lesson: { include: { module: { include: { course: true } } } } },
  });
  if (!assignment) return;
  await assertCourseAccess(session, assignment.lesson.module.course);

  await db.assignmentSubmission.upsert({
    where: { assignmentId_userId: { assignmentId, userId: session.user.id } },
    update: { content, status: "submitted", submittedAt: new Date(), reviewedAt: null, grade: null, feedback: null },
    create: { assignmentId, userId: session.user.id, content },
  });
  revalidatePath(`/academy/${assignment.lesson.module.course.slug}/${assignment.lessonId}`);
}

export async function addLessonComment(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const lessonId = String(formData.get("lessonId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!lessonId || !content) return;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson) return;
  await assertCourseAccess(session, lesson.module.course);

  await db.lessonComment.create({ data: { lessonId, authorId: session.user.id, content } });
  revalidatePath(`/academy/${lesson.module.course.slug}/${lessonId}`);
}
