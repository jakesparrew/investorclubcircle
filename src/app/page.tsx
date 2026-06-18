import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-20 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          De #1 crypto-community van Vlaanderen
        </p>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Eén platform voor community, events, livestreams en cursussen.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          InvestorClub brengt alles samen wat we vandaag over losse tools verspreiden — met de kennis
          van 10+ experts en 370+ leden, op ons eigen platform.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover"
          >
            Word lid
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-input bg-card px-5 py-2.5 font-medium hover:bg-muted"
          >
            Inloggen
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-3">
        {[
          { title: "Community", body: "Spaces, posts en chat met experts en leden." },
          { title: "Events & livestreams", body: "Reserveer events en volg sessies live." },
          { title: "Academy", body: "Cursussen met voortgang, quizzes en certificaten." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
