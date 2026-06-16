import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { createPost } from "@/lib/community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/community/${slug}`);

  let space: Awaited<ReturnType<typeof db.space.findUnique>> = null;
  try {
    space = await db.space.findUnique({ where: { slug } });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">
        Database nog niet gekoppeld.
      </p>
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
              <Button className="w-full">Bekijk lidmaatschappen</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const posts = await db.post.findMany({
    where: { spaceId: space.id, hiddenAt: null },
    include: {
      author: { select: { name: true, email: true } },
      _count: { select: { comments: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/community" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Community
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{space.name}</h1>
      {space.description && <p className="text-sm text-neutral-500">{space.description}</p>}

      <Card className="mt-6">
        <CardContent className="pt-6">
          <form action={createPost} className="flex flex-col gap-3">
            <input type="hidden" name="spaceId" value={space.id} />
            <Input name="title" placeholder="Titel (optioneel)" />
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Deel iets met de community…"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
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
              <Button type="submit">Plaatsen</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/community/${slug}/${post.id}`}
            className="rounded-xl border border-neutral-200 bg-white p-4 hover:bg-neutral-50"
          >
            <div className="flex items-center gap-2">
              {post.pinned && <Badge variant="secondary">📌 Gepind</Badge>}
              {post.title && <span className="font-semibold">{post.title}</span>}
            </div>
            <p className="mt-1 line-clamp-3 text-sm text-neutral-700">{post.content}</p>
            <div className="mt-2 text-xs text-neutral-400">
              {post.author.name ?? post.author.email} · {post._count.comments} reacties
            </div>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-center text-sm text-neutral-400">Nog geen berichten. Wees de eerste!</p>
        )}
      </div>
    </div>
  );
}
