import { auth } from "@/auth";
import { db } from "@/lib/db";
import { buildSegmentWhere } from "@/lib/segments-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const where = buildSegmentWhere({
    tier: url.searchParams.get("tier") ?? "",
    tagId: url.searchParams.get("tagId") ?? "",
    activity: url.searchParams.get("activity") ?? "",
  });

  const users = await db.user
    .findMany({
      where,
      select: { email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    })
    .catch(() => []);

  const lines = ["email,naam,rol,lid_sinds"];
  for (const u of users) {
    lines.push([u.email, u.name ?? "", u.role, u.createdAt.toISOString().slice(0, 10)].map(cell).join(","));
  }
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="segment-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
