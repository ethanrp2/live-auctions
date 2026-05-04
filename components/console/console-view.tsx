"use client";
"use no memo";

import { useCallback, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Tenant } from "@/lib/tenant";
import type { LiveAuctionData, LiveLot } from "@/lib/live-auction-data";
import { resolveFontVars } from "@/lib/storefront-fonts";
import { getBadgeTextColor } from "@/lib/color";
import { useAuctionRealtime } from "@/lib/hooks/use-auction-realtime";
import { useBastaSubscription } from "@/lib/hooks/use-basta-subscription";
import { useSellerActions } from "@/lib/hooks/use-seller-actions";
import { useAuctionQuestions } from "@/lib/hooks/use-auction-questions";
import { ImageCarousel } from "@/components/storefront/image-carousel";
import { ConsoleHeader } from "./console-header";
import { LotQueueSidebar } from "./lot-queue-sidebar";
import { ConsoleLotInfo } from "./console-lot-info";
import { SellerCurrentBid } from "./seller-current-bid";
import { BidIncrementsSelector } from "./bid-increments-selector";
import { SellPassControls } from "./sell-pass-controls";
import { BuyerQuestionsFeed } from "./buyer-questions-feed";
import { ConsoleLiveBids } from "./console-live-bids";
import { ConfirmActionModal } from "./modals/confirm-action-modal";

interface ConsoleViewProps {
  tenant: Tenant;
  user: User;
  initial: LiveAuctionData;
  accessToken: string;
}

const INCREMENT_OPTIONS_CENTS = [5000, 10000, 20000, 25000];

type Modal = "none" | "confirm-pass" | "confirm-end";

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

