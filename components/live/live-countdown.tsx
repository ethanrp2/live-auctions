"use client";
"use no memo";

import { useEffect, useState } from "react";
import { pad } from "@/lib/format";

interface LiveCountdownProps {
  timeRemaining: number | null;
  urgentAt?: number;
  className?: string;
}

export function formatCountdown(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function LiveCountdown({
  timeRemaining,
  urgentAt = 60_000,
  className,
}: LiveCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const [target, setTarget] = useState<number | null>(() =>
    timeRemaining == null ? null : Date.now() + timeRemaining
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget(timeRemaining == null ? null : Date.now() + timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (target == null) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [target]);

  const remaining = target == null ? 0 : Math.max(0, target - now);
  const urgent = target != null && remaining > 0 && remaining < urgentAt;

  const label = target == null ? "--:--" : formatCountdown(remaining);

  return (
    <span
      className={`inline-flex items-center justify-center rounded px-2.5 py-1 text-xs font-medium tracking-[-0.02em] ${
        urgent ? "bg-[#dc2626] text-white" : "bg-[#f3f3f3] text-black"
      } ${className ?? ""}`}
      style={{ fontFamily: "var(--storefront-font-mono)" }}
    >
      {label}
    </span>
  );
}
