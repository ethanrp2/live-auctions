"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/use-user";

interface SellerSessionRedirectProps {
  tenantId: string;
  forcePublic: boolean;
}

export function SellerSessionRedirect({ tenantId, forcePublic }: SellerSessionRedirectProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (forcePublic || isLoading || !user) return;

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
  }, [forcePublic, isLoading, supabase, tenantId, user]);

  return null;
}
