import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mijn certificaten — InvestorClub" };

type CertRow = Prisma.CertificateGetPayload<{
  include: { course: { select: { title: true; slug: true } } };
}>;

export default async function CertificatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/certificates");

  let certs: CertRow[] = [];
  let dbError = false;
  try {
    certs = await db.certificate.findMany({
      where: { userId: session.user.id },
      include: { course: { select: { title: true, slug: true } } },
      orderBy: { issuedAt: "desc" },
    });
  } catch {
    dbError = true;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/academy" className="text-sm text-muted-foreground hover:text-foreground">
        ← Academy
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Mijn certificaten</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Voltooi een cursus volledig om een certificaat te verdienen.
      </p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Database nog niet gekoppeld.</p>
      )}

      <div className="flex flex-col gap-3">
        {certs.map((c) => {
          const verifyUrl = `${appUrl}/verify/${c.serial}`;
          const linkedIn =
            "https://www.linkedin.com/profile/add?" +
            new URLSearchParams({
              startTask: "CERTIFICATION_NAME",
              name: c.course.title,
              organizationName: "InvestorClub",
              certUrl: verifyUrl,
              certId: c.serial,
            }).toString();
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="text-3xl">🎓</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.course.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("nl-BE", { dateStyle: "long" }).format(c.issuedAt)} ·{" "}
                  <span className="font-mono">{c.serial}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/verify/${c.serial}`}>Verifieer</Link>
                </Button>
                <Button asChild size="sm" variant="brand">
                  <a href={linkedIn} target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
        {certs.length === 0 && !dbError && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">Nog geen certificaten.</p>
            <Link href="/academy" className="mt-1 inline-block text-sm text-primary underline">
              Start een cursus →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
