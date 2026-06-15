import { db } from "@/lib/db";
import { markOnboardingStep } from "@/lib/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export async function OnboardingChecklist({ userId, orgId }: { userId: string; orgId: string }) {
  let steps: { id: string; key: string; title: string }[] = [];
  let done = new Set<string>();
  try {
    steps = await db.onboardingStep.findMany({
      where: { orgId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, key: true, title: true },
    });
    const progress = await db.userOnboardingProgress.findMany({ where: { userId } });
    done = new Set(progress.map((p) => p.stepKey));
  } catch {
    return null;
  }
  if (steps.length === 0) return null;

  const remaining = steps.filter((s) => !done.has(s.key)).length;
  if (remaining === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aan de slag ({steps.length - remaining}/{steps.length})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {steps.map((step) => {
          const completed = done.has(step.key);
          return (
            <div key={step.id} className="flex items-center justify-between text-sm">
              <span className={completed ? "text-neutral-400 line-through" : ""}>{step.title}</span>
              {completed ? (
                <span className="text-emerald-600">✓</span>
              ) : (
                <form action={markOnboardingStep}>
                  <input type="hidden" name="stepKey" value={step.key} />
                  <Button type="submit" size="sm" variant="ghost">
                    Markeer
                  </Button>
                </form>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
