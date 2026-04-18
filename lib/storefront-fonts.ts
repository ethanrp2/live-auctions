import type { Tenant } from "./tenant";

export type DisplayFontKey =
  | "inter"
  | "geist"
  | "playfair_display"
  | "instrument_serif";

export type MonoFontKey =
  | "jetbrains_mono"
  | "geist_mono"
  | "ibm_plex_mono"
  | "space_mono";

// CSS variables match the `variable` fields in app/layout.tsx's next/font imports.
export const DISPLAY_FONT_VARS: Record<DisplayFontKey, string> = {
  inter: "var(--font-inter)",
  geist: "var(--font-geist-sans)",
  playfair_display: "var(--font-playfair-display)",
  instrument_serif: "var(--font-instrument-serif)",
};

export const MONO_FONT_VARS: Record<MonoFontKey, string> = {
  jetbrains_mono: "var(--font-jetbrains-mono)",
  geist_mono: "var(--font-geist-mono)",
  ibm_plex_mono: "var(--font-ibm-plex-mono)",
  space_mono: "var(--font-space-mono)",
};

const DEFAULT_DISPLAY: DisplayFontKey = "inter";
const DEFAULT_MONO: MonoFontKey = "jetbrains_mono";

export function resolveFontVars(tenant: Tenant): { display: string; mono: string } {
  const displayKey = (tenant.font_display as DisplayFontKey) in DISPLAY_FONT_VARS
    ? (tenant.font_display as DisplayFontKey)
    : DEFAULT_DISPLAY;
  const monoKey = (tenant.font_mono as MonoFontKey) in MONO_FONT_VARS
    ? (tenant.font_mono as MonoFontKey)
    : DEFAULT_MONO;

  return {
    display: DISPLAY_FONT_VARS[displayKey],
    mono: MONO_FONT_VARS[monoKey],
  };
}
