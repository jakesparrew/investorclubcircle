import Link from "next/link";
import { redirect } from "next/navigation";
import type { Course } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { courseRequirement } from "@/lib/academy-access";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Academy — InvestorClub" };

export default async function AcademyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/academy");

  let rows: { course: Course; accessible: boolean; enrolled: boolean }[] = [];
  let dbError = false;
  try {
    const ctx = await getAccessContext(session.user.id, session.user.role);
    const [courses, enrollments] = await Promise.all([
      db.course.findMany({ where: { status: "published" }, orderBy: { sortOrder: "asc" } }),
      db.enrollment.findMany({ where: { userId: session.user.id }, select: { courseId: true } }),
    ]);
    const enrolled = new Set(enrollments.map((e) => e.courseId));
    rows = courses.map((c) => ({
      course: c,
      accessible: canAccess(ctx, courseRequirement(c)).ok,
      enrolled: enrolled.has(c.id),
    }));
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Academy</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Cursussen met video, quizzes, voortgang en certificaten.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld — cursussen verschijnen zodra de verbinding live is.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(({ course, accessible, enrolled }) => (
          <div key={course.id} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{course.title}</h3>
              {enrolled && <Badge variant="success">Ingeschreven</Badge>}
            </div>
            {course.description && (
              <p className="mt-1 flex-1 text-sm text-neutral-600">{course.description}</p>
            )}
            <div className="mt-4">
              {accessible ? (
                <Link href={`/academy/${course.slug}`} className="text-sm font-medium underline">
                  Open cursus →
                </Link>
              ) : (
                <Link href="/pricing">
                  <Badge variant="warning">🔒 {course.minTier ?? "leden"}</Badge>
                </Link>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && !dbError && (
          <p className="col-span-full text-center text-sm text-neutral-400">Nog geen cursussen.</p>
        )}
      </div>
    </div>
  );
}
