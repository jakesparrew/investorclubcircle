"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scrollable message viewport that pins itself to the bottom whenever the
 * newest message changes (pass the last message id as `dep`). Used together
 * with ChatAutoRefresh for a near-live chat feel.
 */
export function ChatScroll({
  children,
  dep,
  className = "",
}: {
  children: ReactNode;
  dep: string | number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
