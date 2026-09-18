import { db } from "./db";

export const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? "UCBtCkloeBiLTqDqzhCozjGA"; // @investorclub

export type LiveNow = { videoId: string; title: string } | null;

/**
 * Parse youtube.com/channel/{id}/live. While live, the canonical link points at the
 * broadcast and the player response says "isLive":true; otherwise it points back at
 * the channel (or at an upcoming stream without isLive).
 */
export function parseLivePage(html: string): LiveNow {
  const id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
  if (!id || !html.includes('"isLive":true')) return null;
  const title = html.match(/<meta name="title" content="([^"]*)"/)?.[1] ?? "Livestream";
  return { videoId: id, title: title.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") };
}

// ponytail: scrapes the public /live page (no API key, public streams only); switch to
// YouTube Data API search.list?eventType=live if YouTube changes the markup.
export async function fetchLiveNow(): Promise<LiveNow> {
  const res = await fetch(`https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}/live`, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en", Cookie: "CONSENT=YES+1; SOCS=CAI" },
    next: { revalidate: 60 }, // at most one YouTube hit per minute across all visitors
  });
  return res.ok ? parseLivePage(await res.text()) : null;
}

/**
 * Mirror the channel's live state into Livestream rows: a new broadcast creates a
 * public "live" row + notifies everyone; a finished one flips to "ended" (the replay
 * lives at the same YouTube URL). Returns the live row's id, if any.
 */
export async function syncYoutubeLive(): Promise<string | null> {
  const live = await fetchLiveNow().catch(() => null);

  await db.livestream.updateMany({
    where: {
      status: "live",
      embedUrl: { startsWith: "https://www.youtube.com/watch?v=" },
      ...(live ? { NOT: { embedUrl: `https://www.youtube.com/watch?v=${live.videoId}` } } : {}),
    },
    data: { status: "ended" },
  });
  if (!live) return null;

  const embedUrl = `https://www.youtube.com/watch?v=${live.videoId}`;
  const existing = await db.livestream.findFirst({ where: { embedUrl } });
  if (existing) return existing.status === "live" ? existing.id : null;

  const org = await db.organization.findFirst();
  const host = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!org || !host) return null;

  const stream = await db.livestream.create({
    data: { orgId: org.id, hostId: host.id, title: live.title, embedUrl, isPublic: true, status: "live" },
  });
  const users = await db.user.findMany({ select: { id: true } });
  await db.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: "announcement",
      payload: { title: `🔴 Nu live: ${live.title}`, body: "Kom erbij!", link: `/live/${stream.id}` },
    })),
  });
  return stream.id;
}
