"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/use-user";

interface SellerSessionRedirectProps {
  tenantId: string;
}

export function SellerSessionRedirect({ tenantId }: SellerSessionRedirectProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (isLoading || !user) return;

    let cancelled = false;
    void (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_seller, tenant_id")
        .eq("id", user.id)
        .maybeSingle<{ is_seller: boolean | null; tenant_id: string | null }>();

      if (cancelled) return;
      if (profile?.is_seller && profile.tenant_id === tenantId) {
        window.location.replace("/seller/auctions");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, supabase, tenantId, user]);

  return null;
}
