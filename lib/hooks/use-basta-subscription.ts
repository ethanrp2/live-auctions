"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type Client } from "graphql-ws";
import { getBastaToken } from "@/lib/basta-token";

const BASTA_CLIENT_WS_URL =
  process.env.NEXT_PUBLIC_BASTA_CLIENT_WS_URL ??
  "wss://client.api.basta.app/query";

export interface BastaItemState {
  currentBid: number | null;
  bidCount: number | null;
  status: string | null;
  timeRemaining: number | null;
  isWinning: boolean | null;
  myMaxBid: number | null;
}

export interface BastaLiveBid {
  amount: number;
  userId: string | null;
  placedAt: string;
}

interface UseBastaSubscriptionArgs {
  saleId: string | null;
  itemId: string | null;
  supabaseAccessToken: string | null;
}

const INITIAL_STATE: BastaItemState = {
  currentBid: null,
  bidCount: null,
  status: null,
  timeRemaining: null,
  isWinning: null,
  myMaxBid: null,
};

const ITEM_UPDATES_QUERY = /* GraphQL */ `
  subscription ItemUpdates($saleId: ID!, $itemId: ID!) {
    itemUpdates(saleId: $saleId, itemId: $itemId) {
      itemId
      currentBid
      bidCount
      status
      timeRemaining
      myBidStatus {
        isWinning
        maxBid
      }
    }
  }
`;

export function useBastaSubscription({
  saleId,
  itemId,
  supabaseAccessToken,
}: UseBastaSubscriptionArgs) {
  const [state, setState] = useState<BastaItemState>(INITIAL_STATE);
  const [sessionBids, setSessionBids] = useState<BastaLiveBid[]>([]);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const prevBidRef = useRef<number | null>(null);

  useEffect(() => {
    if (!saleId || !itemId) return;

    let cancelled = false;

    const client = createClient({
      url: BASTA_CLIENT_WS_URL,
      connectionParams: async () => {
        if (!supabaseAccessToken) return {};
        try {
          const token = await getBastaToken(supabaseAccessToken);
          return { token };
        } catch {
          return {};
        }
      },
      retryAttempts: Infinity,
      shouldRetry: () => true,
    });

    clientRef.current = client;

    const unsub = client.subscribe(
      { query: ITEM_UPDATES_QUERY, variables: { saleId, itemId } },
      {
        next: (msg) => {
          if (cancelled) return;
          const data = msg.data as
            | { itemUpdates?: Record<string, unknown> }
            | null
            | undefined;
          const upd = data?.itemUpdates;
          if (!upd) return;
          const currentBid =
            typeof upd.currentBid === "number" ? upd.currentBid : null;
          const bidCount =
            typeof upd.bidCount === "number" ? upd.bidCount : null;
          const status = typeof upd.status === "string" ? upd.status : null;
          const timeRemaining =
            typeof upd.timeRemaining === "number" ? upd.timeRemaining : null;
          const myBid = upd.myBidStatus as
            | { isWinning?: boolean; maxBid?: number | null }
            | undefined
            | null;

          setState({
            currentBid,
            bidCount,
            status,
            timeRemaining,
            isWinning: myBid?.isWinning ?? null,
            myMaxBid: typeof myBid?.maxBid === "number" ? myBid.maxBid : null,
          });
          setConnected(true);

          if (currentBid != null && currentBid !== prevBidRef.current) {
            prevBidRef.current = currentBid;
            setSessionBids((prev) => [
              {
                amount: currentBid,
                userId: null,
                placedAt: new Date().toISOString(),
              },
              ...prev,
            ]);
          }
        },
        error: () => {
          if (cancelled) return;
          setConnected(false);
        },
        complete: () => {
          if (cancelled) return;
          setConnected(false);
        },
      }
    );

    return () => {
      cancelled = true;
      unsub();
      client.dispose();
      clientRef.current = null;
      prevBidRef.current = null;
      setSessionBids([]);
      setState(INITIAL_STATE);
      setConnected(false);
    };
  }, [saleId, itemId, supabaseAccessToken]);

  return { state, sessionBids, connected };
}
