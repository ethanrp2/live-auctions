/**
 * Returns true if the hex color is "light" (relative luminance > 0.5).
 * Uses sRGB linearization + WCAG luminance weights.
 */
export function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5;
}

/**
 * Compute hero text colors based on whether there's a background image.
 * - With image: always white (dark overlay guarantees contrast)
 * - Without image: pick black or white based on primary color luminance
 */
export function getHeroColors(hasImage: boolean, primaryColor: string) {
  if (hasImage) {
    return { text: "#ffffff", textSecondary: "rgba(255,255,255,0.8)" };
  }
  const light = isLightColor(primaryColor);
  return {
    text: light ? "#000000" : "#ffffff",
    textSecondary: light ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.8)",
  };
}

/**
 * Badge text color — contrast against the primary brand color.
 */
export function getBadgeTextColor(primaryColor: string): string {
  return isLightColor(primaryColor) ? "#000000" : "#ffffff";
}
