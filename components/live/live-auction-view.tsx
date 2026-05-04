"use client";
"use no memo";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Tenant } from "@/lib/tenant";
import type { LiveAuctionData, LiveLot } from "@/lib/live-auction-data";
import { resolveFontVars } from "@/lib/storefront-fonts";
import { getBadgeTextColor } from "@/lib/color";
import { getBastaToken } from "@/lib/basta-token";
import { createClient } from "@/lib/supabase/client";
import { useAuctionRealtime } from "@/lib/hooks/use-auction-realtime";
import { useBastaSubscription } from "@/lib/hooks/use-basta-subscription";
import { nextIncrement } from "@/lib/bid-increments";
import { AuthModal } from "@/components/storefront/auth-modal";
import { LiveHeader } from "./live-header";
import { LotQueueRibbon } from "./lot-queue-ribbon";
import { LiveLotMedia } from "./live-lot-media";
import { LiveLotInfo } from "./live-lot-info";
import { CurrentBidDisplay } from "./current-bid-display";
import { BidControls, type BidControlMode } from "./bid-controls";
import { MyBidBanner, type BannerKind } from "./my-bid-banner";
import { BidHistoryPreview } from "./bid-history-preview";
import { CustomBidModal } from "./modals/custom-bid-modal";
import { AskQuestionModal } from "./modals/ask-question-modal";
import { LiveBidsModal } from "./modals/live-bids-modal";

const BASTA_CLIENT_HTTP_URL =
  process.env.NEXT_PUBLIC_BASTA_CLIENT_URL ??
  "https://client.api.basta.app/graphql";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const BID_ON_ITEM = /* GraphQL */ `
  mutation BidOnItem($saleId: ID!, $itemId: ID!, $amount: Int!, $type: BidType!) {
    bidOnItem(saleId: $saleId, itemId: $itemId, amount: $amount, type: $type) {
      __typename
      ... on BidPlacedSuccess {
        amount
        bidStatus
      }
      ... on BidPlacedError {
        errorCode
        error
      }
    }
  }
`;

interface LiveAuctionViewProps {
  tenant: Tenant;
  user: User | null;
  initial: LiveAuctionData;
  initialLotId?: string | null;
}

type ModalState = "none" | "auth" | "custom-bid" | "ask-question" | "live-bids";

function pickCurrentLot(
  lots: LiveLot[],
  currentLotId: string | null
): LiveLot | null {
  if (currentLotId) {
    const hit = lots.find((l) => l.id === currentLotId);
    if (hit) return hit;
  }
  return (
    lots.find((l) => l.live_status !== "sold" && l.live_status !== "passed") ??
    lots[0] ??
    null
  );
}

