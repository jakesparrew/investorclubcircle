import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { createPost } from "@/lib/community";
import { PostCard, type PostCardData } from "@/components/community/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const PAGE = 25;

export default async function SpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const limit = Math.min(Math.max(parseInt(sp.limit ?? `${PAGE}`, 10) || PAGE, PAGE), 200);
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/community/${slug}`);

  let space: Awaited<ReturnType<typeof db.space.findUnique>> = null;
  try {
    space = await db.space.findUnique({ where: { slug } });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">Database nog niet gekoppeld.</p>
    );
  }
  if (!space) notFound();

  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, spaceRequirement(space)).ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Geen toegang</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-neutral-600">
            <p>Deze space is voorbehouden aan {space.minTier ?? "leden"}.</p>
            <Link href="/pricing">
              <Button variant="brand" className="w-full">
                Bekijk lidmaatschappen
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = await db.post.findMany({
    where: { spaceId: space.id, hiddenAt: null },
    include: {
      author: { select: { name: true, email: true, image: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const posts: PostCardData[] = rows.slice(0, limit).map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    pinned: p.pinned,
    createdAt: p.createdAt,
    spaceName: space!.name,
    spaceSlug: slug,
    authorName: p.author.name ?? p.author.email,
    authorImage: p.author.image,
    commentCount: p._count.comments,
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold break-words"># {space.name}</h1>
      {space.description && <p className="text-sm text-neutral-500">{space.description}</p>}

      <Card className="mt-5">
        <CardContent className="pt-5">
          <form action={createPost} className="flex flex-col gap-3">
            <input type="hidden" name="spaceId" value={space.id} />
            <Input name="title" placeholder="Titel (optioneel)" />
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Deel iets met de community…"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-neutral-500">+ Poll toevoegen (optioneel)</summary>
              <div className="mt-2 flex flex-col gap-2">
                <Input name="pollQuestion" placeholder="Pollvraag" />
                <Input name="pollOption1" placeholder="Optie 1" />
                <Input name="pollOption2" placeholder="Optie 2" />
                <Input name="pollOption3" placeholder="Optie 3 (optioneel)" />
                <Input name="pollOption4" placeholder="Optie 4 (optioneel)" />
              </div>
            </details>
            <div className="flex justify-end">
              <Button type="submit" variant="brand">
                Plaatsen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} showSpace={false} />
        ))}
        {posts.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-400">Nog geen berichten. Wees de eerste!</p>
        )}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <Link
            href={`/community/${slug}?limit=${limit + PAGE}`}
            className="inline-block rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Toon meer
          </Link>
        </div>
      )}
    </div>
  );
}
