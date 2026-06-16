"use client";

import { useEffect } from "react";
import { claimDailyPoints } from "@/lib/gamification-actions";

/** Fires the daily-login bonus once when the dashboard mounts. */
export function DailyCheckin() {
  useEffect(() => {
    claimDailyPoints().catch(() => {});
  }, []);
  return null;
}
