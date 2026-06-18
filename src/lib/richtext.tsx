import type { ReactNode } from "react";

/**
 * Render a small, SAFE subset of markdown to React nodes (never HTML strings,
 * so there is no injection surface): **bold**, *italic* / _italic_, `code`,
 * http(s) autolinks, and @mention highlighting. Unmatched text is passed
 * through verbatim; wrap the output in a `whitespace-pre-wrap` element to keep
 * newlines.
 */
const TOKEN =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s]+|@[A-Za-z0-9_]+)/g;

export function renderRichText(text: string): ReactNode {
  if (!text) return text;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**") && tok.endsWith("**")) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`") && tok.endsWith("`")) {
      out.push(
        <code key={key++} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (
      (tok.startsWith("*") && tok.endsWith("*")) ||
      (tok.startsWith("_") && tok.endsWith("_"))
    ) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("http")) {
      out.push(
        <a
          key={key++}
          href={tok}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-brand underline"
        >
          {tok}
        </a>,
      );
    } else if (tok.startsWith("@")) {
      out.push(
        <span key={key++} className="font-medium text-brand">
          {tok}
        </span>,
      );
    } else {
      out.push(tok);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
