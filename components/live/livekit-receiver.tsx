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
  type RemoteTrackPublication,
  type Participant,
} from "livekit-client";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

type ConnectionState = "connecting" | "connected" | "error";

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
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [sellerMuted, setSellerMuted] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const soundOnRef = useRef(false);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const getAudioElement = useCallback(() => {
    if (audioElRef.current) return audioElRef.current;
    const el = document.createElement("audio");
    el.autoplay = true;
    el.muted = !soundOnRef.current;
    document.body.appendChild(el);
    audioElRef.current = el;
    return el;
  }, []);

  const startPlayback = useCallback(async () => {
    const room = roomRef.current;
    const el = audioElRef.current;
    if (!room || !el) return;

    try {
      await room.startAudio();
      el.muted = false;
      await el.play();
      setPlaybackBlocked(false);
    } catch {
      setPlaybackBlocked(true);
    }
  }, []);

  const attachRemoteAudio = useCallback(
    (track: RemoteTrack, publication: RemoteTrackPublication) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = getAudioElement();
      track.attach(el);
      el.muted = !soundOnRef.current;
      setHasRemoteAudio(true);
      setSellerMuted(publication.isMuted);
      if (soundOnRef.current) {
        void startPlayback();
      }
    },
    [getAudioElement, startPlayback]
  );

  const detachRemoteAudio = useCallback((track?: RemoteTrack) => {
    if (track && audioElRef.current) {
      track.detach(audioElRef.current);
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
    }
    setHasRemoteAudio(false);
    setSellerMuted(false);
  }, []);

  const syncExistingAudio = useCallback(() => {
    roomRef.current?.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.kind !== Track.Kind.Audio) return;
        if (publication.track) {
          attachRemoteAudio(publication.track, publication);
        } else {
          publication.setSubscribed(true);
        }
      });
    });
  }, [attachRemoteAudio]);

  // Connect on mount; disconnect on unmount
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const supabaseToken = await getAccessToken();
        if (cancelled) return;

        const res = await fetch(`${BACKEND_URL}/api/livekit-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(supabaseToken
              ? { Authorization: `Bearer ${supabaseToken}` }
              : {}),
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
          (track: RemoteTrack, publication: RemoteTrackPublication) =>
            attachRemoteAudio(track, publication)
        );

        room.on(
          RoomEvent.TrackPublished,
          (publication: RemoteTrackPublication) => {
            if (publication.kind === Track.Kind.Audio) {
              publication.setSubscribed(true);
            }
          }
        );

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) {
            detachRemoteAudio(track);
          }
        });

        room.on(
          RoomEvent.TrackMuted,
          (publication, participant: Participant) => {
            if (
              publication.kind === Track.Kind.Audio &&
              participant !== room.localParticipant
            ) {
              setSellerMuted(true);
            }
          }
        );

        room.on(
          RoomEvent.TrackUnmuted,
          (publication, participant: Participant) => {
            if (
              publication.kind === Track.Kind.Audio &&
              participant !== room.localParticipant
            ) {
              setSellerMuted(false);
              if (soundOnRef.current) {
                void startPlayback();
              }
            }
          }
        );

        room.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => {
          setPlaybackBlocked(!playing && soundOnRef.current);
        });

        room.on(RoomEvent.Disconnected, () => {
          setConnectionState("connecting");
          setHasRemoteAudio(false);
          setSellerMuted(false);
        });

        await room.connect(livekitUrl, token, { autoSubscribe: true });

        if (!cancelled) {
          setConnectionState("connected");
          syncExistingAudio();
        }
      } catch {
        if (!cancelled) {
          setConnectionState("error");
        }
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
  }, [
    attachRemoteAudio,
    auctionId,
    detachRemoteAudio,
    startPlayback,
    syncExistingAudio,
  ]);

  const handleSoundOn = useCallback(async () => {
    setSoundOn(true);
    const el = getAudioElement();
    el.muted = false;
    if (hasRemoteAudio) {
      await startPlayback();
    } else if (roomRef.current) {
      try {
        await roomRef.current.startAudio();
        setPlaybackBlocked(false);
      } catch {
        setPlaybackBlocked(true);
      }
    }
  }, [getAudioElement, hasRemoteAudio, startPlayback]);

  const handleSoundOff = useCallback(() => {
    setSoundOn(false);
    setPlaybackBlocked(false);
    if (audioElRef.current) {
      audioElRef.current.muted = true;
      audioElRef.current.pause();
    }
  }, []);

  if (connectionState === "connecting") {
    return (
      <span
        className="flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase tracking-widest text-white/30 sm:px-3"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <SpeakerMutedIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Audio</span>
      </span>
    );
  }

  if (connectionState === "error") {
    return (
      <span
        className="flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase tracking-widest text-white/35 sm:px-3"
        title="Live audio is unavailable"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        <SpeakerMutedIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Audio off</span>
      </span>
    );
  }

  // ── Tap-to-unmute overlay (iOS-friendly) ────────────────────────────────
  if (!soundOn) {
    return (
      <button
        type="button"
        onClick={handleSoundOn}
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[11px] uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:px-3"
        aria-label="Turn auction audio on"
        aria-pressed="false"
      >
        <SpeakerMutedIcon className="h-3.5 w-3.5 text-white/60" />
        <span
          className="hidden sm:inline"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          Sound off
        </span>
      </button>
    );
  }

  // ── Playing — small pulsing speaker icon ────────────────────────────────
  return (
    <button
      type="button"
      onClick={handleSoundOff}
      className="flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[11px] uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:px-3"
      aria-label="Turn auction audio off"
      aria-pressed="true"
      title={
        sellerMuted
          ? "Seller microphone is muted"
          : playbackBlocked
            ? "Tap to allow audio playback"
            : hasRemoteAudio
              ? "Turn sound off"
              : "Sound will play when the seller goes live"
      }
    >
      <span className="relative flex h-3.5 w-3.5 items-center justify-center">
        {hasRemoteAudio && !sellerMuted && !playbackBlocked ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-20" />
        ) : null}
        <SpeakerOnIcon className="relative h-3.5 w-3.5 text-white" />
      </span>
      <span
        className="hidden sm:inline"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {sellerMuted
          ? "Seller muted"
          : playbackBlocked
            ? "Tap sound"
            : hasRemoteAudio
              ? "Sound on"
              : "Audio ready"}
      </span>
    </button>
  );
}