export function ConsoleView({
  tenant,
  user,
  initial,
  accessToken,
}: ConsoleViewProps) {
  const { auction, lots, watchingCount } = useAuctionRealtime({ initial });
  const [muted, setMuted] = useState(true);
  const [modal, setModal] = useState<Modal>("none");
  const [increment, setIncrement] = useState<number>(INCREMENT_OPTIONS_CENTS[3]);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentLot = useMemo(
    () => pickCurrentLot(lots, auction.current_lot_id),
    [lots, auction.current_lot_id]
  );

  const { state: bastaState, sessionBids } = useBastaSubscription({
    saleId: auction.basta_sale_id,
    itemId: currentLot?.basta_item_id ?? null,
    supabaseAccessToken: accessToken,
  });

  const actions = useSellerActions(auction.id);
  const questions = useAuctionQuestions(auction.id);

  const handleSell = useCallback(async () => {
    if (!currentLot || !bastaState.currentBid) return;
    setActionError(null);
    try {
      await actions.sellLot(currentLot.id, bastaState.currentBid, null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Sell failed");
    }
  }, [actions, currentLot, bastaState.currentBid]);

  const handlePassConfirm = useCallback(async () => {
    if (!currentLot) return;
    await actions.passLot(currentLot.id);
    setModal("none");
  }, [actions, currentLot]);

  const handleNextLot = useCallback(async () => {
    setActionError(null);
    try {
      await actions.advanceLot();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Advance failed");
    }
  }, [actions]);

  const handleEndConfirm = useCallback(async () => {
    await actions.endAuction();
    setModal("none");
  }, [actions]);

  const handleGoLive = useCallback(async () => {
    setActionError(null);
    try {
      await actions.goLive();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Go-live failed");
    }
  }, [actions]);

  const handleDismissQuestion = useCallback(
    (id: string) => {
      void actions.dismissQuestion(id).catch((err) => {
        setActionError(err instanceof Error ? err.message : "Dismiss failed");
      });
    },
    [actions]
  );

  const primary = tenant.brand_colors?.primary ?? "#000000";
  const { display: fontDisplay, mono: fontMono } = resolveFontVars(tenant);
  const badgeText = getBadgeTextColor(primary);

  const lotIndex = currentLot ? lots.findIndex((l) => l.id === currentLot.id) : 0;
  const reserveMet =
    currentLot?.reserve != null &&
    bastaState.currentBid != null &&
    bastaState.currentBid >= currentLot.reserve;

  const lotNumber = currentLot ? lotIndex + 1 : null;
  const isAuctionLive = auction.status === "live";
  const isAuctionClosed = auction.status === "closed";
  const canAct = isAuctionLive && Boolean(currentLot);

  return (
    <div
      className="hidden h-screen flex-col bg-white lg:flex"
      style={
        {
          "--storefront-primary": primary,
          "--storefront-font-display": fontDisplay,
          "--storefront-font-mono": fontMono,
          "--storefront-badge-text": badgeText,
        } as React.CSSProperties
      }
    >
      <ConsoleHeader
        tenant={tenant}
        auctionTitle={auction.title}
        status={auction.status}
        watchingCount={watchingCount}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onEndAuction={() => setModal("confirm-end")}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LotQueueSidebar
          lots={lots}
          currentLotId={currentLot?.id ?? null}
          onSelect={() => {}}
        />

        {/* Center: media + info */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-[#f3f3f3] px-5 py-2 text-xs">
            <span
              className="uppercase tracking-widest text-[#9c9c9c]"
              style={{ fontFamily: fontMono }}
            >
              {currentLot ? currentLot.title.toUpperCase() : "NO LOT SELECTED"}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {currentLot ? (
              <>
                <div className="aspect-[4/3] w-full bg-[#f8f8f8]">
                  <ImageCarousel images={currentLot.images} alt={currentLot.title} />
                </div>
                <div className="p-5">
                  <ConsoleLotInfo
                    lot={currentLot}
                    lotIndex={lotIndex}
                    totalLots={lots.length}
                    reserveMet={reserveMet}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p
                  className="text-sm text-[#9c9c9c]"
                  style={{ fontFamily: fontMono }}
                >
                  Add lots to this auction to start.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: seller controls */}
        <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-[#f3f3f3] bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-[#f3f3f3] px-4 py-2">
            <span
              className="text-[10px] uppercase tracking-widest text-[#9c9c9c]"
              style={{ fontFamily: fontMono }}
            >
              SELLER CONSOLE
            </span>
            <span
              className="text-[10px] uppercase tracking-widest text-[#5e5e5e]"
              style={{ fontFamily: fontMono }}
            >
              @{user.email?.split("@")[0] ?? "seller"}
            </span>
          </div>

          <div className="flex shrink-0 flex-col gap-4 border-b border-[#f3f3f3] px-4 py-4">
            {!isAuctionLive && !isAuctionClosed && (
              <button
                type="button"
                onClick={handleGoLive}
                disabled={!lots.length}
                className="flex h-[50px] items-center justify-center rounded-md bg-[#10b981] text-sm uppercase tracking-[-0.02em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ fontFamily: fontMono }}
              >
                START AUCTION →
              </button>
            )}

            {currentLot && (
              <SellerCurrentBid
                currentBidCents={bastaState.currentBid}
                startingBidCents={currentLot.starting_bid}
                bidCount={bastaState.bidCount}
                timeRemaining={bastaState.timeRemaining}
                maxBidCount={0}
                highestMaxBidCents={null}
              />
            )}

            <div>
              <span
                className="mb-1 block text-[10px] uppercase tracking-widest text-[#9c9c9c]"
                style={{ fontFamily: fontMono }}
              >
                BIDDING INCREMENTS
              </span>
              <BidIncrementsSelector
                options={INCREMENT_OPTIONS_CENTS}
                selected={increment}
                onChange={setIncrement}
              />
            </div>

            <SellPassControls
              onSell={handleSell}
              onPass={() => setModal("confirm-pass")}
              onNextLot={handleNextLot}
              disabled={!canAct}
            />

            {actionError && (
              <p
                className="text-xs text-[#dc2626]"
                style={{ fontFamily: fontMono }}
              >
                {actionError}
              </p>
            )}

            {isAuctionClosed && (
              <p
                className="rounded-md bg-[#f3f3f3] p-3 text-xs text-[#5e5e5e]"
                style={{ fontFamily: fontMono }}
              >
                Auction is closed.
              </p>
            )}
          </div>

          <BuyerQuestionsFeed
            questions={questions}
            onDismiss={handleDismissQuestion}
          />

          <ConsoleLiveBids bids={sessionBids} totalCount={bastaState.bidCount} />
        </aside>
      </div>

      <ConfirmActionModal
        isOpen={modal === "confirm-pass"}
        label="CONFIRM ACTION"
        title="Are you sure you want to pass?"
        helper="Lot will be skipped and the highest bidder will not be charged"
        confirmLabel="CONFIRM PASS"
        lotTitle={currentLot?.title}
        lotThumbnail={
          currentLot && currentLot.images.length > 0 ? currentLot.images[0] : null
        }
        lotNumber={lotNumber ?? undefined}
        onClose={() => setModal("none")}
        onConfirm={handlePassConfirm}
      />
      <ConfirmActionModal
        isOpen={modal === "confirm-end"}
        label="CONFIRM ACTION"
        title="End this auction?"
        helper="All remaining lots will be closed. Buyers will be returned to the storefront."
        confirmLabel="END AUCTION"
        confirmVariant="danger"
        onClose={() => setModal("none")}
        onConfirm={handleEndConfirm}
      />
    </div>
  );
}

export function ConsoleMobileBlock() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-white px-6 text-center lg:hidden">
      <h1 className="text-xl tracking-[-0.02em] text-black">
        Desktop required
      </h1>
      <p className="mt-2 text-sm text-[#5e5e5e]">
        The seller console needs a larger screen. Please switch to a desktop
        browser to run the auction.
      </p>
    </div>
  );
}
