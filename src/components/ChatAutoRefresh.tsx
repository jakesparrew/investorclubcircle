"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lightweight "live" feel: re-fetches the server component on an interval. */
export function ChatAutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
