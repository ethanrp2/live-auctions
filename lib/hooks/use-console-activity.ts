"use client";

/**
 * useConsoleActivity — aggregates all real-time data the seller console needs:
 *   1. Basta `saleUpdates` WS for current bid state (reuses useSaleActivity).
 *   2. Supabase Realtime on `bids` scoped to the auction (reuses useBidFeed
 *      pattern but filtered by auction_id, not lot_id, so the full feed
 *      is visible in the console's right panel).
 *   3. Supabase Realtime on `auction_questions` filtered by auction_id.
 *
 * Returns:
 *   currentBidCents  — integer cents from Basta WS with Supabase bid fallback
 *   countdownMs      — ms remaining from Basta WS (null if not in countdown)
 *   saleActivity     — full Map<itemId, SaleUpdatePayload> (all lots)
 *   bids             — BidFeedRow[] newest-first for the whole auction
 *   questions        — QuestionRow[] not yet dismissed, newest-first
 *   isConnected      — true once both Basta WS and Supabase Realtime are live
 */

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import {
  getBastaWsClient,
  subscribeSaleUpdates,
  type SaleUpdatePayload,
} from "@/lib/basta/ws";
import type { BidFeedRow } from "@/lib/hooks/use-bid-feed";

const RECENT_BID_LIMIT = 100;
const RECENT_QUESTION_LIMIT = 50;

export type { SaleUpdatePayload };

export type QuestionRow = {
  id: string;
  userId: string | null;
  displayName: string;
  questionText: string;
  createdAt: string;
  dismissed: boolean;
};

type BidsTableRow = {
  id: string;
  lot_id: string;
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

type QuestionsTableRow = {
  id: string;
  user_id: string | null;
  user_display_name: string | null;
  question_text: string;
  created_at: string;
  dismissed: boolean;
};

export interface UseConsoleActivityResult {
  currentBidCents: number | null;
  countdownMs: number | null;
  saleActivity: Map<string, SaleUpdatePayload>;
  bids: BidFeedRow[];
  questions: QuestionRow[];
  isConnected: boolean;
}

async function getSupabaseAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("No active Supabase session");
  return token;
}

function resolveDisplayName(
  userId: string | null,
  profiles: Map<string, string | null>
): string {
  if (!userId) return "Anonymous";
  const name = profiles.get(userId);
  return name && name.trim().length > 0 ? name : "Anonymous";
}

