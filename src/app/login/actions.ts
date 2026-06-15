"use server";

import { signIn } from "@/auth";
import { safeRedirectPath } from "@/lib/guards";

export async function magicLinkSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await signIn("resend", {
    email,
    redirectTo: safeRedirectPath(formData.get("callbackUrl")),
  });
}

export async function googleSignIn(formData: FormData) {
  await signIn("google", { redirectTo: safeRedirectPath(formData.get("callbackUrl")) });
}
