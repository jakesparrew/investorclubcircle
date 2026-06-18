import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/guards";
import { createCourseProduct, toggleProductActive } from "@/lib/admin-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProductRow = Prisma.ProductGetPayload<{ include: { prices: true } }>;

export default async function AdminShopPage() {
  await requireAdminPage();

  let courses: { id: string; title: string }[] = [];
  let products: ProductRow[] = [];
  let courseTitles = new Map<string, string>();
  let connected = false;
  let dbError = false;
  try {
    const org = await db.organization.findFirst();
    connected = Boolean(org?.stripeConnectedAccountId);
    [courses, products] = await Promise.all([
      db.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
      db.product.findMany({ where: { courseId: { not: null } }, include: { prices: true }, orderBy: { createdAt: "desc" } }),
    ]);
    courseTitles = new Map(courses.map((c) => [c.id, c.title]));
  } catch {
    dbError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-3 font-semibold">Cursus los verkopen</h2>
          <form action={createCourseProduct} className="grid gap-3 sm:grid-cols-2">
            <select name="courseId" required className="h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Kies een cursus…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <Input name="name" placeholder="Productnaam (bv. Crypto Basis — los)" required />
            <Input name="price" placeholder="Prijs in € (bv. 49)" required />
            <div className="sm:col-span-2">
              <Button type="submit">Aanmaken</Button>
            </div>
          </form>
          {!connected && (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
              Zonder actieve Stripe-koppeling kan nog niet afgerekend worden — het product/prijs wordt
              bewaard en de “Koop los”-knop werkt zodra de Stripe-prijs gesynct is.
            </p>
          )}
        </CardContent>
      </Card>

      {dbError && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-2">
        {products.map((p) => {
          const price = p.prices[0];
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.courseId ? (courseTitles.get(p.courseId) ?? "cursus") : "—"} ·{" "}
                  {price ? formatMoney(price.amount, price.currency) : "geen prijs"}
                </div>
              </div>
              {price?.stripePriceId ? (
                <Badge variant="success">Stripe-prijs</Badge>
              ) : (
                <Badge variant="secondary">geen Stripe-prijs</Badge>
              )}
              <form action={toggleProductActive}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                <Button type="submit" size="sm" variant={p.active ? "outline" : "ghost"}>
                  {p.active ? "Actief" : "Inactief"}
                </Button>
              </form>
            </div>
          );
        })}
        {products.length === 0 && !dbError && (
          <p className="text-sm text-muted-foreground">Nog geen losse cursusproducten.</p>
        )}
      </div>
    </div>
  );
}
