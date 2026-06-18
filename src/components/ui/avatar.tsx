import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = (name ?? "?").trim().slice(0, 1).toUpperCase() || "?";
  const dim = { width: `${size}px`, height: `${size}px` };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={dim} className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span
      style={dim}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
