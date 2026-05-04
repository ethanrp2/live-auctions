"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function post(
  path: string,
  body: Record<string, unknown> = {}
): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof json === "object" && json && "error" in json
        ? String((json as { error: unknown }).error)
        : "Request failed"
    );
  }
  return json;
}

async function patch(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof json === "object" && json && "error" in json
        ? String((json as { error: unknown }).error)
        : "Request failed"
    );
  }
  return json;
}

export function useSellerActions(auctionId: string) {
  const goLive = useCallback(
    () => post(`/api/seller/auctions/${auctionId}/go-live`),
    [auctionId]
  );
  const advanceLot = useCallback(
    (nextLotId?: string) =>
      post(
        `/api/seller/auctions/${auctionId}/advance-lot`,
        nextLotId ? { nextLotId } : {}
      ),
    [auctionId]
  );
  const sellLot = useCallback(
    (lotId: string, amountCents: number, bidderUserId?: string | null) =>
      post(`/api/seller/auctions/${auctionId}/sell-lot`, {
        lotId,
        amountCents,
        bidderUserId: bidderUserId ?? null,
      }),
    [auctionId]
  );
  const passLot = useCallback(
    (lotId: string) =>
      post(`/api/seller/auctions/${auctionId}/pass-lot`, { lotId }),
    [auctionId]
  );
  const endAuction = useCallback(
    () => post(`/api/seller/auctions/${auctionId}/end`),
    [auctionId]
  );
  const dismissQuestion = useCallback(
    (questionId: string) =>
      patch(`/api/seller/questions/${questionId}/dismiss`),
    []
  );

  return { goLive, advanceLot, sellLot, passLot, endAuction, dismissQuestion };
}
