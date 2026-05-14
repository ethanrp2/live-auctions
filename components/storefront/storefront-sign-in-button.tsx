"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { AuthModal } from "./auth-modal";
import { useUser } from "@/lib/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { requestRootSession } from "@/lib/supabase/session-bridge";

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
  const [showConsole, setShowConsole] = useState(false);
  const { user: currentUser } = useUser();
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const activeUser = currentUser ?? user;

  useEffect(() => {
    if (!activeUser) {
      setShowConsole(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_seller, tenant_id")
        .eq("id", activeUser.id)
        .maybeSingle<{ is_seller: boolean | null; tenant_id: string | null }>();

      if (!cancelled) {
        setShowConsole(Boolean(profile?.is_seller && profile.tenant_id === tenantId));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeUser, supabase, tenantId]);

  async function handleClick() {
    if (!activeUser) {
      setIsOpen(true);
      return;
    }

    if (showConsole) {
      router.push("/seller/auctions");
      return;
    }

    await Promise.allSettled([
      supabase.auth.signOut({ scope: "global" }),
      requestRootSession("clear"),
    ]);
    window.location.replace("/");
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed right-5 top-5 z-30 flex h-[34px] items-center rounded-[4px] border border-[var(--storefront-primary)] bg-[var(--storefront-primary)] px-4 text-[11px] uppercase tracking-widest text-black hover:bg-black hover:text-[var(--storefront-primary)]"
        style={{ fontFamily: "var(--storefront-font-mono)" }}
      >
        {showConsole ? "CONSOLE" : activeUser ? "SIGN OUT" : "SIGN IN"}
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
