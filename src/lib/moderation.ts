"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

/** Any logged-in member can report a post or comment. */
export async function reportContent(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || "Ongepast";
  const redirectPath = String(formData.get("redirectPath") ?? "");
  if (!["post", "comment"].includes(targetType) || !targetId) return;

  const existing = await db.report.findFirst({
    where: { reporterId: session.user.id, targetType, targetId, status: "open" },
  });
  if (!existing) {
    await db.report.create({
      data: { reporterId: session.user.id, targetType, targetId, reason, status: "open" },
    });
  }
  if (redirectPath.startsWith("/")) revalidatePath(redirectPath);
}

export async function hideReportedContent(formData: FormData) {
  await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "");
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) return;

  if (report.targetType === "post") {
    await db.post.update({ where: { id: report.targetId }, data: { hiddenAt: new Date() } }).catch(() => {});
  } else if (report.targetType === "comment") {
    await db.comment.update({ where: { id: report.targetId }, data: { hiddenAt: new Date() } }).catch(() => {});
  }
  await db.report.update({ where: { id: reportId }, data: { status: "resolved" } });
  revalidatePath("/admin/moderation");
}

export async function dismissReport(formData: FormData) {
  await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "");
  if (!reportId) return;
  await db.report.update({ where: { id: reportId }, data: { status: "dismissed" } });
  revalidatePath("/admin/moderation");
}
