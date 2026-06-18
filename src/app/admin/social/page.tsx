import type { SocialPost } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { approveSocialPost, deleteSocialPost } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminSocialPage() {
  await requireAdminPage();
  let posts: SocialPost[] = [];
  let dbError = false;
  try {
    posts = await db.socialPost.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        AI-gegenereerde social-varianten uit community-posts. Keur goed of verwijder (human-in-the-loop).
        Genereren doe je via de ✨-knop onder een post.
      </p>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      {posts.map((sp) => (
        <div key={sp.id} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{sp.platform}</Badge>
            <Badge variant={sp.status === "approved" ? "success" : "secondary"}>{sp.status}</Badge>
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">{sp.content}</p>
          <div className="mt-3 flex gap-2">
            {sp.status === "draft" && (
              <form action={approveSocialPost}>
                <input type="hidden" name="id" value={sp.id} />
                <Button type="submit" size="sm">
                  Goedkeuren
                </Button>
              </form>
            )}
            <form action={deleteSocialPost}>
              <input type="hidden" name="id" value={sp.id} />
              <Button type="submit" size="sm" variant="ghost">
                Verwijder
              </Button>
            </form>
          </div>
        </div>
      ))}
      {posts.length === 0 && !dbError && (
        <p className="text-sm text-muted-foreground">Nog geen AI-varianten. Genereer er via de ✨-knop onder een post.</p>
      )}
    </div>
  );
}
