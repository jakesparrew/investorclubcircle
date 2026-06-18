import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { startDirectByUserId } from "@/lib/chat";
import { getUserTotalPoints, getLevelForPoints } from "@/lib/points";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type MemberProfile = Prisma.UserGetPayload<{
  include: { profile: true; badges: { include: { badge: true } } };
}>;

export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/members/${id}`);

  let member: MemberProfile | null = null;
  try {
    member = await db.user.findUnique({
      where: { id },
      include: { profile: true, badges: { include: { badge: true } } },
    });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">
        Database nog niet gekoppeld.
      </p>
    );
  }
  if (!member) notFound();

  const points = await getUserTotalPoints(member.id);
  const org = await db.organization.findFirst();
  const level = org ? await getLevelForPoints(org.id, points) : null;
  const isSelf = member.id === session.user.id;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/members" className="text-sm text-muted-foreground hover:text-foreground">
        ← Leden
      </Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {member.image && (
            <img src={member.image} alt="" className="mb-2 h-16 w-16 rounded-full object-cover" />
          )}
          <h1 className="text-2xl font-bold">{member.name ?? "Lid"}</h1>
          {member.profile?.headline && <p className="text-muted-foreground">{member.profile.headline}</p>}
          <div className="mt-2 flex items-center gap-2">
            <Badge>{points} punten</Badge>
            {level && <Badge variant="secondary">{level.name}</Badge>}
            <Badge variant="secondary">{member.role}</Badge>
          </div>
        </div>
        {isSelf ? (
          <Link href="/profile/edit">
            <Button size="sm" variant="outline">
              Bewerk profiel
            </Button>
          </Link>
        ) : (
          <form action={startDirectByUserId}>
            <input type="hidden" name="userId" value={member.id} />
            <Button size="sm">Bericht</Button>
          </form>
        )}
      </div>

      {member.profile?.bio && (
        <p className="mt-5 whitespace-pre-wrap text-foreground">{member.profile.bio}</p>
      )}

      {member.profile?.expertise && member.profile.expertise.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {member.profile.expertise.map((e) => (
            <Badge key={e} variant="secondary">
              {e}
            </Badge>
          ))}
        </div>
      )}

      {member.badges.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {member.badges.map((b) => (
              <Badge key={b.badgeId} variant="secondary">
                {b.badge.icon} {b.badge.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
