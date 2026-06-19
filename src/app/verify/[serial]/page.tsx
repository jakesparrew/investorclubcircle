import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificaat verifiëren — InvestorClub" };

type VerifiedCert = Prisma.CertificateGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    course: { select: { title: true; slug: true } };
  };
}>;

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;

  let cert: VerifiedCert | null = null;
  try {
    cert = await db.certificate.findUnique({
      where: { serial },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
    });
  } catch {
    // DB unreachable — treat as not verifiable below.
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      {cert ? (
        <Card className="overflow-hidden">
          <div className="bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground">
            ✓ Geldig certificaat
          </div>
          <CardContent className="flex flex-col items-center gap-1 py-10 text-center">
            <div className="text-5xl">🎓</div>
            <p className="mt-2 text-sm text-muted-foreground">Dit certificaat bevestigt dat</p>
            <h1 className="text-2xl font-bold">{cert.user.name ?? "Certificaathouder"}</h1>
            <p className="text-sm text-muted-foreground">met succes de cursus voltooide</p>
            <p className="text-lg font-semibold text-primary">{cert.course.title}</p>
            <div className="mt-4 text-xs text-muted-foreground">
              Uitgereikt op{" "}
              {new Intl.DateTimeFormat("nl-BE", { dateStyle: "long" }).format(cert.issuedAt)} ·
              InvestorClub
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">{cert.serial}</div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-lg font-semibold">Geen geldig certificaat</h1>
            <p className="text-sm text-muted-foreground">
              We vonden geen certificaat met serienummer{" "}
              <span className="font-mono">{serial}</span>.
            </p>
            <Link href="/" className="mt-2 text-sm text-primary underline">
              Naar InvestorClub
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
