"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { awardPoints, awardPointsOnce, POINTS } from "@/lib/points";
import { notify } from "@/lib/notify";

async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

async function assertSpaceAccess(session: Session, spaceId: string) {
  const space = await db.space.findUnique({ where: { id: spaceId } });
  if (!space) throw new Error("Space niet gevonden");
  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, spaceRequirement(space)).ok) throw new Error("Geen toegang tot deze space");
  return space;
}

export async function createPost(formData: FormData) {
  const session = await requireSession();
  const spaceId = String(formData.get("spaceId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim();
  if (!spaceId || !content) return;

  const space = await assertSpaceAccess(session, spaceId);
  const post = await db.post.create({
    data: { spaceId, authorId: session.user.id, title, content },
  });
  await awardPoints(session.user.id, POINTS.post, "post", "post", post.id);

  // Optional poll attached to the post.
  const pollQuestion = String(formData.get("pollQuestion") ?? "").trim();
  if (pollQuestion) {
    const options = [1, 2, 3, 4]
      .map((i) => String(formData.get(`pollOption${i}`) ?? "").trim())
      .filter(Boolean);
    if (options.length >= 2) {
      await db.poll.create({
        data: {
          postId: post.id,
          question: pollQuestion,
          options: { create: options.map((text, idx) => ({ text, sortOrder: idx })) },
        },
      });
    }
  }
  revalidatePath(`/community/${space.slug}`);
}

export async function deletePost(formData: FormData) {
  const session = await requireSession();
  const postId = String(formData.get("postId") ?? "");
  if (!postId) return;
  const post = await db.post.findUnique({ where: { id: postId }, include: { space: true } });
  if (!post) return;
  if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  const slug = post.space.slug;
  await db.post.delete({ where: { id: postId } });
  redirect(`/community/${slug}`);
}

export async function togglePinPost(formData: FormData) {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new Error("Forbidden");
  const postId = String(formData.get("postId") ?? "");
  if (!postId) return;
  const post = await db.post.findUnique({ where: { id: postId }, include: { space: true } });
  if (!post) return;
  await db.post.update({ where: { id: postId }, data: { pinned: !post.pinned } });
  revalidatePath(`/community/${post.space.slug}`);
  revalidatePath(`/community/${post.space.slug}/${postId}`);
}

export async function createComment(formData: FormData) {
  const session = await requireSession();
  const postId = String(formData.get("postId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  if (!postId || !content) return;

  const post = await db.post.findUnique({ where: { id: postId }, include: { space: true } });
  if (!post) return;
  await assertSpaceAccess(session, post.spaceId);

  const comment = await db.comment.create({
    data: { postId, authorId: session.user.id, content, parentId },
  });
  await awardPoints(session.user.id, POINTS.comment, "comment", "comment", comment.id);

  // Notify the post author (and the parent comment author on a reply).
  const by = session.user.name ?? session.user.email ?? "Iemand";
  const link = `/community/${post.space.slug}/${postId}`;
  if (post.authorId !== session.user.id) {
    await notify(post.authorId, "comment", { link, by, title: post.title ?? "je post" });
  }
  if (parentId) {
    const parent = await db.comment.findUnique({ where: { id: parentId }, select: { authorId: true } });
    if (parent && parent.authorId !== session.user.id && parent.authorId !== post.authorId) {
      await notify(parent.authorId, "reply", { link, by });
    }
  }
  revalidatePath(link);
}

export async function toggleReaction(formData: FormData) {
  const session = await requireSession();
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!["post", "comment"].includes(targetType) || !targetId) return;

  let authorId: string | undefined;
  let slug: string | undefined;
  let postId: string | undefined;

  if (targetType === "post") {
    const post = await db.post.findUnique({ where: { id: targetId }, include: { space: true } });
    if (!post) return;
    await assertSpaceAccess(session, post.spaceId);
    authorId = post.authorId;
    slug = post.space.slug;
    postId = post.id;
  } else {
    const comment = await db.comment.findUnique({
      where: { id: targetId },
      include: { post: { include: { space: true } } },
    });
    if (!comment) return;
    await assertSpaceAccess(session, comment.post.spaceId);
    authorId = comment.authorId;
    slug = comment.post.space.slug;
    postId = comment.postId;
  }

  const existing = await db.reaction.findUnique({
    where: {
      targetType_targetId_userId_type: {
        targetType,
        targetId,
        userId: session.user.id,
        type: "like",
      },
    },
  });

  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
  } else {
    await db.reaction.create({ data: { targetType, targetId, userId: session.user.id, type: "like" } });
    await awardPointsOnce(session.user.id, POINTS.reaction_given, "reaction_given", targetType, targetId);
    if (authorId && authorId !== session.user.id) {
      await awardPointsOnce(authorId, POINTS.reaction_received, "reaction_received", targetType, targetId);
    }
  }

  if (slug && postId) revalidatePath(`/community/${slug}/${postId}`);
}

export async function votePoll(formData: FormData) {
  const session = await requireSession();
  const pollOptionId = String(formData.get("pollOptionId") ?? "");
  if (!pollOptionId) return;

  const option = await db.pollOption.findUnique({
    where: { id: pollOptionId },
    include: { poll: { include: { options: true, post: { include: { space: true } } } } },
  });
  if (!option) return;
  await assertSpaceAccess(session, option.poll.post.spaceId);

  if (!option.poll.allowMultiple) {
    await db.pollVote.deleteMany({
      where: { userId: session.user.id, pollOptionId: { in: option.poll.options.map((o) => o.id) } },
    });
  }
  await db.pollVote.upsert({
    where: { pollOptionId_userId: { pollOptionId, userId: session.user.id } },
    update: {},
    create: { pollOptionId, userId: session.user.id },
  });
  await awardPointsOnce(session.user.id, POINTS.poll_vote, "poll_vote", "poll", option.pollId);
  revalidatePath(`/community/${option.poll.post.space.slug}/${option.poll.postId}`);
}

export async function toggleBookmark(formData: FormData) {
  const session = await requireSession();
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const redirectPath = String(formData.get("redirectPath") ?? "");
  if (!targetType || !targetId) return;

  // Verify the user can access the bookmarked resource (prevents IDOR / existence oracle).
  if (targetType === "post") {
    const post = await db.post.findUnique({ where: { id: targetId } });
    if (!post) return;
    await assertSpaceAccess(session, post.spaceId);
  } else if (targetType === "comment") {
    const comment = await db.comment.findUnique({ where: { id: targetId }, include: { post: true } });
    if (!comment) return;
    await assertSpaceAccess(session, comment.post.spaceId);
  } else {
    return;
  }

  const existing = await db.bookmark.findUnique({
    where: { userId_targetType_targetId: { userId: session.user.id, targetType, targetId } },
  });
  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
  } else {
    await db.bookmark.create({ data: { userId: session.user.id, targetType, targetId } });
  }
  if (redirectPath.startsWith("/")) revalidatePath(redirectPath);
}
