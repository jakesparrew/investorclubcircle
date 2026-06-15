"use server";

import { signIn } from "@/auth";

export async function magicLinkSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await signIn("resend", { email, redirectTo: "/dashboard" });
}

export async function googleSignIn() {
  await signIn("google", { redirectTo: "/dashboard" });
}
