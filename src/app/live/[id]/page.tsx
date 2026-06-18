import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAccessContext } from "@/lib/access-context";
import { canAccess } from "@/lib/access";
import { spaceRequirement } from "@/lib/spaces";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/live/${id}`);

  let stream: Awaited<ReturnType<typeof db.livestream.findUnique>> = null;
  try {
    stream = await db.livestream.findUnique({ where: { id } });
  } catch {
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-sm text-amber-700">
        Database nog niet gekoppeld.
      </p>
    );
  }
  if (!stream) notFound();

  const ctx = await getAccessContext(session.user.id, session.user.role);
  if (!canAccess(ctx, spaceRequirement(stream)).ok) redirect("/pricing");

  const url = stream.status === "ended" && stream.recordingUrl ? stream.recordingUrl : stream.embedUrl;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/live" className="text-sm text-muted-foreground hover:text-foreground">
        ← Live
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-bold">{stream.title}</h1>
        {stream.status === "live" && <Badge variant="danger">● LIVE</Badge>}
        {stream.status === "ended" && <Badge variant="secondary">Opname</Badge>}
      </div>
      {stream.description && <p className="mt-1 text-muted-foreground">{stream.description}</p>}

      <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        <iframe
          src={url}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
