import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startDirectByUserId } from "@/lib/chat";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leden — InvestorClub" };

type MemberCard = Prisma.UserGetPayload<{ include: { profile: true } }>;

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/members");

  let members: MemberCard[] = [];
  let dbError = false;
  try {
    members = await db.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">Leden</h1>
      <p className="mb-8 text-sm text-neutral-500">De community van InvestorClub.</p>

      {dbError && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Database nog niet gekoppeld.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
            <div>
              <Link href={`/members/${m.id}`} className="font-medium hover:underline">
                {m.name ?? "Lid"}
              </Link>
              {m.profile?.headline && <div className="text-sm text-neutral-500">{m.profile.headline}</div>}
            </div>
            {m.id !== session.user.id && (
              <form action={startDirectByUserId}>
                <input type="hidden" name="userId" value={m.id} />
                <Button type="submit" size="sm" variant="outline">
                  Bericht
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
