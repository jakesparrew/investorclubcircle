import { magicLinkSignIn, googleSignIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/guards";

export const metadata = { title: "Inloggen — InvestorClub" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = safeRedirectPath(callbackUrl);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Inloggen bij InvestorClub</CardTitle>
          <CardDescription>Toegang tot de community, events en cursussen.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={googleSignIn}>
            <input type="hidden" name="callbackUrl" value={target} />
            <Button type="submit" variant="outline" className="w-full">
              Verder met Google
            </Button>
          </form>

          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span className="h-px flex-1 bg-neutral-200" />
            of via magische link
            <span className="h-px flex-1 bg-neutral-200" />
          </div>

          <form action={magicLinkSignIn} className="flex flex-col gap-3">
            <input type="hidden" name="callbackUrl" value={target} />
            <Input type="email" name="email" placeholder="jij@email.be" required autoComplete="email" />
            <Button type="submit" variant="brand" className="w-full">
              Stuur magische link
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