export function LiveAuctionView({
  tenant,
  user,
  initial,
  initialLotId,
}: LiveAuctionViewProps) {
  const { auction, lots, watchingCount } = useAuctionRealtime({ initial });
  const [muted, setMuted] = useState(true);
  const [modal, setModal] = useState<ModalState>("none");
  const [focusLotId, setFocusLotId] = useState<string | null>(
    initialLotId ?? null
  );
  const [bidError, setBidError] = useState<string | null>(null);

  const currentLot = useMemo(
    () => pickCurrentLot(lots, auction.current_lot_id),
    [lots, auction.current_lot_id]
  );

  const [supabaseAccessToken, setSupabaseAccessToken] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!user || supabaseAccessToken) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSupabaseAccessToken(data.session?.access_token ?? null);
    });
  }, [user, supabaseAccessToken]);

  const ensureAccessToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    if (supabaseAccessToken) return supabaseAccessToken;
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    setSupabaseAccessToken(token);
    return token;
  }, [user, supabaseAccessToken]);

  const { state: bastaState, sessionBids } = useBastaSubscription({
    saleId: auction.basta_sale_id,
    itemId: currentLot?.basta_item_id ?? null,
    supabaseAccessToken,
  });

  const minimumBidCents = useMemo(() => {
    const currentBid =
      bastaState.currentBid ?? currentLot?.starting_bid ?? 0;
    return nextIncrement(currentBid);
  }, [bastaState.currentBid, currentLot?.starting_bid]);

  const placeBid = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    async (amountCents: number) => {
      if (!auction.basta_sale_id || !currentLot?.basta_item_id) {
        throw new Error("Lot is not yet published to Basta");
      }
      const accessToken = await ensureAccessToken();
      if (!accessToken) {
        throw new Error("Sign in required to bid");
      }
      const bidderToken = await getBastaToken(accessToken);
      const res = await fetch(BASTA_CLIENT_HTTP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bidderToken}`,
        },
        body: JSON.stringify({
          query: BID_ON_ITEM,
          variables: {
            saleId: auction.basta_sale_id,
            itemId: currentLot.basta_item_id,
            amount: amountCents,
            type: "MAX",
          },
        }),
      });
      const json = await res.json();
      const result = json.data?.bidOnItem;
      if (!result) throw new Error(json.errors?.[0]?.message ?? "Bid failed");
      if (result.__typename === "BidPlacedError") {
        throw new Error(result.error || result.errorCode || "Bid rejected");
      }
    },
    [auction.basta_sale_id, currentLot?.basta_item_id, ensureAccessToken]
  );

  const submitQuestion = useCallback(
    async (questionText: string) => {
      const accessToken = await ensureAccessToken();
      if (!accessToken) throw new Error("Sign in required");
      const res = await fetch(`${BACKEND_URL}/api/buyer/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          auctionId: auction.id,
          questionText,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to send question");
      }
    },
    [auction.id, ensureAccessToken]
  );

  const handlePrimaryBid = useCallback(async () => {
    if (!user) {
      setModal("auth");
      return;
    }
    setBidError(null);
    try {
      await placeBid(minimumBidCents);
    } catch (err) {
      setBidError(err instanceof Error ? err.message : "Bid failed");
    }
  }, [user, placeBid, minimumBidCents]);

  const handleCustomOpen = useCallback(() => {
    if (!user) {
      setModal("auth");
      return;
    }
    setModal("custom-bid");
  }, [user]);

  const handleAskOpen = useCallback(() => {
    if (!user) {
      setModal("auth");
      return;
    }
    setModal("ask-question");
  }, [user]);

  const handleNextLot = useCallback(() => {
    if (!currentLot) return;
    const idx = lots.findIndex((l) => l.id === currentLot.id);
    const next = lots
      .slice(idx + 1)
      .find((l) => l.live_status !== "sold" && l.live_status !== "passed");
    if (next) setFocusLotId(next.id);
  }, [currentLot, lots]);

  const primary = tenant.brand_colors?.primary ?? "#000000";
  const { display: fontDisplay, mono: fontMono } = resolveFontVars(tenant);
  const badgeText = getBadgeTextColor(primary);

  const lotIndex = currentLot ? lots.findIndex((l) => l.id === currentLot.id) : 0;

  const reserveMet =
    currentLot?.reserve != null &&
    bastaState.currentBid != null &&
    bastaState.currentBid >= currentLot.reserve;

  const banner: BannerKind | null = (() => {
    if (!currentLot) return null;
    if (currentLot.live_status === "sold") {
      if (user && currentLot.winner_user_id === user.id) return "won";
      return "sold-to-other";
    }
    if (currentLot.live_status === "passed") return "passed";
    if (!user) return null;
    if (bastaState.isWinning === true) return "winning";
    if (bastaState.isWinning === false) return "outbid";
    return null;
  })();

  const controlMode: BidControlMode = (() => {
    if (!currentLot) return "closed";
    if (currentLot.live_status === "sold" || currentLot.live_status === "passed") {
      return "closed";
    }
    if (!user) return "bid";
    if (bastaState.isWinning === true) return "winning";
    if (bastaState.isWinning === false) return "outbid";
    return "bid";
  })();

  const winnerHandle = currentLot?.winner_user_id
    ? currentLot.winner_user_id.slice(0, 6)
    : null;

  const lotThumbnail =
    currentLot && currentLot.images.length > 0 ? currentLot.images[0] : null;

  const scrollBody = currentLot ? (
    <>
      <LiveLotInfo
        lot={currentLot}
        lotIndex={lotIndex}
        totalLots={lots.length}
        reserveMet={reserveMet}
      />
      <div className="mt-6">
        <BidHistoryPreview
          bids={sessionBids}
          totalBidCount={bastaState.bidCount}
          myUserId={user?.id ?? null}
          onViewAll={() => setModal("live-bids")}
        />
      </div>
    </>
  ) : null;

  const pinnedPanel = currentLot ? (
    <div className="flex flex-col">
      {banner && (
        <MyBidBanner
          kind={banner}
          myBidAmountCents={bastaState.myMaxBid}
          winnerHandle={winnerHandle}
        />
      )}
      <div className="flex flex-col gap-3 px-5 py-4">
        <CurrentBidDisplay
          currentBidCents={bastaState.currentBid}
          startingBidCents={currentLot.starting_bid}
          timeRemaining={bastaState.timeRemaining}
          bidCount={bastaState.bidCount}
        />
        {bidError && (
          <p className="text-xs text-[#dc2626]" style={{ fontFamily: fontMono }}>
            {bidError}
          </p>
        )}
        <BidControls
          mode={controlMode}
          nextBidAmountCents={minimumBidCents}
          onBid={handlePrimaryBid}
          onCustom={handleCustomOpen}
          onNextLot={handleNextLot}
        />
        <p
          className="text-center text-[10px] tracking-[-0.02em] text-[#9c9c9c]"
          style={{ fontFamily: fontMono }}
        >
          By bidding you agree to the Terms of Sale.
        </p>
      </div>
    </div>
  ) : null;

  return (
    <div
      className="flex h-screen flex-col bg-white"
      style={
        {
          "--storefront-primary": primary,
          "--storefront-font-display": fontDisplay,
          "--storefront-font-mono": fontMono,
          "--storefront-badge-text": badgeText,
        } as React.CSSProperties
      }
    >
      <LiveHeader
        user={user}
        watchingCount={watchingCount}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onOpenAuth={() => setModal("auth")}
      />

      <LotQueueRibbon
        lots={lots}
        currentLotId={currentLot?.id ?? null}
        focusLotId={focusLotId}
        onSelect={setFocusLotId}
      />

      {!currentLot ? (
        <div className="flex flex-1 items-center justify-center">
          <p
            className="text-sm text-[#9c9c9c]"
            style={{ fontFamily: fontMono }}
          >
            No lots in this auction.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: single scroll region containing media + info + history */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:hidden">
            <div className="aspect-square w-full shrink-0">
              <LiveLotMedia lot={currentLot} onAskQuestion={handleAskOpen} />
            </div>
            <div className="px-5 py-6">{scrollBody}</div>
          </div>

          {/* Desktop: two-column layout with right-column pinned panel */}
          <div className="hidden min-h-0 flex-1 lg:flex lg:overflow-hidden">
            <div className="h-full w-[62.5%]">
              <LiveLotMedia lot={currentLot} onAskQuestion={handleAskOpen} />
            </div>
            <div className="flex h-full w-[37.5%] flex-col border-l border-[#f3f3f3]">
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {scrollBody}
              </div>
              <div className="shrink-0 border-t border-[#f3f3f3]">
                {pinnedPanel}
              </div>
            </div>
          </div>

          {/* Mobile pinned bid panel */}
          <div className="shrink-0 border-t border-[#f3f3f3] bg-white lg:hidden">
            {pinnedPanel}
          </div>
        </>
      )}

      <AuthModal
        isOpen={modal === "auth"}
        onClose={() => setModal("none")}
      />
      <CustomBidModal
        isOpen={modal === "custom-bid"}
        minimumCents={minimumBidCents}
        lotTitle={currentLot?.title ?? ""}
        lotThumbnail={lotThumbnail}
        timeRemaining={bastaState.timeRemaining}
        onClose={() => setModal("none")}
        onSubmit={async (amountCents) => {
          await placeBid(amountCents);
          setModal("none");
        }}
      />
      <AskQuestionModal
        isOpen={modal === "ask-question"}
        onClose={() => setModal("none")}
        onSubmit={async (text) => {
          await submitQuestion(text);
          setModal("none");
        }}
      />
      <LiveBidsModal
        isOpen={modal === "live-bids"}
        bids={sessionBids}
        myUserId={user?.id ?? null}
        onClose={() => setModal("none")}
      />
    </div>
  );
}
