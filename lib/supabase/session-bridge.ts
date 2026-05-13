"use client";

import type { Session } from "@supabase/supabase-js";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

export type BridgeAction = "get" | "set" | "clear";

export type BridgeSession = Pick<Session, "access_token" | "refresh_token" | "expires_at">;

function isTenantHost(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname !== ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`);
}

function getRootOrigin(): string | null {
  if (typeof window === "undefined" || !isTenantHost()) return null;

  const { protocol, port } = window.location;
  return `${protocol}//${ROOT_DOMAIN}${port ? `:${port}` : ""}`;
}

function serializeSession(session: Session | null): BridgeSession | null {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
}

export async function requestRootSession(
  action: BridgeAction,
  session: Session | null = null
): Promise<Session | null> {
  const rootOrigin = getRootOrigin();
  if (!rootOrigin) return session;

  return new Promise<Session | null>((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.src = `${rootOrigin}/auth/bridge`;
    iframe.hidden = true;
    iframe.setAttribute("aria-hidden", "true");

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 3000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      iframe.remove();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== rootOrigin) return;
      if (event.data?.type !== "live-auctions:session") return;

      cleanup();
      const bridgeSession = event.data.session as BridgeSession | null;
      if (!bridgeSession?.access_token || !bridgeSession.refresh_token) {
        resolve(null);
        return;
      }

      resolve({
        access_token: bridgeSession.access_token,
        refresh_token: bridgeSession.refresh_token,
        expires_at: bridgeSession.expires_at,
      } as Session);
    };

    window.addEventListener("message", handleMessage);
    iframe.addEventListener("load", () => {
      iframe.contentWindow?.postMessage(
        {
          type:
            action === "get"
              ? "live-auctions:get-session"
              : action === "set"
                ? "live-auctions:set-session"
                : "live-auctions:clear-session",
          session: serializeSession(session),
        },
        rootOrigin
      );
    });
    document.body.appendChild(iframe);
  });
}
