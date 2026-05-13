"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthModal } from "./auth-modal";

interface StorefrontSignInButtonProps {
  user: User | null;
  tenantId: string;
  tenantSlug: string;
}

export function StorefrontSignInButton({
  user,
  tenantId,
  tenantSlug,
}: StorefrontSignInButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-5 top-5 z-30 flex h-[34px] items-center rounded-[4px] border border-[var(--storefront-primary)] bg-[var(--storefront-primary)] px-4 text-[11px] uppercase tracking-widest text-black hover:bg-black hover:text-[var(--storefront-primary)]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {user ? "ACCOUNT" : "SIGN IN"}
      </button>
      <AuthModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onComplete={() => setIsOpen(false)}
        tenantId={tenantId}
        tenantSlug={tenantSlug}
      />
    </>
  );
}
