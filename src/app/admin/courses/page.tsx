import Link from "next/link";
import type { Course } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createCourse } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  await requireAdminPage();
  let courses: Course[] = [];
  let dbError = false;
  try {
    courses = await db.course.findMany({ orderBy: { sortOrder: "asc" } });
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Nieuwe cursus</h2>
          <form action={createCourse} className="flex flex-col gap-3">
            <Input name="title" placeholder="Titel" required />
            <Input name="description" placeholder="Beschrijving" />
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isPublic" /> Publiek
              </label>
              <select name="minTier" className="h-9 rounded-md border border-input px-2">
                <option value="">free</option>
                <option value="basis">basis</option>
                <option value="premium">premium</option>
              </select>
            </div>
            <div>
              <Button type="submit">Aanmaken</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {courses.map((c) => (
          <Link
            key={c.id}
            href={`/admin/courses/${c.id}`}
            className="flex items-center justify-between p-4 hover:bg-muted"
          >
            <span className="font-medium">{c.title}</span>
            <Badge variant="secondary">{c.isPublic ? "publiek" : (c.minTier ?? "free")}</Badge>
          </Link>
        ))}
        {courses.length === 0 && !dbError && (
          <p className="p-4 text-sm text-muted-foreground">Nog geen cursussen.</p>
        )}
      </div>
    </div>
  );
}
