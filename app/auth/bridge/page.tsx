"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const BRIDGE_SESSION_KEY = "live-auctions:bridge-session";

function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`);
  } catch {
    return false;
  }
}

export default function AuthBridgePage() {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!isAllowedOrigin(event.origin)) return;
      if (event.data?.type !== "live-auctions:get-session") return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const cachedSession = !session
        ? window.localStorage.getItem(BRIDGE_SESSION_KEY)
        : null;
      const parsedSession = cachedSession
        ? (JSON.parse(cachedSession) as {
            access_token?: string;
            refresh_token?: string;
            expires_at?: number;
          })
        : null;

      if (!event.source) return;
      (event.source as Window).postMessage(
        {
          type: "live-auctions:session",
          session: session
            ? {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
              }
            : parsedSession?.access_token && parsedSession.refresh_token
            ? parsedSession
            : null,
        },
        event.origin
      );
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [supabase]);

  return null;
}
