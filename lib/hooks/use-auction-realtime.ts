"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveLot, LiveAuctionData } from "@/lib/live-auction-data";

type LotUpdate = Partial<LiveLot> & { id: string };
type AuctionUpdate = Partial<LiveAuctionData["auction"]> & { id: string };

interface UseAuctionRealtimeArgs {
  initial: LiveAuctionData;
}

export function useAuctionRealtime({ initial }: UseAuctionRealtimeArgs) {
  const [auction, setAuction] = useState(initial.auction);
  const [lots, setLots] = useState(initial.lots);
  const [watchingCount, setWatchingCount] = useState(1);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setAuction(initial.auction);
    setLots(initial.lots);
  }, [initial]);

  useEffect(() => {
    const channel = supabase
      .channel(`auction:${auction.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${auction.id}`,
        },
        (payload) => {
          const next = payload.new as AuctionUpdate;
          setAuction((prev) => ({ ...prev, ...next }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lots",
          filter: `auction_id=eq.${auction.id}`,
        },
        (payload) => {
          const next = payload.new as LotUpdate;
          setLots((prev) =>
            prev.map((l) =>
              l.id === next.id
                ? ({
                    ...l,
                    ...next,
                    images: next.images ?? l.images,
                    tags: next.tags ?? l.tags,
                  } as LiveLot)
                : l
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, auction.id]);

  useEffect(() => {
    const presenceKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const channel = supabase.channel(`live:${auction.id}`, {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const count = Object.keys(channel.presenceState()).length;
        setWatchingCount(Math.max(count, 1));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ joined_at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, auction.id]);

  return { auction, lots, watchingCount };
}
