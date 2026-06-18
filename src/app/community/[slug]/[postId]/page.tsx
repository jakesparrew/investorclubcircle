import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import {
  createComment,
  toggleReaction,
  toggleBookmark,
  votePoll,
  deletePost,
  togglePinPost,
} from "@/lib/community";
import { generateSocialVariants, summarizePost } from "@/lib/ai";
import { reportContent } from "@/lib/moderation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { timeAgo } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type PostDetail = Prisma.PostGetPayload<{
  include: {
    author: { select: { name: true; email: true; image: true } };
    space: true;
    comments: { include: { author: { select: { name: true; email: true; image: true } } } };
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
        author: { select: { name: true, email: true, image: true } },
        space: true,
        comments: {
          where: { hiddenAt: null },
          include: { author: { select: { name: true, email: true, image: true } } },
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

  const summaryJob = await db.aIJob.findFirst({
    where: { type: "summary", inputRef: post.id, status: "review" },
    orderBy: { createdAt: "desc" },
  });
  const summaryText = (summaryJob?.output as { summary?: string } | null)?.summary ?? null;

  const path = `/community/${slug}/${postId}`;

  const commentIds = post.comments.map((c) => c.id);
  const reactionRows = commentIds.length
    ? await db.reaction.groupBy({
        by: ["targetId"],
        where: { targetType: "comment", targetId: { in: commentIds } },
        _count: { _all: true },
      })
    : [];
  const commentReactions = new Map(reactionRows.map((r) => [r.targetId, r._count._all]));
  const myReacted = commentIds.length
    ? new Set(
        (
          await db.reaction.findMany({
            where: { targetType: "comment", targetId: { in: commentIds }, userId: session.user.id },
            select: { targetId: true },
          })
        ).map((r) => r.targetId),
      )
    : new Set<string>();
  const topComments = post.comments.filter((c) => !c.parentId);
  const repliesByParent = new Map<string, typeof post.comments>();
  for (const c of post.comments) {
    if (!c.parentId) continue;
    const arr = repliesByParent.get(c.parentId);
    if (arr) arr.push(c);
    else repliesByParent.set(c.parentId, [c]);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/community/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900">
        ← {post.space.name}
      </Link>

      <article className="mt-3 rounded-xl border border-neutral-200 bg-white p-6">
        {post.title && <h1 className="text-xl font-bold break-words">{post.title}</h1>}
        <div className="mt-1.5 flex items-center gap-2">
          <Avatar src={post.author.image} name={post.author.name ?? post.author.email} size={28} />
          <span className="min-w-0 truncate text-sm font-medium text-neutral-700">
            {post.author.name ?? post.author.email}
          </span>
          <span className="shrink-0 text-xs text-neutral-400">· {timeAgo(post.createdAt)}</span>
        </div>
        {summaryText && (
          <div className="mt-2 rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
            <span className="font-medium">TL;DR:</span> {summaryText}
          </div>
        )}
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-neutral-800">{post.content}</p>

        {post.poll && (() => {
          const pollTotal = post.poll.options.reduce((s, o) => s + o._count.votes, 0);
          const hasVoted = votedOptionIds.size > 0;
          return (
            <div className="mt-5 rounded-lg border border-neutral-200 p-4">
              <div className="mb-3 font-medium">{post.poll.question}</div>
              <div className="flex flex-col gap-2">
                {post.poll.options.map((opt) => {
                  const pct = pollTotal ? Math.round((opt._count.votes / pollTotal) * 100) : 0;
                  const mine = votedOptionIds.has(opt.id);
                  return (
                    <form key={opt.id} action={votePoll}>
                      <input type="hidden" name="pollOptionId" value={opt.id} />
                      <button
                        type="submit"
                        className={`relative flex w-full items-center justify-between overflow-hidden rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 ${
                          mine ? "border-brand font-medium" : "border-neutral-200"
                        }`}
                      >
                        {hasVoted && (
                          <span
                            className={`absolute inset-y-0 left-0 ${mine ? "bg-brand/15" : "bg-neutral-100"}`}
                            style={{ width: `${pct}%` }}
                            aria-hidden
                          />
                        )}
                        <span className="relative min-w-0 truncate">{opt.text}</span>
                        <span className="relative shrink-0 pl-3 text-neutral-500">
                          {hasVoted ? `${pct}% · ${opt._count.votes}` : opt._count.votes}
                        </span>
                      </button>
                    </form>
                  );
                })}
              </div>
              {pollTotal > 0 && (
                <div className="mt-2 text-xs text-neutral-400">
                  {pollTotal} {pollTotal === 1 ? "stem" : "stemmen"}
                </div>
              )}
            </div>
          );
        })()}

        <div className="mt-4 flex flex-wrap items-center gap-2">
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
            <>
              <form action={generateSocialVariants}>
                <input type="hidden" name="postId" value={post.id} />
                <Button type="submit" size="sm" variant="ghost">
                  ✨ AI: social
                </Button>
              </form>
              <form action={summarizePost}>
                <input type="hidden" name="postId" value={post.id} />
                <Button type="submit" size="sm" variant="ghost">
                  📝 AI: TL;DR
                </Button>
              </form>
            </>
          )}
          <form action={reportContent}>
            <input type="hidden" name="targetType" value="post" />
            <input type="hidden" name="targetId" value={post.id} />
            <input type="hidden" name="redirectPath" value={path} />
            <Button type="submit" size="sm" variant="ghost">
              ⚑ Rapporteer
            </Button>
          </form>
          {session.user.role === "ADMIN" && (
            <form action={togglePinPost}>
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" size="sm" variant="ghost">
                {post.pinned ? "📌 Unpin" : "📌 Pin"}
              </Button>
            </form>
          )}
          {(post.authorId === session.user.id || session.user.role === "ADMIN") && (
            <form action={deletePost}>
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" size="sm" variant="ghost">
                🗑 Verwijder
              </Button>
            </form>
          )}
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
          {topComments.map((comment) => (
            <div key={comment.id} className="flex flex-col gap-2">
              <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Avatar src={comment.author.image} name={comment.author.name ?? comment.author.email} size={24} />
                  <span className="min-w-0 truncate text-xs font-medium text-neutral-700">
                    {comment.author.name ?? comment.author.email}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">· {timeAgo(comment.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-neutral-800">{comment.content}</p>
                <div className="mt-2 flex items-center gap-4">
                  <form action={toggleReaction}>
                    <input type="hidden" name="targetType" value="comment" />
                    <input type="hidden" name="targetId" value={comment.id} />
                    <button
                      type="submit"
                      className={`text-xs hover:text-neutral-700 ${myReacted.has(comment.id) ? "font-medium text-neutral-900" : "text-neutral-400"}`}
                    >
                      ♥ {commentReactions.get(comment.id) ?? 0}
                    </button>
                  </form>
                  <form action={reportContent}>
                    <input type="hidden" name="targetType" value="comment" />
                    <input type="hidden" name="targetId" value={comment.id} />
                    <input type="hidden" name="redirectPath" value={path} />
                    <button type="submit" className="text-xs text-neutral-400 hover:text-neutral-700">
                      ⚑ rapporteer
                    </button>
                  </form>
                </div>
              </div>

              {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                <div key={reply.id} className="ml-6 rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <Avatar src={reply.author.image} name={reply.author.name ?? reply.author.email} size={24} />
                    <span className="min-w-0 truncate text-xs font-medium text-neutral-700">
                      {reply.author.name ?? reply.author.email}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-400">· {timeAgo(reply.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-neutral-800">{reply.content}</p>
                  <form action={toggleReaction} className="mt-2">
                    <input type="hidden" name="targetType" value="comment" />
                    <input type="hidden" name="targetId" value={reply.id} />
                    <button
                      type="submit"
                      className={`text-xs hover:text-neutral-700 ${myReacted.has(reply.id) ? "font-medium text-neutral-900" : "text-neutral-400"}`}
                    >
                      ♥ {commentReactions.get(reply.id) ?? 0}
                    </button>
                  </form>
                </div>
              ))}

              <form action={createComment} className="ml-6 flex gap-2">
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="parentId" value={comment.id} />
                <input
                  name="content"
                  required
                  placeholder="Antwoord…"
                  className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                />
                <Button type="submit" size="sm" variant="ghost">
                  Antwoord
                </Button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
