"use client";

/**
 * useSaleActivity — React hook that subscribes to Basta's `saleUpdates`
 * WebSocket for a single sale and maintains a live `Map<itemId,
 * SaleUpdatePayload>` keyed by item. Returns `{ updates, isConnected, error }`.
 * Pass `null` to pause; the subscription tears down on unmount or saleId
 * change and is safe under React strict-mode double-invoke.
 */

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  getBastaWsClient,
  subscribeSaleUpdates,
  type SaleUpdatePayload,
} from "@/lib/basta/ws";

export interface UseSaleActivityResult {
  updates: Map<string, SaleUpdatePayload>;
  isConnected: boolean;
  error: Error | null;
}

async function getSupabaseAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("No active Supabase session");
  return token;
}

export function useSaleActivity(saleId: string | null): UseSaleActivityResult {
  const [updates, setUpdates] = useState<Map<string, SaleUpdatePayload>>(
    () => new Map()
  );
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the latest saleId so stale async callbacks can detect a teardown.
  const activeSaleIdRef = useRef<string | null>(saleId);

  useEffect(() => {
    activeSaleIdRef.current = saleId;

    // Reset state whenever the target sale changes (or is cleared).
    setUpdates(new Map());
    setError(null);
    setIsConnected(false);

    if (!saleId) {
      return;
    }

    let disposed = false;

    let unsubscribe: (() => void) | null = null;

    try {
      const client = getBastaWsClient(getSupabaseAccessToken);

      unsubscribe = subscribeSaleUpdates(
        client,
        { saleId },
        {
          next: (payload) => {
            if (disposed || activeSaleIdRef.current !== saleId) return;
            setIsConnected(true);
            setUpdates((prev) => {
              const nextMap = new Map(prev);
              nextMap.set(payload.itemId, payload);
              return nextMap;
            });
          },
          error: (err) => {
            if (disposed || activeSaleIdRef.current !== saleId) return;
            setIsConnected(false);
            setError(err instanceof Error ? err : new Error(String(err)));
          },
          complete: () => {
            if (disposed || activeSaleIdRef.current !== saleId) return;
            setIsConnected(false);
          },
        }
      );
    } catch (err) {
      setIsConnected(false);
      setError(err instanceof Error ? err : new Error(String(err)));
    }

    return () => {
      disposed = true;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch {
          // swallow — teardown should never throw back into React
        }
      }
    };
  }, [saleId]);

  return { updates, isConnected, error };
}
