import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mijn aankopen — InvestorClub" };

type PaidOrder = Prisma.OrderGetPayload<{ include: { product: true } }>;

export default async function MyProductsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard/my-products");

  let orders: PaidOrder[] = [];
  let courseSlugs = new Map<string, string>();
  let dbError = false;
  try {
    orders = await db.order.findMany({
      where: { userId: session.user.id, status: "paid" },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    const courseIds = orders.map((o) => o.product?.courseId).filter((id): id is string => Boolean(id));
    if (courseIds.length) {
      const courses = await db.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, slug: true },
      });
      courseSlugs = new Map(courses.map((c) => [c.id, c.slug]));
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Mijn aankopen</h1>
      <p className="mb-8 text-sm text-muted-foreground">Losse cursussen en producten die je kocht.</p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-3">
        {orders.map((o) => {
          const slug = o.product?.courseId ? courseSlugs.get(o.product.courseId) : null;
          return (
            <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="text-2xl">📦</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{o.product?.name ?? "Aankoop"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("nl-BE", { dateStyle: "long" }).format(o.createdAt)} ·{" "}
                  {formatMoney(o.amount, o.currency)}
                </div>
              </div>
              {slug && (
                <Button asChild size="sm" variant="brand">
                  <Link href={`/academy/${slug}`}>Open cursus</Link>
                </Button>
              )}
            </div>
          );
        })}
        {orders.length === 0 && !dbError && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Je hebt nog niets los gekocht.</p>
            <Link href="/academy" className="mt-1 inline-block text-sm text-primary underline">
              Bekijk de academy →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
