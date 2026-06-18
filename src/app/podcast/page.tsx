import { redirect } from "next/navigation";
import type { PodcastEpisode } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Podcast — InvestorClub" };

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" }).format(d);
}

export default async function PodcastPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/podcast");

  let episodes: PodcastEpisode[] = [];
  let dbError = false;
  try {
    episodes = await db.podcastEpisode.findMany({ orderBy: { publishedAt: "desc" }, take: 50 });
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Podcast</h1>
      <p className="mb-8 text-sm text-muted-foreground">De laatste afleveringen van InvestorClub.</p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {episodes.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-card p-5">
            <div className="font-semibold">{e.title}</div>
            <div className="mb-3 text-xs text-muted-foreground">{fmtDate(e.publishedAt)}</div>
            {e.description && <p className="mb-3 text-sm text-muted-foreground">{e.description}</p>}
            <audio controls preload="none" src={e.audioUrl} className="w-full">
              Je browser ondersteunt geen audio.
            </audio>
          </div>
        ))}
        {episodes.length === 0 && !dbError && (
          <p className="text-center text-sm text-muted-foreground">Nog geen afleveringen.</p>
        )}
      </div>
    </div>
  );
}
