"use client";

export interface LiveTopBarProps {
  tenantName: string;
  tenantLogoUrl: string | null;
  viewerCount: number | null;
  onMenu: () => void;
}

function ViewerIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      className="h-3 w-3 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M6 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        fill="currentColor"
      />
      <path
        d="M2 10.5c0-1.66 1.79-3 4-3s4 1.34 4 3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M3 6h14M3 10h14M3 14h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Waveform() {
  const bars = [4, 8, 12, 6, 10, 14, 8, 6, 12, 10, 6, 8, 4, 10, 8, 12, 6];
  return (
    <div
      className="flex h-[18px] items-center gap-[2px]"
      aria-hidden="true"
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className="block w-[2px] rounded-[1px] bg-white/80"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

export function LiveTopBar({
  tenantName,
  tenantLogoUrl,
  viewerCount,
  onMenu,
}: LiveTopBarProps) {
  return (
    <div className="relative flex h-11 w-full shrink-0 items-center justify-between bg-black px-4 py-3">
      {/* Left cluster */}
      <div className="flex min-w-0 flex-1 items-center gap-2 pr-20">
        <div className="h-[18px] w-[18px] shrink-0 overflow-hidden rounded-full bg-white/10">
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenantLogoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <span
          className="min-w-0 truncate text-xs uppercase tracking-[-0.02em] text-white"
          style={{ fontFamily: "var(--storefront-font-mono)" }}
        >
          {tenantName.toUpperCase()}
        </span>
        <div className="ml-2 flex items-center gap-1 text-[#ff5e61]">
          <ViewerIcon />
          <span
            className="text-xs tracking-[-0.02em]"
            style={{ fontFamily: "var(--storefront-font-mono)" }}
          >
            {viewerCount === null ? "\u2014" : viewerCount.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      {/* Center waveform */}
      <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 sm:block">
        <Waveform />
      </div>

      {/* Right menu */}
      <button
        type="button"
        onClick={onMenu}
        className="flex h-5 w-5 items-center justify-center rounded-full text-white"
        aria-label="Open menu"
      >
        <MenuIcon />
      </button>
    </div>
  );
}
