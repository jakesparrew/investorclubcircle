import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createLearningPath, addCourseToPath, removeCourseFromPath } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type PathWithCourses = Prisma.LearningPathGetPayload<{
  include: { courses: { include: { course: { select: { id: true; title: true } } } } };
}>;

export default async function AdminPathsPage() {
  await requireAdminPage();

  let paths: PathWithCourses[] = [];
  let courses: { id: string; title: string }[] = [];
  let dbError = false;
  try {
    [paths, courses] = await Promise.all([
      db.learningPath.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          courses: { orderBy: { sortOrder: "asc" }, include: { course: { select: { id: true, title: true } } } },
        },
      }),
      db.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Nieuw leerpad</h2>
          <form action={createLearningPath} className="grid gap-3 sm:grid-cols-2">
            <Input name="title" placeholder="Titel" required className="sm:col-span-2" />
            <Input name="coverImage" placeholder="Cover-URL (optioneel)" className="sm:col-span-2" />
            <Input name="description" placeholder="Beschrijving" className="sm:col-span-2" />
            <select name="minTier" className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Min. tier: free</option>
              <option value="basis">basis</option>
              <option value="premium">premium</option>
            </select>
            <div>
              <Button type="submit">Aanmaken</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-4">
        {paths.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 font-semibold">{p.title}</div>
            <ol className="mb-3 flex flex-col gap-1">
              {p.courses.map((pc, i) => (
                <li key={pc.course.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{pc.course.title}</span>
                  <form action={removeCourseFromPath}>
                    <input type="hidden" name="pathId" value={p.id} />
                    <input type="hidden" name="courseId" value={pc.course.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Verwijder
                    </Button>
                  </form>
                </li>
              ))}
              {p.courses.length === 0 && (
                <li className="text-sm text-muted-foreground">Nog geen cursussen in dit pad.</li>
              )}
            </ol>
            <form action={addCourseToPath} className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <input type="hidden" name="pathId" value={p.id} />
              <select name="courseId" required className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Cursus toevoegen…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="outline">
                + Toevoegen
              </Button>
            </form>
          </div>
        ))}
        {paths.length === 0 && !dbError && (
          <p className="text-sm text-muted-foreground">Nog geen leerpaden.</p>
        )}
      </div>
    </div>
  );
}
