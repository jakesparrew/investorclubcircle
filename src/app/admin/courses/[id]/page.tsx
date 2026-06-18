import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { addCourseModule, addLesson } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type CourseBuilder = Prisma.CourseGetPayload<{
  include: { modules: { include: { lessons: true } } };
}>;

export default async function AdminCourseEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;

  let course: CourseBuilder | null = null;
  try {
    course = await db.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { sortOrder: "asc" },
          include: { lessons: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
  } catch {
    return <p className="text-sm text-amber-700">Database nog niet gekoppeld.</p>;
  }
  if (!course) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/courses" className="text-sm text-muted-foreground hover:text-foreground">
          ← Cursussen
        </Link>
        <h1 className="mt-1 text-xl font-bold">{course.title}</h1>
        <Link href={`/academy/${course.slug}`} className="text-sm text-muted-foreground underline">
          Bekijk in academy →
        </Link>
      </div>

      <form action={addCourseModule} className="flex gap-2">
        <input type="hidden" name="courseId" value={course.id} />
        <Input name="title" placeholder="Nieuwe module…" required />
        <Button type="submit">Module +</Button>
      </form>

      <div className="flex flex-col gap-5">
        {course.modules.map((m) => (
          <div key={m.id} className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold">{m.title}</h2>
            <div className="mb-3 flex flex-col gap-1">
              {m.lessons.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  • {l.title}
                  {l.isPreview && <Badge variant="secondary">preview</Badge>}
                  {l.dripOffsetDays ? <Badge variant="secondary">drip {l.dripOffsetDays}d</Badge> : null}
                  <Link href={`/admin/lessons/${l.id}/quiz`} className="ml-auto text-xs underline">
                    Quiz
                  </Link>
                </div>
              ))}
              {m.lessons.length === 0 && <p className="text-sm text-muted-foreground">Nog geen lessen.</p>}
            </div>
            <form action={addLesson} className="flex flex-col gap-2 border-t border-border pt-3">
              <input type="hidden" name="courseModuleId" value={m.id} />
              <Input name="title" placeholder="Lestitel" required />
              <textarea
                name="content"
                placeholder="Lesinhoud…"
                rows={2}
                required
                className="rounded-md border border-input px-3 py-2 text-sm"
              />
              <Input name="videoUrl" placeholder="Video embed-URL (optioneel)" />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isPreview" /> Preview
                </label>
                <label className="flex items-center gap-2">
                  Drip (dagen):
                  <Input name="dripOffsetDays" type="number" className="h-8 w-20" />
                </label>
                <Button type="submit" size="sm">
                  Les +
                </Button>
              </div>
            </form>
          </div>
        ))}
        {course.modules.length === 0 && (
          <p className="text-sm text-muted-foreground">Voeg eerst een module toe.</p>
        )}
      </div>
    </div>
  );
}
