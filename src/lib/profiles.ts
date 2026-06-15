"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const expertise = String(formData.get("expertise") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (name) {
    await db.user.update({ where: { id: session.user.id }, data: { name } });
  }
  await db.profile.upsert({
    where: { userId: session.user.id },
    update: { headline, bio, expertise },
    create: { userId: session.user.id, headline, bio, expertise },
  });

  revalidatePath(`/members/${session.user.id}`);
  redirect(`/members/${session.user.id}`);
}
