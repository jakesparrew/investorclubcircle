"use server";

import { revalidatePath } from "next/cache";
import type { QuestionType } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

async function org() {
  const o = await db.organization.findFirst();
  if (!o) throw new Error("Geen organisatie geconfigureerd");
  return o;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function intOrNull(formData: FormData, key: string): number | null {
  const v = parseInt(str(formData, key), 10);
  return Number.isNaN(v) ? null : v;
}
function centsOrNull(formData: FormData, key: string): number | null {
  const v = parseFloat(str(formData, key).replace(",", "."));
  return Number.isNaN(v) ? null : Math.round(v * 100);
}
function tierOrNull(formData: FormData): string | null {
  const v = str(formData, "minTier");
  return v === "" ? null : v;
}

// ─── Events ─────────────────────────────────────────────────────────────────

export async function createEvent(formData: FormData) {
  const session = await requireAdmin();
  const title = str(formData, "title");
  if (!title) return;
  const o = await org();
  const startsAtRaw = str(formData, "startsAt");
  const endsAtRaw = str(formData, "endsAt");

  await db.event.create({
    data: {
      orgId: o.id,
      hostId: session.user.id,
      title,
      slug: str(formData, "slug") || slugify(title),
      description: str(formData, "description") || null,
      coverImage: str(formData, "coverImage") || null,
      location: str(formData, "location") || null,
      startsAt: startsAtRaw ? new Date(startsAtRaw) : new Date(),
      endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      capacity: intOrNull(formData, "capacity"),
      isPublic: formData.get("isPublic") === "on",
      minTier: tierOrNull(formData),
      depositAmount: centsOrNull(formData, "depositAmount"),
      nonMemberPrice: centsOrNull(formData, "nonMemberPrice"),
      recordingUrl: str(formData, "recordingUrl") || null,
      status: "published",
    },
  });
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

// ─── Spaces ─────────────────────────────────────────────────────────────────

export async function createSpaceGroup(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) return;
  const o = await org();
  await db.spaceGroup.create({ data: { orgId: o.id, name, sortOrder: intOrNull(formData, "sortOrder") ?? 0 } });
  revalidatePath("/admin/spaces");
}

export async function createSpace(formData: FormData) {
  await requireAdmin();
  const name = str(formData, "name");
  const spaceGroupId = str(formData, "spaceGroupId");
  if (!name || !spaceGroupId) return;
  await db.space.create({
    data: {
      spaceGroupId,
      name,
      slug: str(formData, "slug") || slugify(name),
      description: str(formData, "description") || null,
      isPublic: formData.get("isPublic") === "on",
      minTier: tierOrNull(formData),
      sortOrder: intOrNull(formData, "sortOrder") ?? 0,
    },
  });
  revalidatePath("/admin/spaces");
  revalidatePath("/community");
}

// ─── Courses ────────────────────────────────────────────────────────────────

export async function createCourse(formData: FormData) {
  await requireAdmin();
  const title = str(formData, "title");
  if (!title) return;
  const o = await org();
  await db.course.create({
    data: {
      orgId: o.id,
      title,
      slug: str(formData, "slug") || slugify(title),
      description: str(formData, "description") || null,
      isPublic: formData.get("isPublic") === "on",
      minTier: tierOrNull(formData),
      status: "published",
    },
  });
  revalidatePath("/admin/courses");
  revalidatePath("/academy");
}

export async function addCourseModule(formData: FormData) {
  await requireAdmin();
  const courseId = str(formData, "courseId");
  const title = str(formData, "title");
  if (!courseId || !title) return;
  const count = await db.courseModule.count({ where: { courseId } });
  await db.courseModule.create({ data: { courseId, title, sortOrder: count } });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function addLesson(formData: FormData) {
  await requireAdmin();
  const courseModuleId = str(formData, "courseModuleId");
  const title = str(formData, "title");
  const content = str(formData, "content");
  if (!courseModuleId || !title || !content) return;
  const count = await db.lesson.count({ where: { courseModuleId } });
  const mod = await db.courseModule.findUnique({ where: { id: courseModuleId } });
  await db.lesson.create({
    data: {
      courseModuleId,
      title,
      content,
      videoUrl: str(formData, "videoUrl") || null,
      isPreview: formData.get("isPreview") === "on",
      dripOffsetDays: intOrNull(formData, "dripOffsetDays"),
      sortOrder: count,
    },
  });
  if (mod) revalidatePath(`/admin/courses/${mod.courseId}`);
}

// ─── Podcast ────────────────────────────────────────────────────────────────

export async function addPodcastEpisode(formData: FormData) {
  await requireAdmin();
  const title = str(formData, "title");
  const audioUrl = str(formData, "audioUrl");
  if (!title || !audioUrl) return;
  const o = await org();
  await db.podcastEpisode.create({
    data: { orgId: o.id, title, audioUrl, description: str(formData, "description") || null },
  });
  revalidatePath("/admin/podcast");
  revalidatePath("/podcast");
}

// ─── Quiz builder ─────────────────────────────────────────────────────────────

export async function createQuiz(formData: FormData) {
  await requireAdmin();
  const lessonId = str(formData, "lessonId");
  if (!lessonId) return;
  await db.quiz.upsert({
    where: { lessonId },
    update: { title: str(formData, "title") || "Quiz", passPercent: intOrNull(formData, "passPercent") ?? 70 },
    create: { lessonId, title: str(formData, "title") || "Quiz", passPercent: intOrNull(formData, "passPercent") ?? 70 },
  });
  revalidatePath(`/admin/lessons/${lessonId}/quiz`);
}

export async function addQuestion(formData: FormData) {
  await requireAdmin();
  const quizId = str(formData, "quizId");
  const prompt = str(formData, "prompt");
  const lessonId = str(formData, "lessonId");
  if (!quizId || !prompt) return;
  const typeRaw = str(formData, "type") || "single";
  const type = (["single", "multiple", "truefalse"].includes(typeRaw) ? typeRaw : "single") as QuestionType;
  const count = await db.question.count({ where: { quizId } });
  await db.question.create({ data: { quizId, prompt, type, sortOrder: count } });
  if (lessonId) revalidatePath(`/admin/lessons/${lessonId}/quiz`);
}

export async function addAnswer(formData: FormData) {
  await requireAdmin();
  const questionId = str(formData, "questionId");
  const text = str(formData, "text");
  const lessonId = str(formData, "lessonId");
  if (!questionId || !text) return;
  const count = await db.answer.count({ where: { questionId } });
  await db.answer.create({
    data: { questionId, text, isCorrect: formData.get("isCorrect") === "on", sortOrder: count },
  });
  if (lessonId) revalidatePath(`/admin/lessons/${lessonId}/quiz`);
}

// ─── Learning paths ───────────────────────────────────────────────────────────

export async function createLearningPath(formData: FormData) {
  await requireAdmin();
  const title = str(formData, "title");
  if (!title) return;
  const o = await org();
  await db.learningPath.create({
    data: {
      orgId: o.id,
      title,
      slug: str(formData, "slug") || slugify(title),
      description: str(formData, "description") || null,
      coverImage: str(formData, "coverImage") || null,
      minTier: tierOrNull(formData),
      status: "published",
    },
  });
  revalidatePath("/admin/paths");
  revalidatePath("/academy/paths");
}

export async function addCourseToPath(formData: FormData) {
  await requireAdmin();
  const pathId = str(formData, "pathId");
  const courseId = str(formData, "courseId");
  if (!pathId || !courseId) return;
  const count = await db.learningPathCourse.count({ where: { pathId } });
  await db.learningPathCourse.upsert({
    where: { pathId_courseId: { pathId, courseId } },
    update: {},
    create: { pathId, courseId, sortOrder: count },
  });
  revalidatePath("/admin/paths");
}

export async function removeCourseFromPath(formData: FormData) {
  await requireAdmin();
  const pathId = str(formData, "pathId");
  const courseId = str(formData, "courseId");
  if (!pathId || !courseId) return;
  await db.learningPathCourse
    .delete({ where: { pathId_courseId: { pathId, courseId } } })
    .catch(() => null);
  revalidatePath("/admin/paths");
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function addAssignment(formData: FormData) {
  await requireAdmin();
  const lessonId = str(formData, "lessonId");
  const title = str(formData, "title");
  const prompt = str(formData, "prompt");
  if (!lessonId || !title || !prompt) return;
  await db.assignment.create({ data: { lessonId, title, prompt } });
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (lesson) revalidatePath(`/academy/${lesson.module.course.slug}/${lessonId}`);
  revalidatePath("/admin/submissions");
}

export async function gradeSubmission(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "EXPERT") {
    throw new Error("Forbidden");
  }
  const id = str(formData, "submissionId");
  const statusRaw = str(formData, "status");
  const status = ["approved", "needs_work", "submitted"].includes(statusRaw) ? statusRaw : "submitted";
  const grade = intOrNull(formData, "grade");
  const feedback = str(formData, "feedback") || null;
  if (!id) return;
  await db.assignmentSubmission.update({
    where: { id },
    data: { status, grade, feedback, reviewedAt: new Date() },
  });
  revalidatePath("/admin/submissions");
}
