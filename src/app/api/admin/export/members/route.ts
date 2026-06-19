import { Prisma, type Role } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  const q = (url.searchParams.get("q") ?? "").trim();
  const roleParam = url.searchParams.get("role") ?? "";
  const tier = url.searchParams.get("tier") ?? "";

  const and: Prisma.UserWhereInput[] = [];
  if (q)
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  if (["MEMBER", "EXPERT", "ADMIN"].includes(roleParam)) and.push({ role: roleParam as Role });
  if (tier === "free") and.push({ memberships: { none: { status: { in: ["active", "trialing"] } } } });
  else if (["basis", "premium"].includes(tier))
    and.push({ memberships: { some: { status: { in: ["active", "trialing"] }, tier: { key: tier } } } });

  const users = await db.user
    .findMany({
      where: and.length ? { AND: and } : {},
      include: { memberships: { include: { tier: true } } },
      orderBy: { createdAt: "desc" },
      take: 10000,
    })
    .catch(() => []);

  const header = ["email", "naam", "rol", "lid_sinds", "tier", "status"];
  const lines = [header.join(",")];
  for (const u of users) {
    const m = u.memberships[0];
    lines.push(
      [u.email, u.name ?? "", u.role, u.createdAt.toISOString().slice(0, 10), m?.tier.key ?? "", m?.status ?? ""]
        .map(cell)
        .join(","),
    );
  }
  // Prepend a BOM so Excel reads UTF-8 correctly.
  const csv = "﻿" + lines.join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leden-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
