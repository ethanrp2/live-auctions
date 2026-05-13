"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isRecoverableSessionAuthError } from "@/lib/supabase/auth-helpers";
import { requestRootSession } from "@/lib/supabase/session-bridge";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

function readFragmentSession() {
  if (typeof window === "undefined") return null;
  if (
    !window.location.hash.startsWith("#la_session=") &&
    !window.location.hash.includes("access_token=")
  ) {
    return null;
  }

  try {
    if (window.location.hash.includes("access_token=")) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const session = {
        access_token: params.get("access_token") ?? undefined,
        refresh_token: params.get("refresh_token") ?? undefined,
      };
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
      if (!session.access_token || !session.refresh_token) return null;
      return session;
    }

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

function isTenantHost() {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname !== ROOT_DOMAIN && hostname.endsWith(`.${ROOT_DOMAIN}`);
}

function sessionsMatch(a: Session | null, b: Session | null) {
  return (
    a?.access_token === b?.access_token &&
    a?.refresh_token === b?.refresh_token &&
    a?.expires_at === b?.expires_at
  );
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

  const clearLocalSession = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
  }, [supabase]);

  const syncFromPlatformRoot = useCallback(async () => {
    if (!isTenantHost()) return null;

    try {
      const rootSession = await requestRootSession("get");
      if (!rootSession?.access_token || !rootSession.refresh_token) {
        await clearLocalSession();
        return null;
      }

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (sessionsMatch(currentSession, rootSession)) {
        return currentSession;
      }

      const {
        data: { session: updatedSession },
      } = await supabase.auth.setSession({
        access_token: rootSession.access_token,
        refresh_token: rootSession.refresh_token,
      });
      return updatedSession;
    } catch (error) {
      if (!isRecoverableSessionAuthError(error)) {
        console.warn("Failed to sync auth session from platform root", error);
      }
      await clearLocalSession();
      return null;
    }
  }, [clearLocalSession, supabase]);

  const updateState = useCallback((s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const fragmentSession = readFragmentSession();
        let resolvedSession: Session | null = null;

        if (fragmentSession?.access_token && fragmentSession.refresh_token) {
          const result = await supabase.auth.setSession({
            access_token: fragmentSession.access_token,
            refresh_token: fragmentSession.refresh_token,
          });
          resolvedSession = result.data.session;
          if (isTenantHost()) {
            void requestRootSession("set", resolvedSession);
          }
        } else if (isTenantHost()) {
          resolvedSession = await syncFromPlatformRoot();
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          resolvedSession = session;
        }

        updateState(resolvedSession);
      } catch (error) {
        if (!isRecoverableSessionAuthError(error)) {
          console.warn("Failed to restore auth session", error);
        }
        await clearLocalSession();
        updateState(null);
      } finally {
        setIsLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      updateState(session);
      if (isTenantHost() && (event === "SIGNED_IN" || event === "SIGNED_OUT")) {
        void requestRootSession(session ? "set" : "clear", session);
      }
    });

    return () => subscription.unsubscribe();
  }, [clearLocalSession, supabase, syncFromPlatformRoot, updateState]);

  const value = useMemo(
    () => ({ user, session, isLoading }),
    [user, session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
