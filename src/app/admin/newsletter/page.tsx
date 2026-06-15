import type { NewsletterIssue } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createNewsletter, sendNewsletter } from "@/lib/newsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  await requireAdminPage();
  let issues: NewsletterIssue[] = [];
  let optedIn = 0;
  let dbError = false;
  try {
    [issues, optedIn] = await Promise.all([
      db.newsletterIssue.findMany({ orderBy: { createdAt: "desc" } }),
      db.user.count({ where: { newsletterOptIn: true } }),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-1 font-semibold">Nieuwe nieuwsbrief</h2>
          <p className="mb-3 text-xs text-neutral-500">{optedIn} leden ingeschreven.</p>
          <form action={createNewsletter} className="flex flex-col gap-3">
            <Input name="subject" placeholder="Onderwerp" required />
            <textarea
              name="content"
              required
              rows={6}
              placeholder="Inhoud…"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            />
            <div>
              <Button type="submit">Bewaar als concept</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-3">
        {issues.map((issue) => (
          <div key={issue.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{issue.subject}</span>
                <Badge variant={issue.status === "sent" ? "success" : "secondary"}>{issue.status}</Badge>
              </div>
              {issue.status === "sent" && (
                <div className="text-xs text-neutral-400">Verzonden naar {issue.recipientCount ?? 0} leden</div>
              )}
            </div>
            {issue.status !== "sent" && (
              <form action={sendNewsletter}>
                <input type="hidden" name="id" value={issue.id} />
                <Button type="submit" size="sm">
                  Verstuur
                </Button>
              </form>
            )}
          </div>
        ))}
        {issues.length === 0 && !dbError && (
          <p className="text-sm text-neutral-400">Nog geen nieuwsbrieven.</p>
        )}
      </div>
    </div>
  );
}
