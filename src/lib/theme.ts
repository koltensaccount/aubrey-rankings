// =========================================================================
// AUBREY RANKINGS — THEME & ACCENT TOKEN ENGINE
// WCAG AA Compliant contrast calculation, palette presets, and validation.
// =========================================================================

export type ThemeMode = "light" | "dark" | "system";

export interface AccentPreset {
  id: string;
  name: string;
  hex: string;
  description: string;
}

export const DEFAULT_THEME: ThemeMode = "dark";
export const DEFAULT_ACCENT = "#89D5D5";
export const DEFAULT_ACCENT_COLOR = DEFAULT_ACCENT;

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "signature-teal",
    name: "Signature Teal",
    hex: "#89D5D5",
    description: "Original cinematic Aubrey editorial accent",
  },
  {
    id: "film-blue",
    name: "Film Blue",
    hex: "#5BA4E6",
    description: "Classic cinema archive slate blue",
  },
  {
    id: "regal-purple",
    name: "Regal Purple",
    hex: "#9D7FE6",
    description: "Subtle velvet festival violet",
  },
  {
    id: "sage-green",
    name: "Sage Green",
    hex: "#52C480",
    description: "Organic film stock emerald",
  },
  {
    id: "warm-coral",
    name: "Warm Coral",
    hex: "#F27A59",
    description: "Warm Technicolor terracotta",
  },
  {
    id: "dusty-rose",
    name: "Dusty Rose",
    hex: "#E8638B",
    description: "Editorial art house rose",
  },
];

export const THEME_PRESETS = ACCENT_PRESETS;

/**
 * Validates a hexadecimal color string to ensure safety and prevent CSS injection.
 * Accepts #RGB or #RRGGBB.
 */
export function isValidHexColor(hex: unknown): boolean {
  if (typeof hex !== "string") return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

/**
 * Normalizes hex to standard uppercase #RRGGBB.
 * Accepts with or without leading '#', 3 or 6 chars.
 * Falls back to DEFAULT_ACCENT if completely invalid.
 */
export function normalizeHexColor(hex: string): string {
  if (typeof hex !== "string") return DEFAULT_ACCENT;
  let clean = hex.trim();
  if (!clean.startsWith("#") && /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(clean)) {
    clean = `#${clean}`;
  }
  if (!isValidHexColor(clean)) return DEFAULT_ACCENT;
  let code = clean.replace("#", "");
  if (code.length === 3) {
    code = code
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${code.toUpperCase()}`;
}

/**
 * Converts hex to RGB tuple [r, g, b] (0-255).
 */
export function hexToRgb(hex: string): [number, number, number] {
  const norm = normalizeHexColor(hex).replace("#", "");
  const r = parseInt(norm.substring(0, 2), 16);
  const g = parseInt(norm.substring(2, 4), 16);
  const b = parseInt(norm.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB color.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates relative luminance directly from a hex color.
 */
export function getHexLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return getRelativeLuminance(r, g, b);
}

/**
 * Calculates contrast ratio between two relative luminances or hex colors.
 * ratio = (L1 + 0.05) / (L2 + 0.05)
 */
export function getContrastRatio(val1: number | string, val2: number | string): number {
  const lum1 = typeof val1 === "string" ? getHexLuminance(val1) : val1;
  const lum2 = typeof val2 === "string" ? getHexLuminance(val2) : val2;
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Computes an accessible foreground text color (dark #102523 vs light #FFFFFF)
 * to guarantee WCAG AA contrast on the given background accent.
 */
export function getAccessibleForeground(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const bgLum = getRelativeLuminance(r, g, b);

  // Dark foreground: #102523 (rgb: 16, 37, 35)
  const darkLum = getRelativeLuminance(16, 37, 35);
  const darkContrast = getContrastRatio(bgLum, darkLum);

  // Light foreground: #FFFFFF (rgb: 255, 255, 255)
  const lightLum = 1.0;
  const lightContrast = getContrastRatio(bgLum, lightLum);

  // Favor the one with higher contrast
  return darkContrast >= lightContrast ? "#102523" : "#FFFFFF";
}

/**
 * Computes a hover shade by adjusting RGB lightness slightly.
 */
export function getHoverShade(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = getRelativeLuminance(r, g, b);
  // If color is relatively bright, darken slightly for hover (e.g. 10%); if dark, lighten slightly
  const factor = lum > 0.4 ? 0.88 : 1.15;
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n * factor)));
  const [nr, ng, nb] = [clamp(r), clamp(g), clamp(b)];
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`.toUpperCase();
}

/**
 * Returns complete CSS token definitions for a given accent color.
 */
export function getAccentTokens(accentHex: string) {
  const normalized = normalizeHexColor(accentHex);
  const fg = getAccessibleForeground(normalized);
  const hover = getHoverShade(normalized);

  return {
    primary: normalized,
    primaryForeground: fg,
    primaryHover: hover,
    ring: normalized,
  };
}

/**
 * Generates semantic CSS custom property mappings for an entire theme.
 */
export function getThemeTokens(accentHex: string, mode: "light" | "dark" = "dark"): Record<string, string> {
  const normalized = normalizeHexColor(accentHex);
  const fg = getAccessibleForeground(normalized);
  const hover = getHoverShade(normalized);

  if (mode === "light") {
    return {
      "--background": "#F5F3EF",
      "--foreground": "#191C1B",
      "--card": "#FFFFFF",
      "--surface": "#EEEBE5",
      "--popover": "#FFFFFF",
      "--primary": normalized,
      "--primary-foreground": fg,
      "--primary-hover": hover,
      "--secondary": "#E4E1DB",
      "--secondary-foreground": "#191C1B",
      "--muted": "#E8E5DF",
      "--muted-foreground": "#656A66",
      "--border": "#DCD8D0",
      "--input": "#DCD8D0",
      "--ring": normalized,
    };
  }

  return {
    "--background": "#111514",
    "--foreground": "#F1F0E9",
    "--card": "#18211D",
    "--surface": "#1E2A25",
    "--popover": "#141A17",
    "--primary": normalized,
    "--primary-foreground": fg,
    "--primary-hover": hover,
    "--secondary": "#22312A",
    "--secondary-foreground": "#F1F0E9",
    "--muted": "#1E2A25",
    "--muted-foreground": "#8FA095",
    "--border": "#303B34",
    "--input": "#25332B",
    "--ring": normalized,
  };
}

/**
 * Returns scoped CSS variables for displaying another user's public profile accent
 * without altering global layout variables.
 */
export function getProfileAccentTokens(accentHex: string): Record<string, string> {
  const normalized = normalizeHexColor(accentHex);
  const fg = getAccessibleForeground(normalized);
  const hover = getHoverShade(normalized);

  return {
    "--profile-accent": normalized,
    "--profile-accent-fg": fg,
    "--profile-accent-hover": hover,
    "--profile-accent-border": `${normalized}55`,
  };
}

/**
 * Validates a theme mode string.
 */
export function isValidThemeMode(mode: unknown): mode is ThemeMode {
  return mode === "light" || mode === "dark" || mode === "system";
}
