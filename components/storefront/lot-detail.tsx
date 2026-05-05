import type { User } from "@supabase/supabase-js";
import type { Tenant } from "@/lib/tenant";
import { getStorefrontLotDetail } from "@/lib/storefront-data";
import { resolveFontVars } from "@/lib/storefront-fonts";
import { getBadgeTextColor } from "@/lib/color";
import { notFound } from "next/navigation";
import { LotHeader } from "./lot-header";
import { LotRibbon } from "./lot-ribbon";
import { ImageCarousel } from "./image-carousel";
import { LotInfoPanel } from "./lot-info-panel";
import { AuctionStatusBar } from "./auction-status-bar";

interface LotDetailProps {
  tenant: Tenant;
  lotId: string;
  user: User | null;
}

export async function LotDetail({ tenant, lotId, user }: LotDetailProps) {
  const result = await getStorefrontLotDetail(tenant.id, lotId);

  if (!result) {
    notFound();
  }

  const { lot, auction, ribbonLots } = result;
  const primary = tenant.brand_colors?.primary ?? "#000000";
  const { display: fontDisplay, mono: fontMono } = resolveFontVars(tenant);
  const badgeText = getBadgeTextColor(primary);

  const lotIndex = ribbonLots.findIndex((l) => l.id === lotId) + 1;
  const totalLots = ribbonLots.length;

  return (
    <div
      className="flex h-screen flex-col bg-white lg:overflow-hidden"
      style={
        {
          "--storefront-primary": primary,
          "--storefront-font-display": fontDisplay,
          "--storefront-font-mono": fontMono,
          "--storefront-badge-text": badgeText,
        } as React.CSSProperties
      }
    >
      <LotHeader auctionTitle={auction.title} />
      <LotRibbon lots={ribbonLots} currentLotId={lotId} />

      {/* Mobile-only status bar above carousel */}
      <div className="lg:hidden">
        <AuctionStatusBar scheduledDate={auction.scheduled_date} />
      </div>

      {/* Main content: image + info panel */}
      <div className="flex flex-1 flex-col lg:flex-row lg:h-[calc(100vh-110px)]">
        {/* Image area — 62.5% on desktop */}
        <div className="w-full lg:w-[62.5%]">
          <ImageCarousel images={lot.images} alt={lot.title} />
        </div>

        {/* Info panel — 37.5% on desktop, fixed height so internal flex works */}
        <div className="w-full lg:w-[37.5%] lg:h-full">
          <LotInfoPanel
            lot={lot}
            auction={auction}
            isAuthenticated={!!user}
            lotIndex={lotIndex}
            totalLots={totalLots}
            tenantId={tenant.id}
          />
        </div>
      </div>
    </div>
  );
}
