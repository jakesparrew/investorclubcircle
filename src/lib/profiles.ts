"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function uploadAvatar(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 5_000_000) throw new Error("Afbeelding te groot (max 5MB)");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || key.startsWith("dev-")) {
    throw new Error("Supabase Storage is nog niet geconfigureerd (SUPABASE_SECRET_KEY)");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  await supabase.storage.createBucket("avatars", { public: true }).catch(() => {});

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${session.user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // cache-bust so the new image shows immediately
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  await db.user.update({ where: { id: session.user.id }, data: { image: publicUrl } });

  revalidatePath(`/members/${session.user.id}`);
  revalidatePath("/profile/edit");
}

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
