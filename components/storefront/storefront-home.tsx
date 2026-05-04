import type { User } from "@supabase/supabase-js";
import type { Tenant } from "@/lib/tenant";
import { getStorefrontAuction } from "@/lib/storefront-data";
import { resolveFontVars } from "@/lib/storefront-fonts";
import { getHeroColors, getBadgeTextColor } from "@/lib/color";
import { AuctionHero } from "./auction-hero";
import { LotGrid } from "./lot-grid";
import { SmsSubscribe } from "./sms-subscribe";

const SMS_ENABLED = process.env.NEXT_PUBLIC_SMS_ENABLED === "true";

interface StorefrontHomeProps {
  tenant: Tenant;
  user: User | null;
}

export async function StorefrontHome({ tenant, user }: StorefrontHomeProps) {
  const { auction } = await getStorefrontAuction(tenant.id);
  const primary = tenant.brand_colors?.primary ?? "#000000";
  const { display: fontDisplay, mono: fontMono } = resolveFontVars(tenant);
  const hasImage = Boolean(tenant.hero_image_url);
  const heroColors = getHeroColors(hasImage, primary);
  const badgeText = getBadgeTextColor(primary);

  return (
    <div
      className="flex flex-col bg-white lg:h-screen lg:flex-row"
      style={
        {
          "--storefront-primary": primary,
          "--storefront-font-display": fontDisplay,
          "--storefront-font-mono": fontMono,
          "--storefront-hero-text": heroColors.text,
          "--storefront-hero-text-secondary": heroColors.textSecondary,
          "--storefront-badge-text": badgeText,
        } as React.CSSProperties
      }
    >
      <AuctionHero tenant={tenant} auction={auction} />

      <main className="flex-1 lg:overflow-y-auto">
        <LotGrid lots={auction.lots} />
      </main>

      {/* Mobile SMS overlay — fixed to bottom, hidden on desktop */}
      {SMS_ENABLED && (
        <SmsSubscribe variant="mobile" primaryColor={primary} tenantId={tenant.id} />
      )}
    </div>
  );
}
