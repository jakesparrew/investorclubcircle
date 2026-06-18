import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { listAccessibleSpaceGroups } from "@/lib/spaces";
import { PostCard, type PostCardData } from "@/components/community/PostCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community — InvestorClub" };

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/community");

  let posts: PostCardData[] = [];
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
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          take: 25,
        });
        posts = rows.map((p) => ({
          id: p.id,
          title: p.title,
          content: p.content,
          pinned: p.pinned,
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
      <p className="mb-6 text-sm text-neutral-500">De laatste berichten uit je spaces.</p>

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
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-sm text-neutral-500">Nog geen berichten in je spaces.</p>
            <p className="mt-1 text-xs text-neutral-400">Kies links een space om iets te plaatsen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
