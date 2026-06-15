"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { StreamStatus } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireHostOrAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "EXPERT") {
    throw new Error("Alleen experts en admins kunnen livestreams beheren");
  }
  return session;
}

export async function createStream(formData: FormData) {
  const session = await requireHostOrAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const embedUrl = String(formData.get("embedUrl") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const isPublic = formData.get("isPublic") === "on";
  const minTier = String(formData.get("minTier") ?? "") || null;
  if (!title || !embedUrl.startsWith("https://")) return;

  const org = await db.organization.findFirst();
  if (!org) throw new Error("Geen organisatie geconfigureerd");

  await db.livestream.create({
    data: {
      orgId: org.id,
      hostId: session.user.id,
      title,
      description,
      embedUrl,
      isPublic,
      minTier: isPublic ? null : minTier,
      status: "scheduled",
    },
  });
  revalidatePath("/admin/streams");
  revalidatePath("/live");
}

export async function setStreamStatus(formData: FormData) {
  const session = await requireHostOrAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["scheduled", "live", "ended"].includes(status)) return;

  const stream = await db.livestream.findUnique({ where: { id } });
  if (!stream) return;
  if (session.user.role !== "ADMIN" && stream.hostId !== session.user.id) {
    throw new Error("Forbidden");
  }
  await db.livestream.update({ where: { id }, data: { status: status as StreamStatus } });
  revalidatePath("/admin/streams");
  revalidatePath("/live");
  revalidatePath(`/live/${id}`);
}
