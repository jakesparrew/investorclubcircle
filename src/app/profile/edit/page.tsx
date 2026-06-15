import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { updateProfile } from "@/lib/profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profiel bewerken — InvestorClub" };

export default async function ProfileEditPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/profile/edit");

  let name = session.user.name ?? "";
  let headline = "";
  let bio = "";
  let expertise = "";
  try {
    const u = await db.user.findUnique({
      where: { id: session.user.id },
      include: { profile: true },
    });
    name = u?.name ?? "";
    headline = u?.profile?.headline ?? "";
    bio = u?.profile?.bio ?? "";
    expertise = (u?.profile?.expertise ?? []).join(", ");
  } catch {
    // DB not connected — render empty form.
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Profiel bewerken</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProfile} className="flex flex-col gap-3">
            <Input name="name" placeholder="Naam" defaultValue={name} />
            <Input name="headline" placeholder="Headline (bv. Crypto-investeerder)" defaultValue={headline} />
            <textarea
              name="bio"
              placeholder="Bio"
              rows={4}
              defaultValue={bio}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <Input name="expertise" placeholder="Expertise (komma-gescheiden)" defaultValue={expertise} />
            <Button type="submit">Opslaan</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
