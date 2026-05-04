"use client";

import type { User } from "@supabase/supabase-js";
import { LiveAudioWaveform } from "./live-audio-waveform";
import { MuteButton } from "./mute-button";

interface LiveHeaderProps {
  user: User | null;
  watchingCount: number;
  muted: boolean;
  onToggleMute: () => void;
  onOpenAuth: () => void;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function LiveHeader({
  user,
  watchingCount,
  muted,
  onToggleMute,
  onOpenAuth,
}: LiveHeaderProps) {
  const fontMono = { fontFamily: "var(--storefront-font-mono)" };

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-[#f3f3f3] bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full bg-[#dc2626] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white"
          style={fontMono}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          LIVE
        </span>
        <span
          className="hidden items-center gap-1.5 text-xs text-[#5e5e5e] lg:inline-flex"
          style={fontMono}
        >
          <EyeIcon />
          {watchingCount} watching
        </span>
      </div>

      <div className="hidden flex-1 items-center justify-center sm:flex">
        <LiveAudioWaveform muted={muted} />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-xs text-[#5e5e5e] sm:hidden"
          style={fontMono}
        >
          <EyeIcon />
          {watchingCount}
        </span>
        <MuteButton muted={muted} onToggle={onToggleMute} />
        {user ? (
          <span
            className="hidden max-w-[140px] truncate text-xs text-[#5e5e5e] lg:inline"
            style={fontMono}
          >
            {user.email}
          </span>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded bg-black px-3 py-1.5 text-[11px] uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90"
            style={fontMono}
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
