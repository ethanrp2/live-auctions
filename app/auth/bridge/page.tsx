"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { isRecoverableSessionAuthError } from "@/lib/supabase/auth-helpers";
import type { Session } from "@supabase/supabase-js";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

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
      if (
        event.data?.type !== "live-auctions:get-session" &&
        event.data?.type !== "live-auctions:set-session" &&
        event.data?.type !== "live-auctions:clear-session"
      ) {
        return;
      }

      let session = null;

      try {
        if (event.data?.type === "live-auctions:get-session") {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();
          session = currentSession;
        } else if (event.data?.type === "live-auctions:set-session") {
          const bridgeSession = event.data.session as
            | Pick<Session, "access_token" | "refresh_token" | "expires_at">
            | null;
          if (!bridgeSession?.access_token || !bridgeSession.refresh_token) {
            const {
              data: { session: currentSession },
            } = await supabase.auth.getSession();
            session = currentSession;
          } else {
            const result = await supabase.auth.setSession({
              access_token: bridgeSession.access_token,
              refresh_token: bridgeSession.refresh_token,
            });
            session = result.data.session;
          }
        } else {
          await supabase.auth.signOut({ scope: "local" });
          session = null;
        }
      } catch (error) {
        if (!isRecoverableSessionAuthError(error)) {
          console.warn("Failed to restore bridge session", error);
        }
        await supabase.auth.signOut({ scope: "local" });
      }

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
