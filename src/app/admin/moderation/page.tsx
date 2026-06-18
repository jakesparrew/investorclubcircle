import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { hideReportedContent, dismissReport } from "@/lib/moderation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type ReportRow = Prisma.ReportGetPayload<{ include: { reporter: { select: { name: true; email: true } } } }>;

export default async function AdminModerationPage() {
  await requireAdminPage();

  let reports: ReportRow[] = [];
  let dbError = false;
  try {
    reports = await db.report.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { reporter: { select: { name: true, email: true } } },
    });
  } catch {
    dbError = true;
  }

  const items = await Promise.all(
    reports.map(async (r) => {
      let snippet = "[verwijderd]";
      let hidden = false;
      if (r.targetType === "post") {
        const p = await db.post.findUnique({
          where: { id: r.targetId },
          select: { title: true, content: true, hiddenAt: true },
        });
        if (p) {
          snippet = `${p.title ? p.title + " — " : ""}${p.content.slice(0, 200)}`;
          hidden = !!p.hiddenAt;
        }
      } else {
        const c = await db.comment.findUnique({
          where: { id: r.targetId },
          select: { content: true, hiddenAt: true },
        });
        if (c) {
          snippet = c.content.slice(0, 200);
          hidden = !!c.hiddenAt;
        }
      }
      return { report: r, snippet, hidden };
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Open meldingen van leden.</p>
      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      {items.map(({ report, snippet, hidden }) => (
        <div key={report.id} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{report.targetType}</Badge>
            <span>reden: {report.reason}</span>
            <span>· door {report.reporter.name ?? report.reporter.email}</span>
            {hidden && <Badge variant="danger">verborgen</Badge>}
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">{snippet}</p>
          <div className="mt-3 flex gap-2">
            {!hidden && (
              <form action={hideReportedContent}>
                <input type="hidden" name="reportId" value={report.id} />
                <Button type="submit" size="sm" variant="destructive">
                  Verberg
                </Button>
              </form>
            )}
            <form action={dismissReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <Button type="submit" size="sm" variant="ghost">
                Afwijzen
              </Button>
            </form>
          </div>
        </div>
      ))}
      {items.length === 0 && !dbError && (
        <p className="text-sm text-muted-foreground">Geen open meldingen.</p>
      )}
    </div>
  );
}
