"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isRecoverableSessionAuthError } from "@/lib/supabase/auth-helpers";
import {
  requestRootSession,
  shouldUseLocalSessionBridge,
} from "@/lib/supabase/session-bridge";

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
  const shouldSkipNextLocalBridgeSync = useRef(false);

  const clearLocalSession = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
  }, [supabase]);

  const getAuthenticatedUser = useCallback(async () => {
    const {
      data: { user: authenticatedUser },
    } = await supabase.auth.getUser();
    return authenticatedUser;
  }, [supabase]);

  const getLocalSession = useCallback(async () => {
    try {
      const {
        data: { session: localSession },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        if (!isRecoverableSessionAuthError(error)) {
          console.warn("Failed to get local session", error);
        }
        await supabase.auth.signOut({ scope: "local" });
        return null;
      }
      return localSession;
    } catch (error) {
      if (!isRecoverableSessionAuthError(error)) {
        console.warn("Failed to get local session", error);
      }
      await supabase.auth.signOut({ scope: "local" });
      return null;
    }
  }, [supabase]);

  const syncFromPlatformRoot = useCallback(async () => {
    if (!shouldUseLocalSessionBridge()) return null;

    try {
      const rootSession = await requestRootSession("get");
      if (!rootSession?.access_token || !rootSession.refresh_token) {
        await clearLocalSession();
        return null;
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

  const updateState = useCallback((s: Session | null, authenticatedUser: User | null) => {
    setSession(s);
    setUser(authenticatedUser);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const fragmentSession = readFragmentSession();
        let resolvedSession: Session | null = null;

        if (fragmentSession?.access_token && fragmentSession.refresh_token) {
          shouldSkipNextLocalBridgeSync.current = shouldUseLocalSessionBridge();
          const result = await supabase.auth.setSession({
            access_token: fragmentSession.access_token,
            refresh_token: fragmentSession.refresh_token,
          });
          resolvedSession = result.data.session;
        } else if (shouldUseLocalSessionBridge()) {
          resolvedSession = await getLocalSession();
          if (!resolvedSession) {
            resolvedSession = await syncFromPlatformRoot();
          }
        } else {
          resolvedSession = await getLocalSession();
        }

        const authenticatedUser = resolvedSession
          ? await getAuthenticatedUser()
          : null;

        updateState(resolvedSession, authenticatedUser);
      } catch (error) {
        if (!isRecoverableSessionAuthError(error)) {
          console.warn("Failed to restore auth session", error);
        }
        await clearLocalSession();
        updateState(null, null);
      } finally {
        setIsLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void (async () => {
        const authenticatedUser =
          event === "SIGNED_OUT" || !session ? null : await getAuthenticatedUser();
        updateState(session, authenticatedUser);
      })();

      if (!shouldUseLocalSessionBridge()) return;

      if (event === "SIGNED_IN" && shouldSkipNextLocalBridgeSync.current) {
        shouldSkipNextLocalBridgeSync.current = false;
        return;
      }

      if (event === "SIGNED_OUT") {
        void requestRootSession("clear");
      }
    });

    return () => subscription.unsubscribe();
  }, [
    clearLocalSession,
    getAuthenticatedUser,
    getLocalSession,
    supabase,
    syncFromPlatformRoot,
    updateState,
  ]);

  const value = useMemo(
    () => ({ user, session, isLoading }),
    [user, session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
