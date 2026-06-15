"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import type { SocialPlatform } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const MODEL = process.env.AI_MODEL ?? "claude-sonnet-4-6";

async function requireHostOrAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "EXPERT") {
    throw new Error("Alleen experts en admins kunnen de AI-laag gebruiken");
  }
  return session;
}

function anthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.startsWith("dev-")) {
    throw new Error("Anthropic API-key ontbreekt (ANTHROPIC_API_KEY)");
  }
  return new Anthropic({ apiKey: key });
}

function extractText(message: Anthropic.Message): string {
  return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/**
 * Generate IG / LinkedIn / X social variants from a community post.
 * Human-in-the-loop: variants are stored as DRAFT SocialPosts for review.
 */
export async function generateSocialVariants(formData: FormData) {
  await requireHostOrAdmin();
  const postId = String(formData.get("postId") ?? "");
  if (!postId) return;

  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post) return;
  const org = await db.organization.findFirst();
  if (!org) throw new Error("Geen organisatie geconfigureerd");

  const job = await db.aIJob.create({
    data: { orgId: org.id, type: "social_variants", inputRef: postId, status: "running" },
  });

  try {
    const client = anthropic();
    const prompt =
      `Je bent de social-media-redacteur van InvestorClub (Vlaamse crypto-community, toon "kennis boven emotie", ` +
      `Nederlandstalig, NOOIT rendementbeloftes). Maak op basis van deze community-post drie social varianten: ` +
      `Instagram, LinkedIn en X. Antwoord UITSLUITEND met JSON: {"instagram":"...","linkedin":"...","x":"..."}.\n\n` +
      `Post:\n${post.title ? post.title + "\n" : ""}${post.content}`;

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = extractText(message);
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const variants = JSON.parse(json) as Partial<Record<SocialPlatform, string>>;

    const platforms: SocialPlatform[] = ["instagram", "linkedin", "x"];
    for (const platform of platforms) {
      const content = variants[platform];
      if (content) {
        await db.socialPost.create({
          data: { orgId: org.id, source: `post:${postId}`, platform, content, status: "draft" },
        });
      }
    }
    await db.aIJob.update({ where: { id: job.id }, data: { status: "review", output: variants } });
  } catch (err) {
    await db.aIJob.update({ where: { id: job.id }, data: { status: "failed" } });
    throw err;
  }

  revalidatePath("/admin/social");
}

export async function approveSocialPost(formData: FormData) {
  await requireHostOrAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.socialPost.update({ where: { id }, data: { status: "approved" } });
  revalidatePath("/admin/social");
}

export async function deleteSocialPost(formData: FormData) {
  await requireHostOrAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.socialPost.delete({ where: { id } });
  revalidatePath("/admin/social");
}
