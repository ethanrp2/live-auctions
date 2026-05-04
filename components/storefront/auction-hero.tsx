import type { Tenant } from "@/lib/tenant";
import type { StorefrontAuction } from "@/lib/storefront-data";
import { formatLiveDate } from "@/lib/format";
import { BastaLogo } from "./basta-logo";
import { SmsSubscribe } from "./sms-subscribe";

interface AuctionHeroProps {
  tenant: Tenant;
  auction: StorefrontAuction;
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 11 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-[11px]"
      style={{ color: "var(--storefront-hero-text)" }}
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="1.5"
        width="10"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth="1"
      />
      <line x1="0.5" y1="4" x2="10.5" y2="4" stroke="currentColor" strokeWidth="1" />
      <line x1="3" y1="0.5" x2="3" y2="2.5" stroke="currentColor" strokeWidth="1" />
      <line x1="8" y1="0.5" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function AuctionHero({ tenant, auction }: AuctionHeroProps) {
  const hasHeroImage = Boolean(tenant.hero_image_url);
  const primary = tenant.brand_colors?.primary ?? "#000000";

  return (
    <section className="relative flex h-[360px] w-full shrink-0 flex-col justify-between overflow-hidden p-6 lg:h-full lg:w-[480px] lg:p-[30px]">
      {/* Background layer */}
      {hasHeroImage ? (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tenant.hero_image_url!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: primary }}
        />
      )}

      {/* Logo */}
      <div className="relative z-10">
        {tenant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            className="h-4 w-auto object-contain object-left"
          />
        ) : (
          <span style={{ color: "var(--storefront-hero-text)" }}>
            <BastaLogo className="h-4 w-auto" />
          </span>
        )}
      </div>

      {/* Auction info */}
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarIcon />
          <span
            className="text-sm uppercase tracking-[-0.02em]"
            style={{
              fontFamily: "var(--storefront-font-mono)",
              color: "var(--storefront-hero-text-secondary)",
            }}
          >
            {formatLiveDate(auction.scheduled_date)}
          </span>
        </div>
        <h1
          className="text-2xl font-normal leading-tight lg:text-[26px]"
          style={{
            fontFamily: "var(--storefront-font-display)",
            color: "var(--storefront-hero-text)",
          }}
        >
          {auction.title}
        </h1>
        {auction.description && (
          <p
            className="text-sm leading-normal"
            style={{
              fontFamily: "var(--storefront-font-display)",
              color: "var(--storefront-hero-text-secondary)",
            }}
          >
            {auction.description}
          </p>
        )}
      </div>

      {/* Desktop SMS card — hidden on mobile */}
      <div className="relative z-10 hidden lg:block">
        <SmsSubscribe variant="desktop" primaryColor={primary} tenantId={tenant.id} />
      </div>
    </section>
  );
}
