import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { listAccessibleSpaceGroups } from "@/lib/spaces";
import { PostCard, type PostCardData } from "@/components/community/PostCard";
import { FeedSort } from "@/components/community/FeedSort";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community — InvestorClub" };

const PAGE = 25;

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; sort?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/community");

  const sp = await searchParams;
  const limit = Math.min(Math.max(parseInt(sp.limit ?? `${PAGE}`, 10) || PAGE, PAGE), 200);
  const sort = sp.sort === "popular" ? "popular" : "new";
  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    sort === "popular"
      ? [{ comments: { _count: "desc" } }, { createdAt: "desc" }]
      : [{ pinned: "desc" }, { createdAt: "desc" }];

  let posts: PostCardData[] = [];
  let hasMore = false;
  let dbError = false;
  try {
    const org = await db.organization.findFirst();
    if (org) {
      const ctx = await getAccessContext(session.user.id, session.user.role);
      const groups = await listAccessibleSpaceGroups(org.id, ctx);
      const ids = groups.flatMap((g) => g.spaces.filter((s) => s.accessible).map((s) => s.id));
      if (ids.length) {
        const rows = await db.post.findMany({
          where: { spaceId: { in: ids }, hiddenAt: null },
          include: {
            author: { select: { name: true, email: true, image: true } },
            space: { select: { name: true, slug: true } },
            _count: { select: { comments: true } },
          },
          orderBy,
          take: limit + 1,
        });
        hasMore = rows.length > limit;
        posts = rows.slice(0, limit).map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          pinned: p.pinned,
          createdAt: p.createdAt,
          spaceName: p.space.name,
          spaceSlug: p.space.slug,
          authorName: p.author.name ?? p.author.email,
          authorImage: p.author.image,
          commentCount: p._count.comments,
        }));
      }
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold">Feed</h1>
      <p className="mb-4 text-sm text-muted-foreground">De laatste berichten uit je spaces.</p>
      <div className="mb-6">
        <FeedSort basePath="/community" sort={sort} />
      </div>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {posts.length === 0 && !dbError && (
          <div className="rounded-xl border border-dashed border-input bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Nog geen berichten in je spaces.</p>
            <p className="mt-1 text-xs text-muted-foreground">Kies links een space om iets te plaatsen.</p>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <Link
            href={`/community?sort=${sort}&limit=${limit + PAGE}`}
            className="inline-block rounded-full border border-input bg-card px-5 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Toon meer
          </Link>
        </div>
      )}
    </div>
  );
}
