"use client";

/**
 * Given a deadline in ms-since-epoch (or null), return the current remaining ms
 * (clamped to 0) and update every 250ms. Returns null if deadline is null.
 * Tick cadence is 250ms — smooth enough for a seconds-precision display, light on CPU.
 */

import { useEffect, useState } from "react";

export function useCountdown(deadlineMs: number | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    deadlineMs === null ? null : Math.max(0, deadlineMs - Date.now())
  );

  useEffect(() => {
    if (deadlineMs === null) {
      setRemaining(null);
      return;
    }

    setRemaining(Math.max(0, deadlineMs - Date.now()));

    const interval = setInterval(() => {
      setRemaining(Math.max(0, deadlineMs - Date.now()));
    }, 250);

    return () => clearInterval(interval);
  }, [deadlineMs]);

  return remaining;
}

export function formatCountdown(ms: number | null): string {
  if (ms === null) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = seconds.toString().padStart(2, "0");
  if (hours > 0) {
    const mm = minutes.toString().padStart(2, "0");
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}
