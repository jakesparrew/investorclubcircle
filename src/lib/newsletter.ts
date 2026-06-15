"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden");
  return session;
}

export async function createNewsletter(formData: FormData) {
  await requireAdmin();
  const subject = String(formData.get("subject") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!subject || !content) return;

  const org = await db.organization.findFirst();
  if (!org) throw new Error("Geen organisatie geconfigureerd");
  await db.newsletterIssue.create({ data: { orgId: org.id, subject, content, status: "draft" } });
  revalidatePath("/admin/newsletter");
}

export async function sendNewsletter(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const issue = await db.newsletterIssue.findUnique({ where: { id } });
  if (!issue || issue.status === "sent") return;

  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey || apiKey.startsWith("dev-")) {
    throw new Error("Resend is nog niet geconfigureerd (AUTH_RESEND_KEY ontbreekt)");
  }

  const recipients = await db.user.findMany({
    where: { newsletterOptIn: true },
    select: { email: true },
  });

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM ?? "InvestorClub <noreply@investorclub.be>";
  let sent = 0;
  for (const r of recipients) {
    await resend.emails.send({ from, to: r.email, subject: issue.subject, text: issue.content });
    sent++;
  }

  await db.newsletterIssue.update({
    where: { id },
    data: { status: "sent", sentAt: new Date(), recipientCount: sent },
  });
  revalidatePath("/admin/newsletter");
}

export async function toggleNewsletterOptIn() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { newsletterOptIn: true },
  });
  await db.user.update({
    where: { id: session.user.id },
    data: { newsletterOptIn: !user?.newsletterOptIn },
  });
  revalidatePath("/dashboard");
}
