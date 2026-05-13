"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StorefrontLotDetail, StorefrontAuction } from "@/lib/storefront-data";
import {
  getWinnerDisplayLabel,
  getStorefrontAuctionPhase,
  getStorefrontLotOutcome,
} from "@/lib/storefront-state";
import { createClient } from "@/lib/supabase/client";
import { formatMoneyCents } from "@/lib/format";
import { AuctionStatusBar } from "./auction-status-bar";
import { LotInfo } from "./lot-info";
import { MaxBidSection } from "./max-bid-section";
import { AuthModal } from "./auth-modal";
import { PaymentModal } from "./payment-modal";
import { ShippingModal } from "./shipping-modal";
import { SmsSubscribeSheet } from "./sms-subscribe-sheet";

const SMS_ENABLED = process.env.NEXT_PUBLIC_SMS_ENABLED === "true";

interface LotInfoPanelProps {
  lot: StorefrontLotDetail;
  auction: StorefrontAuction;
  isAuthenticated: boolean;
  lotIndex: number;
  totalLots: number;
  tenantId: string;
}

type ModalState = "none" | "auth" | "payment" | "shipping" | "sms";

function EndedOutcomeCard({
  auction,
  lot,
}: {
  auction: StorefrontAuction;
  lot: StorefrontLotDetail;
}) {
  const outcome = getStorefrontLotOutcome(lot, auction);

  if (outcome === "sold") {
    return (
      <div className="rounded-[10px] border border-[#e7e7e7] bg-[#f7f7f7] p-4">
        <p
          className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          Sold
        </p>
        <p
          className="mt-2 text-2xl text-black"
          style={{ fontFamily: "var(--storefront-font-display)" }}
        >
          {formatMoneyCents(lot.winning_bid_cents)}
        </p>
        <p
          className="mt-2 text-xs uppercase tracking-[-0.02em] text-[#5e5e5e]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          Winner: {getWinnerDisplayLabel(lot)}
        </p>
      </div>
    );
  }

  if (outcome === "passed") {
    return (
      <div className="rounded-[10px] border border-[#e7e7e7] bg-[#f7f7f7] p-4">
        <p
          className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e]"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          Passed
        </p>
        <p
          className="mt-2 text-base text-black"
          style={{ fontFamily: "var(--storefront-font-display)" }}
        >
          This lot did not sell during the auction.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[#e7e7e7] bg-[#f7f7f7] p-4">
      <p
        className="text-[11px] uppercase tracking-[-0.02em] text-[#5e5e5e]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        Auction ended
      </p>
      <p
        className="mt-2 text-base text-black"
        style={{ fontFamily: "var(--storefront-font-display)" }}
      >
        This lot closed without a recorded sale.
      </p>
    </div>
  );
}

export function LotInfoPanel({
  lot,
  auction,
  isAuthenticated,
  lotIndex,
  totalLots,
  tenantId,
}: LotInfoPanelProps) {
  const [activeModal, setActiveModal] = useState<ModalState>("none");
  const router = useRouter();
  const phase = getStorefrontAuctionPhase(auction);
  const isAuctionEnded = phase === "ended";
  const isUpcoming = phase === "upcoming";

  useEffect(() => {
    if (auction.status === "live") {
      router.replace(`/auctions/${auction.id}/live`);
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`lot-detail:auction:${auction.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `id=eq.${auction.id}`,
        },
        (payload) => {
          const next = payload.new as { status?: string | null };
          if (next.status === "live") {
            router.replace(`/auctions/${auction.id}/live`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [auction.id, auction.status, router]);

  const handleAuthRequired = () => {
    setActiveModal("auth");
  };

  const handleAuthComplete = () => {
    setActiveModal("payment");
  };

  const handlePaymentComplete = () => {
    setActiveModal("shipping");
  };

  const handleShippingComplete = () => {
    setActiveModal("none");
  };

  const handleBack = () => {
    if (activeModal === "shipping") setActiveModal("payment");
    else if (activeModal === "payment") setActiveModal("auth");
    else setActiveModal("none");
  };

  return (
    <>
      <div className="flex h-full flex-col">
        <AuctionStatusBar
          auction={auction}
          onGetAlerted={
            isUpcoming && SMS_ENABLED ? () => setActiveModal("sms") : undefined
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto border-b border-[#f3f3f3] p-5">
          <LotInfo lot={lot} auction={auction} lotIndex={lotIndex} totalLots={totalLots} />
        </div>
        <div className="shrink-0 p-5">
          {isAuctionEnded ? (
            <EndedOutcomeCard auction={auction} lot={lot} />
          ) : (
            <MaxBidSection
              lotId={lot.id}
              startingBid={lot.starting_bid}
              isAuthenticated={isAuthenticated}
              onAuthRequired={handleAuthRequired}
            />
          )}
        </div>
      </div>

      <AuthModal
        isOpen={activeModal === "auth"}
        onClose={() => setActiveModal("none")}
        onComplete={handleAuthComplete}
      />
      <PaymentModal
        isOpen={activeModal === "payment"}
        onClose={() => setActiveModal("none")}
        onComplete={handlePaymentComplete}
      />
      <ShippingModal
        isOpen={activeModal === "shipping"}
        onClose={() => setActiveModal("none")}
        onComplete={handleShippingComplete}
        onBack={handleBack}
      />
      {SMS_ENABLED && (
        <SmsSubscribeSheet
          isOpen={activeModal === "sms"}
          onClose={() => setActiveModal("none")}
          tenantId={tenantId}
        />
      )}
    </>
  );
}
