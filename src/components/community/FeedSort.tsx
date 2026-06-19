import Link from "next/link";

const TABS = [
  { key: "new", label: "Nieuw" },
  { key: "popular", label: "Populair" },
];

/** Sort toggle for the community feeds (newest vs most-discussed). */
export function FeedSort({ basePath, sort }: { basePath: string; sort: string }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`${basePath}?sort=${t.key}`}
          aria-current={sort === t.key ? "page" : undefined}
          className={`rounded-full px-3 py-1 transition-colors ${
            sort === t.key
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
