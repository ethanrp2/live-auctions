"use client";

// Requires: livekit-client (installed)
// Backend: POST /api/livekit-token { auctionId, role: "publisher" }

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
} from "livekit-client";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type PublishState = "idle" | "connecting" | "live" | "muted" | "error";

interface Props {
  auctionId: string;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function MicOnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="7" y="1" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 10a6 6 0 0 0 12 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1="10" y1="16" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="19" x2="13" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="7" y="1" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
      <path
        d="M4 10a6 6 0 0 0 12 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />
      <line x1="10" y1="16" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="7" y1="19" x2="13" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
      <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function LiveKitPublisher({ auctionId }: Props) {
  const [state, setState] = useState<PublishState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void stopBroadcast();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopBroadcast() {
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
  }

  const startBroadcast = useCallback(async () => {
    setState("connecting");
    setErrorMsg(null);

    try {
      // 1. Get LiveKit token from backend
      const supabaseToken = await getAccessToken();
      if (!supabaseToken) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(`${BACKEND_URL}/api/livekit-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseToken}`,
        },
        body: JSON.stringify({ auctionId, role: "publisher" }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const { token, roomName, livekitUrl } = (await res.json()) as {
        token: string;
        roomName: string;
        livekitUrl: string;
      };

      if (!livekitUrl) {
        throw new Error("LiveKit URL not configured on server");
      }

      // 2. Create local audio track (triggers mic permission prompt)
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      audioTrackRef.current = audioTrack;

      // 3. Connect to LiveKit room
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        setState("idle");
      });

      await room.connect(livekitUrl, token, {
        autoSubscribe: false,
      });

      // 4. Publish the audio track
      await room.localParticipant.publishTrack(audioTrack, {
        source: Track.Source.Microphone,
      });

      setState("live");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start broadcast";

      // Give a friendlier message for mic permission denial
      if (
        msg.includes("Permission denied") ||
        msg.includes("NotAllowedError") ||
        msg.includes("microphone")
      ) {
        setErrorMsg("Microphone access denied — check browser permissions.");
      } else {
        setErrorMsg(msg);
      }

      setState("error");
      await stopBroadcast();
    }
  }, [auctionId]);

  const toggleMute = useCallback(async () => {
    if (!audioTrackRef.current || !roomRef.current) return;
    if (state === "live") {
      await audioTrackRef.current.mute();
      setState("muted");
    } else if (state === "muted") {
      await audioTrackRef.current.unmute();
      setState("live");
    }
  }, [state]);

  const handleStop = useCallback(async () => {
    await stopBroadcast();
    setState("idle");
    setErrorMsg(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  const isPublishing = state === "live" || state === "muted";

  if (state === "idle" || state === "connecting" || state === "error") {
    return (
      <div className="flex items-center gap-2">
        {/* Error tooltip */}
        {errorMsg && (
          <span className="max-w-[160px] truncate text-[10px] text-red-400" title={errorMsg}>
            {errorMsg}
          </span>
        )}

        <button
          type="button"
          onClick={startBroadcast}
          disabled={state === "connecting"}
          className="flex items-center gap-1.5 rounded-[4px] border border-white/20 px-2.5 py-1 text-[11px] uppercase tracking-widest text-white/60 transition-colors hover:border-white/60 hover:text-white disabled:opacity-40"
          title="Start audio broadcast"
          aria-label="Start audio broadcast"
        >
          <MicOffIcon className="h-3.5 w-3.5" />
          <span>{state === "connecting" ? "CONNECTING…" : "GO LIVE"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* ON AIR indicator */}
      <div className="flex items-center gap-1.5 rounded-[4px] bg-[#00ad37]/20 px-2 py-1">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00ad37] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00ad37]" />
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-widest text-[#00ad37]"
          style={{ fontFamily: "var(--font-ibm-plex-mono)" }}
        >
          ON AIR
        </span>
      </div>

      {/* Mute / unmute toggle */}
      <button
        type="button"
        onClick={toggleMute}
        className={[
          "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
          isPublishing && state === "live"
            ? "bg-[#00ad37] text-white hover:bg-[#00ad37]/80"
            : "bg-white/20 text-white/40 hover:bg-white/30",
        ].join(" ")}
        title={state === "muted" ? "Unmute microphone" : "Mute microphone"}
        aria-label={state === "muted" ? "Unmute microphone" : "Mute microphone"}
        aria-pressed={state === "live"}
      >
        {state === "live" ? (
          <MicOnIcon className="h-3.5 w-3.5" />
        ) : (
          <MicOffIcon className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Stop broadcast */}
      <button
        type="button"
        onClick={handleStop}
        className="rounded-[4px] border border-white/20 px-2 py-1 text-[10px] uppercase tracking-widest text-white/40 transition-colors hover:border-white/60 hover:text-white"
        title="Stop broadcast"
        aria-label="Stop audio broadcast"
      >
        END
      </button>
    </div>
  );
}
