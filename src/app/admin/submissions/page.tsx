import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { addAssignment, gradeSubmission } from "@/lib/admin-content";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SubmissionRow = Prisma.AssignmentSubmissionGetPayload<{
  include: {
    user: { select: { name: true; email: true; image: true } };
    assignment: { include: { lesson: { select: { title: true } } } };
  };
}>;

export default async function AdminSubmissionsPage() {
  await requireAdminPage();

  let lessons: { id: string; title: string; module: { course: { title: string } } }[] = [];
  let submissions: SubmissionRow[] = [];
  let dbError = false;
  try {
    [lessons, submissions] = await Promise.all([
      db.lesson.findMany({
        select: { id: true, title: true, module: { select: { course: { select: { title: true } } } } },
        orderBy: { sortOrder: "asc" },
        take: 300,
      }),
      db.assignmentSubmission.findMany({
        include: {
          user: { select: { name: true, email: true, image: true } },
          assignment: { include: { lesson: { select: { title: true } } } },
        },
        orderBy: { submittedAt: "desc" },
        take: 100,
      }),
    ]);
  } catch {
    dbError = true;
  }

  // Unreviewed first.
  submissions.sort((a, b) => Number(Boolean(a.reviewedAt)) - Number(Boolean(b.reviewedAt)));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Nieuwe opdracht</h2>
          <form action={addAssignment} className="flex flex-col gap-3">
            <select name="lessonId" required className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Kies een les…</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.module.course.title} — {l.title}
                </option>
              ))}
            </select>
            <Input name="title" placeholder="Titel van de opdracht" required />
            <textarea
              name="prompt"
              required
              rows={2}
              placeholder="Opdrachtomschrijving…"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <div>
              <Button type="submit">Opdracht toevoegen</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div>
        <h2 className="mb-3 font-semibold">Inzendingen</h2>
        <div className="flex flex-col gap-3">
          {submissions.map((s) => {
            const variant =
              s.status === "approved" ? "success" : s.status === "needs_work" ? "warning" : "secondary";
            return (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar src={s.user.image} name={s.user.name ?? s.user.email} size={28} />
                  <span className="text-sm font-medium">{s.user.name ?? s.user.email}</span>
                  <span className="text-xs text-muted-foreground">
                    · {s.assignment.title} ({s.assignment.lesson.title})
                  </span>
                  <Badge variant={variant} className="ml-auto">
                    {s.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(s.submittedAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm">
                  {s.content}
                </p>
                <form action={gradeSubmission} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="submissionId" value={s.id} />
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Status
                    <select
                      name="status"
                      defaultValue={s.status}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="approved">approved</option>
                      <option value="needs_work">needs_work</option>
                      <option value="submitted">submitted</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Cijfer
                    <Input name="grade" type="number" defaultValue={s.grade ?? ""} className="h-9 w-20" />
                  </label>
                  <input
                    name="feedback"
                    defaultValue={s.feedback ?? ""}
                    placeholder="Feedback…"
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <Button type="submit" size="sm" variant="outline">
                    Opslaan
                  </Button>
                </form>
              </div>
            );
          })}
          {submissions.length === 0 && !dbError && (
            <p className="text-sm text-muted-foreground">Nog geen inzendingen.</p>
          )}
        </div>
      </div>
    </div>
  );
}
