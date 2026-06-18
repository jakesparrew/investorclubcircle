import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bewaard — InvestorClub" };

type PostWithSpace = Prisma.PostGetPayload<{ include: { space: true } }>;

export default async function BookmarksPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/bookmarks");

  let posts: PostWithSpace[] = [];
  let dbError = false;
  try {
    const bookmarks = await db.bookmark.findMany({
      where: { userId: session.user.id, targetType: "post" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const found = await db.post.findMany({
      where: { id: { in: bookmarks.map((b) => b.targetId) }, hiddenAt: null },
      include: { space: true },
    });
    const byId = new Map(found.map((p) => [p.id, p]));
    posts = bookmarks
      .map((b) => byId.get(b.targetId))
      .filter((p): p is PostWithSpace => Boolean(p));
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Bewaarde posts</h1>
      <p className="mb-8 text-sm text-muted-foreground">Posts die je bewaarde voor later.</p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/community/${post.space.slug}/${post.id}`}
            className="rounded-xl border border-border bg-card p-4 hover:bg-muted"
          >
            {post.title && <div className="font-medium">{post.title}</div>}
            <p className="line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
          </Link>
        ))}
        {posts.length === 0 && !dbError && (
          <p className="text-center text-sm text-muted-foreground">Nog niets bewaard.</p>
        )}
      </div>
    </div>
  );
}
