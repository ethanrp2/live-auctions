"use client";

/**
 * useBidFeed — subscribe to Supabase Realtime INSERTs on `bids` for a single lot,
 * seed with the 50 most recent bids, and return them newest-first with bidder
 * display names hydrated from `profiles`. Returns an empty feed when `lotId` is
 * null. Cleans up its channel on unmount or `lotId` change.
 */

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const RECENT_BID_LIMIT = 50;

export type BidFeedRow = {
  id: string;
  lotId?: string;
  userId: string | null;
  displayName: string;
  amountCents: number;
  bidType: "MAX" | "NORMAL";
  reactive: boolean;
  placedAt: string;
};

type BidsTableRow = {
  id: string;
  user_id: string | null;
  amount_cents: number;
  bid_type: "MAX" | "NORMAL";
  reactive: boolean;
  placed_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type UseBidFeedResult = {
  bids: BidFeedRow[];
  isConnected: boolean;
  error: Error | null;
};

function resolveDisplayName(
  userId: string | null,
  profiles: Map<string, string | null>
): string {
  if (!userId) return "Anonymous";
  const name = profiles.get(userId);
  return name && name.trim().length > 0 ? name : "Anonymous";
}

export function useBidFeed(lotId: string | null): UseBidFeedResult {
  const [bids, setBids] = useState<BidFeedRow[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Profile cache lives in a ref so realtime inserts can read the latest
  // userId -> display_name map without retriggering the effect.
  const profilesRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    if (!lotId) {
      setBids([]);
      setIsConnected(false);
      setError(null);
      profilesRef.current = new Map();
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    const profiles = new Map<string, string | null>();
    profilesRef.current = profiles;
    let channel: RealtimeChannel | null = null;

    async function bootstrap() {
      // 1. Seed with the most recent N bids for this lot.
      const { data: bidsData, error: bidsError } = await supabase
        .from("bids")
        .select(
          "id, user_id, amount_cents, bid_type, reactive, placed_at"
        )
        .eq("lot_id", lotId)
        .order("placed_at", { ascending: false })
        .limit(RECENT_BID_LIMIT);

      if (cancelled) return;

      if (bidsError) {
        setError(new Error(bidsError.message));
        return;
      }

      const seedRows = (bidsData ?? []) as BidsTableRow[];

      // 2. Hydrate display names via a separate profiles query.
      // bids.user_id FKs auth.users(id), not public.profiles, so PostgREST
      // FK-embed against profiles isn't available — we look them up explicitly.
      const userIds = Array.from(
        new Set(
          seedRows
            .map((b) => b.user_id)
            .filter((u): u is string => !!u)
        )
      );

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (cancelled) return;

        if (profileError) {
          setError(new Error(profileError.message));
          // Don't bail — we can still render the feed with "Anonymous".
        } else {
          for (const p of (profileData ?? []) as ProfileRow[]) {
            profiles.set(p.id, p.display_name);
          }
        }
      }

      setBids(
        seedRows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          displayName: resolveDisplayName(row.user_id, profiles),
          amountCents: row.amount_cents,
          bidType: row.bid_type,
          reactive: row.reactive,
          placedAt: row.placed_at,
        }))
      );

      if (cancelled) return;

      // 3. Subscribe to realtime INSERTs scoped to this lot.
      channel = supabase
        .channel(`bids:lot:${lotId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bids",
            filter: `lot_id=eq.${lotId}`,
          },
          (payload) => {
            const row = payload.new as BidsTableRow;
            const userId = row.user_id;

            // If this bidder's profile isn't cached, fire a lazy lookup.
            // Until it resolves the row renders as "Anonymous", then gets
            // rewritten in place when the name arrives.
            if (userId && !profiles.has(userId)) {
              profiles.set(userId, null);
              void supabase
                .from("profiles")
                .select("id, display_name")
                .eq("id", userId)
                .maybeSingle()
                .then(({ data }) => {
                  if (cancelled || !data) return;
                  const p = data as ProfileRow;
                  profiles.set(p.id, p.display_name);
                  setBids((prev) =>
                    prev.map((b) =>
                      b.userId === p.id
                        ? {
                            ...b,
                            displayName: resolveDisplayName(p.id, profiles),
                          }
                        : b
                    )
                  );
                });
            }

            const next: BidFeedRow = {
              id: row.id,
              userId,
              displayName: resolveDisplayName(userId, profiles),
              amountCents: row.amount_cents,
              bidType: row.bid_type,
              reactive: row.reactive,
              placedAt: row.placed_at,
            };

            setBids((prev) => {
              // Guard against duplicate deliveries (seed + realtime overlap).
              if (prev.some((b) => b.id === next.id)) return prev;
              return [next, ...prev].slice(0, RECENT_BID_LIMIT);
            });
          }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
          } else if (
            status === "CLOSED" ||
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          ) {
            setIsConnected(false);
          }
        });
    }

    void bootstrap();

    return () => {
      cancelled = true;
      setIsConnected(false);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [lotId]);

  return { bids, isConnected, error };
}
