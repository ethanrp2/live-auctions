"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AuctionQuestion {
  id: string;
  tenant_id: string;
  auction_id: string;
  user_id: string;
  question_text: string;
  dismissed: boolean;
  created_at: string;
}

export function useAuctionQuestions(auctionId: string) {
  const [questions, setQuestions] = useState<AuctionQuestion[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("auction_questions")
        .select("id, tenant_id, auction_id, user_id, question_text, dismissed, created_at")
        .eq("auction_id", auctionId)
        .eq("dismissed", false)
        .order("created_at", { ascending: false });
      if (!cancelled) setQuestions((data ?? []) as AuctionQuestion[]);
    })();

    const channel = supabase
      .channel(`questions:${auctionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auction_questions",
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          const row = payload.new as AuctionQuestion;
          if (row.dismissed) return;
          setQuestions((prev) => {
            if (prev.some((q) => q.id === row.id)) return prev;
            return [row, ...prev];
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
          const row = payload.new as AuctionQuestion;
          setQuestions((prev) => {
            if (row.dismissed) return prev.filter((q) => q.id !== row.id);
            if (prev.some((q) => q.id === row.id)) {
              return prev.map((q) => (q.id === row.id ? row : q));
            }
            return [row, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, auctionId]);

  return questions;
}
