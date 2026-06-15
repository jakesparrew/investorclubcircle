import type { PodcastEpisode } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { addPodcastEpisode } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPodcastPage() {
  await requireAdminPage();
  let episodes: PodcastEpisode[] = [];
  let dbError = false;
  try {
    episodes = await db.podcastEpisode.findMany({ orderBy: { publishedAt: "desc" }, take: 50 });
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Nieuwe aflevering</h2>
          <form action={addPodcastEpisode} className="flex flex-col gap-3">
            <Input name="title" placeholder="Titel" required />
            <Input name="audioUrl" placeholder="Audio-URL (mp3 of embed)" required />
            <Input name="description" placeholder="Beschrijving" />
            <div>
              <Button type="submit">Toevoegen</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {episodes.map((e) => (
          <div key={e.id} className="p-4 text-sm">
            <div className="font-medium">{e.title}</div>
            <div className="text-xs text-neutral-400">{e.audioUrl}</div>
          </div>
        ))}
        {episodes.length === 0 && !dbError && (
          <p className="p-4 text-sm text-neutral-400">Nog geen afleveringen.</p>
        )}
      </div>
    </div>
  );
}
