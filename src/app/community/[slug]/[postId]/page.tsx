import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { createComment, toggleReaction, toggleBookmark, votePoll } from "@/lib/community";
import { generateSocialVariants } from "@/lib/ai";
import { reportContent } from "@/lib/moderation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type PostDetail = Prisma.PostGetPayload<{
  include: {
    author: { select: { name: true; email: true } };
    space: true;
    comments: { include: { author: { select: { name: true; email: true } } } };
    poll: { include: { options: { include: { _count: { select: { votes: true } } } } } };
  };
}>;

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/community/${slug}/${postId}`);

  let post: PostDetail | null = null;
  try {
    post = await db.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { name: true, email: true } },
        space: true,
        comments: {
          where: { hiddenAt: null },
          include: { author: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        },
        poll: { include: { options: { include: { _count: { select: { votes: true } } } } } },
      },
    });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">
        Database nog niet gekoppeld.
      </p>
    );
  }
  if (!post) notFound();

  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, spaceRequirement(post.space)).ok) {
    redirect(`/community/${slug}`);
  }

  const [reactionCount, userReaction] = await Promise.all([
    db.reaction.count({ where: { targetType: "post", targetId: post.id } }),
    db.reaction.findUnique({
      where: {
        targetType_targetId_userId_type: {
          targetType: "post",
          targetId: post.id,
          userId: session.user.id,
          type: "like",
        },
      },
    }),
  ]);

  let votedOptionIds = new Set<string>();
  if (post.poll) {
    const votes = await db.pollVote.findMany({
      where: { userId: session.user.id, pollOptionId: { in: post.poll.options.map((o) => o.id) } },
    });
    votedOptionIds = new Set(votes.map((v) => v.pollOptionId));
  }

  const path = `/community/${slug}/${postId}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/community/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900">
        ← {post.space.name}
      </Link>

      <article className="mt-3 rounded-xl border border-neutral-200 bg-white p-6">
        {post.title && <h1 className="text-xl font-bold">{post.title}</h1>}
        <div className="mt-1 text-xs text-neutral-400">
          {post.author.name ?? post.author.email}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-800">{post.content}</p>

        {post.poll && (
          <div className="mt-5 rounded-lg border border-neutral-200 p-4">
            <div className="mb-3 font-medium">{post.poll.question}</div>
            <div className="flex flex-col gap-2">
              {post.poll.options.map((opt) => (
                <form key={opt.id} action={votePoll}>
                  <input type="hidden" name="pollOptionId" value={opt.id} />
                  <button
                    type="submit"
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 ${
                      votedOptionIds.has(opt.id)
                        ? "border-neutral-900 font-medium"
                        : "border-neutral-200"
                    }`}
                  >
                    <span>{opt.text}</span>
                    <span className="text-neutral-400">{opt._count.votes}</span>
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <form action={toggleReaction}>
            <input type="hidden" name="targetType" value="post" />
            <input type="hidden" name="targetId" value={post.id} />
            <Button type="submit" size="sm" variant={userReaction ? "default" : "outline"}>
              ♥ {reactionCount}
            </Button>
          </form>
          <form action={toggleBookmark}>
            <input type="hidden" name="targetType" value="post" />
            <input type="hidden" name="targetId" value={post.id} />
            <input type="hidden" name="redirectPath" value={path} />
            <Button type="submit" size="sm" variant="ghost">
              ☆ Bewaar
            </Button>
          </form>
          {(session.user.role === "ADMIN" || session.user.role === "EXPERT") && (
            <form action={generateSocialVariants}>
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" size="sm" variant="ghost">
                ✨ AI: social
              </Button>
            </form>
          )}
          <form action={reportContent}>
            <input type="hidden" name="targetType" value="post" />
            <input type="hidden" name="targetId" value={post.id} />
            <input type="hidden" name="redirectPath" value={path} />
            <Button type="submit" size="sm" variant="ghost">
              ⚑ Rapporteer
            </Button>
          </form>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-500">
          {post.comments.length} reacties
        </h2>

        <Card className="mb-4">
          <CardContent className="pt-6">
            <form action={createComment} className="flex flex-col gap-3">
              <input type="hidden" name="postId" value={post.id} />
              <textarea
                name="content"
                required
                rows={2}
                placeholder="Schrijf een reactie…"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Reageer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {post.comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="text-xs text-neutral-400">
                {comment.author.name ?? comment.author.email}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{comment.content}</p>
              <form action={reportContent} className="mt-2">
                <input type="hidden" name="targetType" value="comment" />
                <input type="hidden" name="targetId" value={comment.id} />
                <input type="hidden" name="redirectPath" value={path} />
                <button type="submit" className="text-xs text-neutral-400 hover:text-neutral-700">
                  ⚑ rapporteer
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
