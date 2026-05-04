"use client";

// Requires: livekit-client (installed)
// Backend: POST /api/livekit-token { auctionId, role: "subscriber" }
//
// iOS Safari blocks audio autoplay. This component defaults to muted and shows
// a TAP TO UNMUTE overlay whenever audio is available so the user can opt-in.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from "livekit-client";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type AudioState = "no-audio" | "available-muted" | "playing";

interface Props {
  auctionId: string;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function SpeakerOnIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 7.5h2l4-4v13l-4-4H3v-5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 7a4 4 0 0 1 0 6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M16 4.5a7 7 0 0 1 0 11"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpeakerMutedIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3 7.5h2l4-4v13l-4-4H3v-5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeOpacity="0.4"
      />
      <line x1="13" y1="7" x2="19" y2="13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="19" y1="7" x2="13" y2="13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function LiveKitReceiver({ auctionId }: Props) {
  const [audioState, setAudioState] = useState<AudioState>("no-audio");
  const [connected, setConnected] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Connect on mount; disconnect on unmount
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const supabaseToken = await getAccessToken();
        if (!supabaseToken || cancelled) return;

        const res = await fetch(`${BACKEND_URL}/api/livekit-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseToken}`,
          },
          body: JSON.stringify({ auctionId, role: "subscriber" }),
        });

        if (!res.ok || cancelled) return;

        const { token, livekitUrl } = (await res.json()) as {
          token: string;
          roomName: string;
          livekitUrl: string;
        };

        if (!livekitUrl || cancelled) return;

        const room = new Room();
        roomRef.current = room;

        // When a remote audio track is subscribed, attach it to a hidden <audio>
        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack) => {
            if (track.kind !== Track.Kind.Audio) return;

            // Create or reuse a hidden audio element
            if (!audioElRef.current) {
              const el = document.createElement("audio");
              el.autoplay = true;
              el.muted = true; // start muted (iOS requires user gesture)
              document.body.appendChild(el);
              audioElRef.current = el;
            }

            track.attach(audioElRef.current);
            setAudioState("available-muted");
          }
        );

        room.on(RoomEvent.TrackUnsubscribed, () => {
          if (audioElRef.current) {
            audioElRef.current.srcObject = null;
          }
          setAudioState("no-audio");
        });

        room.on(RoomEvent.Disconnected, () => {
          setConnected(false);
          setAudioState("no-audio");
        });

        await room.connect(livekitUrl, token, { autoSubscribe: true });

        if (!cancelled) {
          setConnected(true);
        }
      } catch {
        // Silently fail — audio is non-critical for the bidding experience
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.remove();
        audioElRef.current = null;
      }
      if (roomRef.current) {
        void roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, [auctionId]);

  const handleUnmute = useCallback(() => {
    if (!audioElRef.current) return;
    audioElRef.current.muted = false;
    setAudioState("playing");
  }, []);

  const handleMute = useCallback(() => {
    if (!audioElRef.current) return;
    audioElRef.current.muted = true;
    setAudioState("available-muted");
  }, []);

  // Don't render anything if not connected yet (avoids flash)
  if (!connected) return null;

  // ── Tap-to-unmute overlay (iOS-friendly) ────────────────────────────────
  if (audioState === "available-muted") {
    return (
      <button
        type="button"
        onClick={handleUnmute}
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        aria-label="Tap to unmute auction audio"
      >
        <SpeakerMutedIcon className="h-3.5 w-3.5 text-white/60" />
        <span style={{ fontFamily: "var(--storefront-font-mono)" }}>
          TAP TO UNMUTE
        </span>
      </button>
    );
  }

  // ── Playing — small pulsing speaker icon ────────────────────────────────
  if (audioState === "playing") {
    return (
      <button
        type="button"
        onClick={handleMute}
        className="flex items-center justify-center rounded-full p-1 text-white transition-colors hover:bg-white/10"
        aria-label="Mute auction audio"
        title="Mute audio"
      >
        {/* Pulse ring when audio is active */}
        <span className="relative flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-20" />
          <SpeakerOnIcon className="relative h-4 w-4 text-white" />
        </span>
      </button>
    );
  }

  // no-audio — grey speaker, no interaction needed
  return (
    <span className="flex items-center justify-center p-1" aria-hidden="true">
      <SpeakerMutedIcon className="h-4 w-4 text-white/30" />
    </span>
  );
}
