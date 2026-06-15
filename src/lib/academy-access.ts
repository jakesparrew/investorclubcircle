import { spaceRequirement } from "@/lib/spaces";
import type { AccessRequirement } from "@/lib/access";

/** Courses gate the same way as spaces: public or per minimum tier. */
export function courseRequirement(course: { isPublic: boolean; minTier: string | null }): AccessRequirement {
  return spaceRequirement(course);
}

const DAY_MS = 86_400_000;

/**
 * Whether a lesson is available to a user, honouring preview, enrollment,
 * prerequisites and drip scheduling.
 */
export function isLessonAvailable(
  lesson: { dripOffsetDays: number | null; prerequisiteLessonId: string | null; isPreview: boolean },
  enrolledAt: Date | null,
  completedLessonIds: Set<string>,
  now: Date,
): boolean {
  if (lesson.isPreview) return true;
  if (!enrolledAt) return false;
  if (lesson.prerequisiteLessonId && !completedLessonIds.has(lesson.prerequisiteLessonId)) return false;
  if (lesson.dripOffsetDays && lesson.dripOffsetDays > 0) {
    const unlockAt = new Date(enrolledAt.getTime() + lesson.dripOffsetDays * DAY_MS);
    if (now < unlockAt) return false;
  }
  return true;
}
