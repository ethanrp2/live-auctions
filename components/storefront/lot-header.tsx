"use client";

import { useState } from "react";
import Link from "next/link";
import { BastaLogo } from "./basta-logo";
import { AuthModal } from "./auth-modal";
import { PaymentModal } from "./payment-modal";
import { ShippingModal } from "./shipping-modal";
import { useUser } from "@/lib/hooks/use-user";

interface LotHeaderProps {
  auctionTitle: string;
}

type ModalState = "none" | "auth" | "payment" | "shipping";

export function LotHeader({ auctionTitle }: LotHeaderProps) {
  const [activeModal, setActiveModal] = useState<ModalState>("none");
  const { user } = useUser();

  return (
    <>
      <header
        className="flex h-[50px] shrink-0 items-center justify-between px-4 lg:px-6"
        style={{ backgroundColor: "var(--storefront-primary)" }}
      >
        {/* Auction title */}
        <span
          className="text-xs uppercase tracking-[-0.02em]"
          style={{
            fontFamily: "var(--storefront-font-mono)",
            color: "var(--storefront-badge-text)",
          }}
        >
          {auctionTitle}
        </span>

        {/* Center logo — navigates to main page */}
        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 transition-opacity hover:opacity-80"
          style={{ color: "var(--storefront-badge-text)" }}
        >
          <BastaLogo />
        </Link>

        {/* Account button */}
        <button
          type="button"
          onClick={() => setActiveModal("auth")}
          className="flex h-[26px] items-center rounded-[6px] px-2 text-xs uppercase tracking-[-0.02em] transition-all"
          style={{
            fontFamily: "var(--storefront-font-mono)",
            color: "var(--storefront-badge-text)",
            border: "1px solid var(--storefront-badge-text)",
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--storefront-badge-text)";
            e.currentTarget.style.color = "var(--storefront-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--storefront-badge-text)";
          }}
        >
          {user ? "Account" : "Register or Login"}
        </button>
      </header>

      {/* Auth flow modals */}
      <AuthModal
        isOpen={activeModal === "auth"}
        onClose={() => setActiveModal("none")}
        onComplete={() => setActiveModal("payment")}
      />
      <PaymentModal
        isOpen={activeModal === "payment"}
        onClose={() => setActiveModal("none")}
        onComplete={() => setActiveModal("shipping")}
      />
      <ShippingModal
        isOpen={activeModal === "shipping"}
        onClose={() => setActiveModal("none")}
        onComplete={() => setActiveModal("none")}
        onBack={() => setActiveModal("payment")}
      />
    </>
  );
}
