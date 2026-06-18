/**
 * Normalize a user-supplied video URL into something embeddable.
 *
 * Supports plain YouTube/Vimeo share-links (not just embed URLs) and direct
 * media files (mp4/webm/…). Anything else is assumed to already be an
 * embeddable iframe URL and passed through unchanged.
 */
export type EmbeddedVideo =
  | { kind: "iframe"; src: string }
  | { kind: "file"; src: string }
  | null;

export function normalizeVideoUrl(raw: string | null | undefined): EmbeddedVideo {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;

  // Direct media files → native <video>
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) {
    return { kind: "file", src: url };
  }

  // YouTube: watch, youtu.be, embed, live, shorts
  const yt = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
  );
  if (yt) {
    return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  }

  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) {
    return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  }

  // Assume it is already an embeddable URL.
  return { kind: "iframe", src: url };
}
