/**
 * Aubrey Rankings: OKLCH Cinematic Palette Calibration & Contrast Engine
 * Ensures custom artwork accents adhere to film editorial aesthetics and WCAG AA contrast against #111514.
 */

export interface OklchColor {
  l: number; // 0.0 to 1.0
  c: number; // 0.0 to 0.4
  h: number; // 0 to 360
}

export interface CalibratedTheme {
  primaryAccent: string; // CSS oklch() string guaranteed readable on dark background
  softGlow: string; // Subtle aura
  borderTone: string; // Refined subtle border
  badgeBg: string; // Dark translucent chip background
  badgeText: string; // High-contrast text
  rawOklch: OklchColor;
  calibratedOklch: OklchColor;
  contrastRatioAgainstDark: number; // Estimated contrast ratio against #111514
}

/**
 * Parses Hex color string (#RRGGBB or #RGB) to normalized sRGB [0..1]
 */
export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length !== 6) {
    // Default fallback to signature Aubrey Teal (#89d5d5)
    return [0.537, 0.835, 0.835];
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

/**
 * Linearizes sRGB component
 */
function srgbToLinear(val: number): number {
  return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
}

/**
 * Converts sRGB [0..1] to OKLCH color coordinates
 */
export function rgbToOklch(r: number, g: number, b: number): OklchColor {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // Linear sRGB to OKLab matrix
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720403 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bVal * bVal);
  let h = (Math.atan2(bVal, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return {
    l: Math.max(0, Math.min(1, Math.round(L * 1000) / 1000)),
    c: Math.max(0, Math.min(0.4, Math.round(C * 1000) / 1000)),
    h: Math.round(h * 10) / 10,
  };
}

/**
 * Calibrates any arbitrary color extracted from movie posters/backdrops
 * to guarantee WCAG AA contrast (>= 4.5:1) against Aubrey dark background (#111514)
 * while preserving cinematic editorial sophistication (no neon oversaturation).
 */
export function calibrateOklchTheme(sourceColorHex: string): CalibratedTheme {
  const [r, g, b] = hexToRgb(sourceColorHex);
  const raw = rgbToOklch(r, g, b);

  // Aubrey Dark Cinema background (#111514) perceived lightness is ~0.14
  // To guarantee >= 4.5:1 contrast ratio against #111514:
  // Lightness must be at least 0.70
  let targetL = raw.l;
  if (targetL < 0.72) {
    targetL = 0.76; // Lift dark hues up to a luminous editorial pastel
  } else if (targetL > 0.92) {
    targetL = 0.86; // Prevent pure washed-out whites
  }

  // Restrain chroma to prevent garish, uneditorial neon glow
  let targetC = raw.c;
  if (targetC > 0.14) {
    targetC = 0.12; // Clamp to tasteful cinematic tint
  } else if (targetC < 0.04) {
    targetC = 0.06; // Give muted greys a slight character
  }

  const calibrated: OklchColor = {
    l: Math.round(targetL * 100) / 100,
    c: Math.round(targetC * 100) / 100,
    h: raw.h,
  };

  // Estimate contrast ratio against #111514 (L_bg ~ 0.14)
  // Approximate luminance ratio: (L_fg + 0.05) / (L_bg + 0.05)
  const contrastRatio =
    Math.round(((Math.pow(calibrated.l, 2.2) + 0.05) / (Math.pow(0.14, 2.2) + 0.05)) * 10) / 10;

  const primaryAccent = `oklch(${calibrated.l} ${calibrated.c} ${calibrated.h})`;
  const softGlow = `oklch(${calibrated.l} ${calibrated.c} ${calibrated.h} / 0.18)`;
  const borderTone = `oklch(${calibrated.l} ${calibrated.c} ${calibrated.h} / 0.35)`;
  const badgeBg = `oklch(0.20 ${Math.min(calibrated.c * 0.5, 0.05)} ${calibrated.h} / 0.85)`;
  const badgeText = `oklch(${Math.min(1, calibrated.l + 0.08)} ${calibrated.c} ${calibrated.h})`;

  return {
    primaryAccent,
    softGlow,
    borderTone,
    badgeBg,
    badgeText,
    rawOklch: raw,
    calibratedOklch: calibrated,
    contrastRatioAgainstDark: contrastRatio,
  };
}