export function useConsoleActivity(
  saleId: string | null,
  auctionId: string | null,
  currentBastaItemId: string | null,
  currentLotId: string | null
): UseConsoleActivityResult {
  // ── Basta WS state ──────────────────────────────────────────────────────
  const [saleActivity, setSaleActivity] = useState<Map<string, SaleUpdatePayload>>(
    () => new Map()
  );
  const [bastaConnected, setBastaConnected] = useState(false);

  const activeSaleIdRef = useRef<string | null>(saleId);

  useEffect(() => {
    activeSaleIdRef.current = saleId;
    setSaleActivity(new Map());
    setBastaConnected(false);

    if (!saleId) return;

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
            setBastaConnected(true);
            setSaleActivity((prev) => {
              const next = new Map(prev);
              next.set(payload.itemId, payload);
              return next;
            });
          },
          error: () => {
            if (disposed || activeSaleIdRef.current !== saleId) return;
            setBastaConnected(false);
          },
          complete: () => {
            if (disposed || activeSaleIdRef.current !== saleId) return;
            setBastaConnected(false);
          },
        }
      );
    } catch {
      setBastaConnected(false);
    }

    return () => {
      disposed = true;
      try {
        unsubscribe?.();
      } catch {
        // swallow
      }
    };
  }, [saleId]);

  // Derive currentBid + countdown from the active lot's entry in saleActivity.
  const liveForCurrent = currentBastaItemId
    ? saleActivity.get(currentBastaItemId)
    : undefined;

  const countdownMs = liveForCurrent?.timeRemaining != null
    ? liveForCurrent.timeRemaining * 1000
    : null;

  // ── Supabase Realtime: bids for whole auction ────────────────────────────
  const [bids, setBids] = useState<BidFeedRow[]>([]);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const profilesRef = useRef<Map<string, string | null>>(new Map());
  const latestBidForCurrentLot = currentLotId
    ? bids.find((bid) => bid.lotId === currentLotId)
    : null;
  const currentBidCents =
    liveForCurrent?.currentBid ?? latestBidForCurrentLot?.amountCents ?? null;

  useEffect(() => {
    if (!auctionId) {
      setBids([]);
      setSupabaseConnected(false);
      profilesRef.current = new Map();
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    const profiles = new Map<string, string | null>();
    profilesRef.current = profiles;
    let bidsChannel: RealtimeChannel | null = null;

    async function bootstrapBids() {
      const { data: bidsData } = await supabase
        .from("bids")
        .select("id, lot_id, user_id, amount_cents, bid_type, reactive, placed_at")
        .eq("auction_id", auctionId)
        .order("placed_at", { ascending: false })
        .limit(RECENT_BID_LIMIT);

      if (cancelled) return;

      const seedRows = (bidsData ?? []) as BidsTableRow[];

      const userIds = Array.from(
        new Set(seedRows.map((b) => b.user_id).filter((u): u is string => !!u))
      );

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);

        if (cancelled) return;

        for (const p of (profileData ?? []) as ProfileRow[]) {
          profiles.set(p.id, p.display_name);
        }
      }

      if (cancelled) return;

      setBids(
        seedRows.map((row) => ({
          id: row.id,
          lotId: row.lot_id,
          userId: row.user_id,
          displayName: resolveDisplayName(row.user_id, profiles),
          amountCents: row.amount_cents,
          bidType: row.bid_type,
          reactive: row.reactive,
          placedAt: row.placed_at,
        }))
      );

      bidsChannel = supabase
        .channel(`console:bids:${auctionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bids",
            filter: `auction_id=eq.${auctionId}`,
          },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as BidsTableRow;
            const userId = row.user_id;

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
                        ? { ...b, displayName: resolveDisplayName(p.id, profiles) }
                        : b
                    )
                  );
                });
            }

            const next: BidFeedRow = {
              id: row.id,
              lotId: row.lot_id,
              userId,
              displayName: resolveDisplayName(userId, profiles),
              amountCents: row.amount_cents,
              bidType: row.bid_type,
              reactive: row.reactive,
              placedAt: row.placed_at,
            };

            setBids((prev) => {
              if (prev.some((b) => b.id === next.id)) return prev;
              return [next, ...prev].slice(0, RECENT_BID_LIMIT);
            });
          }
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") setSupabaseConnected(true);
          else if (
            status === "CLOSED" ||
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT"
          )
            setSupabaseConnected(false);
        });
    }

    void bootstrapBids();

    return () => {
      cancelled = true;
      setSupabaseConnected(false);
      if (bidsChannel) void supabase.removeChannel(bidsChannel);
    };
  }, [auctionId]);

  // ── Supabase Realtime: auction_questions ─────────────────────────────────
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  useEffect(() => {
    if (!auctionId) {
      setQuestions([]);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    let questionsChannel: RealtimeChannel | null = null;

    async function bootstrapQuestions() {
      const { data: qData } = await supabase
        .from("auction_questions")
        .select("id, user_id, user_display_name, question_text, created_at, dismissed")
        .eq("auction_id", auctionId)
        .eq("dismissed", false)
        .order("created_at", { ascending: false })
        .limit(RECENT_QUESTION_LIMIT);

      if (cancelled) return;

      setQuestions(
        ((qData ?? []) as QuestionsTableRow[]).map((row) => ({
          id: row.id,
          userId: row.user_id,
          displayName: row.user_display_name ?? "Anonymous",
          questionText: row.question_text,
          createdAt: row.created_at,
          dismissed: row.dismissed,
        }))
      );

      questionsChannel = supabase
        .channel(`console:questions:${auctionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "auction_questions",
            filter: `auction_id=eq.${auctionId}`,
          },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as QuestionsTableRow;
            if (row.dismissed) return;
            const next: QuestionRow = {
              id: row.id,
              userId: row.user_id,
              displayName: row.user_display_name ?? "Anonymous",
              questionText: row.question_text,
              createdAt: row.created_at,
              dismissed: row.dismissed,
            };
            setQuestions((prev) => {
              if (prev.some((q) => q.id === next.id)) return prev;
              return [next, ...prev].slice(0, RECENT_QUESTION_LIMIT);
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "auction_questions",
            filter: `auction_id=eq.${auctionId}`,
          },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as QuestionsTableRow;
            if (row.dismissed) {
              // Remove dismissed questions from the feed.
              setQuestions((prev) => prev.filter((q) => q.id !== row.id));
            }
          }
        )
        .subscribe();
    }

    void bootstrapQuestions();

    return () => {
      cancelled = true;
      if (questionsChannel) void supabase.removeChannel(questionsChannel);
    };
  }, [auctionId]);

  const isConnected = bastaConnected || supabaseConnected;

  return {
    currentBidCents,
    countdownMs,
    saleActivity,
    bids,
    questions,
    isConnected,
  };
}
