import { db } from "./db";

export const PODCAST_RSS_URL = process.env.PODCAST_RSS_URL ?? "https://anchor.fm/s/1170d25c4/podcast/rss";

export type FeedEpisode = {
  guid: string;
  title: string;
  description: string | null;
  audioUrl: string;
  publishedAt: Date;
  imageUrl: string | null;
  duration: string | null;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n] ?? m);
}

/** Text content of the first <tag>, CDATA unwrapped and entities decoded. */
function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  if (!m) return null;
  const cdata = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cdata ? cdata[1] : decode(m[1]);
}

function attr(xml: string, name: string, a: string): string | null {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*${a}="([^"]*)"`));
  return m ? decode(m[1]) : null;
}

/** Show-notes HTML → plain text with paragraph breaks (rendered as text, never as HTML). */
export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h\d)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ponytail: regex RSS parsing, fine for podcast feeds (flat, well-formed); swap for an XML parser if a feed breaks it.
export function parseFeed(xml: string): FeedEpisode[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.flatMap((item) => {
    const audioUrl = attr(item, "enclosure", "url");
    const title = tag(item, "title");
    if (!audioUrl || !title) return [];
    const desc = tag(item, "description");
    const pub = new Date(tag(item, "pubDate") ?? "");
    return [
      {
        guid: tag(item, "guid")?.trim() || audioUrl,
        title: title.trim(),
        description: desc ? htmlToText(desc) : null,
        audioUrl,
        publishedAt: isNaN(pub.getTime()) ? new Date() : pub,
        imageUrl: attr(item, "itunes:image", "href"),
        duration: tag(item, "itunes:duration"),
      },
    ];
  });
}

/** Upsert every feed episode by guid. Returns how many were new. */
export async function syncPodcast(): Promise<{ total: number; added: number }> {
  const res = await fetch(PODCAST_RSS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Podcast RSS ${res.status}`);
  const episodes = parseFeed(await res.text());
  const org = await db.organization.findFirst();
  if (!org) throw new Error("Geen organisatie");

  const existing = new Set(
    (await db.podcastEpisode.findMany({ where: { orgId: org.id, guid: { not: null } }, select: { guid: true } })).map(
      (e) => e.guid,
    ),
  );
  for (const ep of episodes) {
    await db.podcastEpisode.upsert({
      where: { orgId_guid: { orgId: org.id, guid: ep.guid } },
      create: { orgId: org.id, ...ep },
      update: ep,
    });
  }
  return { total: episodes.length, added: episodes.filter((e) => !existing.has(e.guid)).length };
}
