"use client";

import { useState } from "react";
import type { StorefrontLotDetail, StorefrontAuction } from "@/lib/storefront-data";
import { AuctionStatusBar } from "./auction-status-bar";
import { LotInfo } from "./lot-info";
import { MaxBidSection } from "./max-bid-section";
import { AuthModal } from "./auth-modal";
import { PaymentModal } from "./payment-modal";
import { ShippingModal } from "./shipping-modal";
import { SmsSubscribeSheet } from "./sms-subscribe-sheet";

interface LotInfoPanelProps {
  lot: StorefrontLotDetail;
  auction: StorefrontAuction;
  isAuthenticated: boolean;
  lotIndex: number;
  totalLots: number;
}

type ModalState = "none" | "auth" | "payment" | "shipping" | "sms";

export function LotInfoPanel({ lot, auction, isAuthenticated, lotIndex, totalLots }: LotInfoPanelProps) {
  const [activeModal, setActiveModal] = useState<ModalState>("none");

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
          scheduledDate={auction.scheduled_date}
          onGetAlerted={() => setActiveModal("sms")}
        />
        {/* Info section — scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto border-b border-[#f3f3f3] p-5">
          <LotInfo lot={lot} lotIndex={lotIndex} totalLots={totalLots} />
        </div>
        {/* Max bid section — pinned at bottom */}
        <div className="shrink-0 p-5">
          <MaxBidSection
            lotId={lot.id}
            startingBid={lot.starting_bid}
            isAuthenticated={isAuthenticated}
            onAuthRequired={handleAuthRequired}
          />
        </div>
      </div>

      {/* Modals */}
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
      <SmsSubscribeSheet
        isOpen={activeModal === "sms"}
        onClose={() => setActiveModal("none")}
      />
    </>
  );
}
