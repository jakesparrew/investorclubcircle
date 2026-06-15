import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccessContext } from "@/lib/access-context";
import { canAccess, type DenyReason } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const REASON_COPY: Record<DenyReason, string> = {
  authentication_required: "Log in om deze pagina te bekijken.",
  role_required: "Je rol geeft geen toegang tot deze pagina.",
  tier_required: "Deze inhoud is voorbehouden aan premium-leden.",
  product_required: "Je moet dit product aankopen voor toegang.",
  tag_required: "Deze inhoud is voor een specifieke ledengroep.",
};

export default async function PremiumPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let ok = false;
  let reason: DenyReason | undefined;
  try {
    const ctx = await getAccessContext(session.user.id, session.user.role);
    const res = canAccess(ctx, { minTier: "premium" });
    ok = res.ok;
    reason = res.reason;
  } catch {
    reason = "tier_required";
  }

  if (!ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Premium vereist</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm text-neutral-600">
            <p>{reason ? REASON_COPY[reason] : "Geen toegang."}</p>
            <Link href="/pricing">
              <Button className="w-full">Bekijk lidmaatschappen</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-bold">Premium-inhoud 🎉</h1>
      <p className="mt-2 text-neutral-600">
        Je hebt premium-toegang. Hier komen exclusieve analyses, gated streams en perks.
      </p>
    </div>
  );
}
