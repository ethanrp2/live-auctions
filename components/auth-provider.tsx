"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
const BRIDGE_SESSION_KEY = "live-auctions:bridge-session";

function readFragmentSession() {
  if (typeof window === "undefined") return null;
  if (!window.location.hash.startsWith("#la_session=")) return null;

  try {
    const encoded = window.location.hash.slice("#la_session=".length);
    const session = JSON.parse(atob(encoded)) as {
      access_token?: string;
      refresh_token?: string;
    };
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
    if (!session.access_token || !session.refresh_token) return null;
    return session;
  } catch {
    return null;
  }
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const syncFromPlatformRoot = useCallback(async () => {
    if (typeof window === "undefined") return null;

    const { hostname, port, protocol } = window.location;
    const isTenantHost =
      hostname !== ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`);
    if (!isTenantHost) return null;

    const rootOrigin = `${protocol}//${ROOT_DOMAIN}${port ? `:${port}` : ""}`;

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

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== rootOrigin) return;
        if (event.data?.type !== "live-auctions:session") return;

        cleanup();
        const bridgeSession = event.data.session as
          | Pick<Session, "access_token" | "refresh_token" | "expires_at">
          | null;
        if (!bridgeSession?.access_token || !bridgeSession.refresh_token) {
          resolve(null);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.setSession({
          access_token: bridgeSession.access_token,
          refresh_token: bridgeSession.refresh_token,
        });
        resolve(session);
      };

      window.addEventListener("message", handleMessage);
      iframe.addEventListener("load", () => {
        iframe.contentWindow?.postMessage(
          { type: "live-auctions:get-session" },
          rootOrigin
        );
      });
      document.body.appendChild(iframe);
    });
  }, [supabase]);

  const updateState = useCallback(
    (s: Session | null) => {
      if (typeof window !== "undefined" && window.location.hostname === ROOT_DOMAIN) {
        if (s) {
          window.localStorage.setItem(
            BRIDGE_SESSION_KEY,
            JSON.stringify({
              access_token: s.access_token,
              refresh_token: s.refresh_token,
              expires_at: s.expires_at,
            })
          );
        } else {
          window.localStorage.removeItem(BRIDGE_SESSION_KEY);
        }
      }
      setSession(s);
      setUser(s?.user ?? null);
    },
    []
  );

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const fragmentSession = readFragmentSession();
      const hasFragmentSession = Boolean(
        fragmentSession?.access_token && fragmentSession.refresh_token
      );
      const setFragmentSession = fragmentSession
        ? (
            await supabase.auth.setSession({
              access_token: hasFragmentSession ? fragmentSession.access_token! : "",
              refresh_token: hasFragmentSession ? fragmentSession.refresh_token! : "",
            })
          ).data.session
        : null;
      const resolvedSession =
        session ?? setFragmentSession ?? (await syncFromPlatformRoot());
      updateState(resolvedSession);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateState(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase, syncFromPlatformRoot, updateState]);

  const value = useMemo(
    () => ({ user, session, isLoading }),
    [user, session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
