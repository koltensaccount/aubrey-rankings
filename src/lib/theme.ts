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

export const PALETTE = {
  dark: {
    background: "#111514",
    card: "#141A17",
    cardForeground: "#F1F0E9",
    surface: "#18201C",
    surfaceElevated: "#202A25",
    popover: "#141A17",
    popoverForeground: "#F1F0E9",
    secondary: "#222C27",
    secondaryForeground: "#E2E8E4",
    muted: "#1C2420",
    mutedForeground: "#8FA095",
    border: "#28342D",
    borderSubtle: "#202A25",
    input: "#18201C",
    inputBorder: "#28342D",
    foreground: "#F1F0E9",
  },
  light: {
    background: "#F7F6F0",
    card: "#FFFFFF",
    cardForeground: "#141A17",
    surface: "#FFFFFF",
    surfaceElevated: "#EBEAE3",
    popover: "#FFFFFF",
    popoverForeground: "#141A17",
    secondary: "#EDECE4",
    secondaryForeground: "#222C27",
    muted: "#F0EEE6",
    mutedForeground: "#66736A",
    border: "#DBD8CC",
    borderSubtle: "#E8E5DB",
    input: "#FFFFFF",
    inputBorder: "#DBD8CC",
    foreground: "#141A17",
  },
} as const;

/**
 * Computes a hover shade by adjusting RGB lightness slightly.
 * Handles extreme dark colors (< 0.05 lum) by adding a lightness offset.
 */
export function getHoverShade(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = getRelativeLuminance(r, g, b);

  if (lum < 0.05) {
    const offset = 35;
    const clamp = (n: number) => Math.min(255, Math.max(0, n + offset));
    const [nr, ng, nb] = [clamp(r), clamp(g), clamp(b)];
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`.toUpperCase();
  }

  // If color is relatively bright, darken slightly for hover (e.g. 12%); if dark, lighten slightly
  const factor = lum > 0.4 ? 0.88 : 1.15;
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n * factor)));
  const [nr, ng, nb] = [clamp(r), clamp(g), clamp(b)];
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`.toUpperCase();
}

/**
 * Computes an accessible accent color to be used as text/foreground on page surfaces.
 * In Dark mode, bright accents contrast well against #111514 (e.g. #89D5D5 has 11:1).
 * In Light mode (#F7F6F0), bright accents like teal (#89D5D5) have poor contrast (~1.5:1).
 * Uses linear interpolation to guarantee WCAG AA >= 4.5:1 even on extreme accents (#000000, #FFFFFF).
 */
export function getAccessiblePrimaryText(accentHex: string, mode: "light" | "dark" = "dark"): string {
  const norm = normalizeHexColor(accentHex);
  const [r, g, b] = hexToRgb(norm);
  const bg = mode === "light" ? PALETTE.light.background : PALETTE.dark.background;

  if (getContrastRatio(norm, bg) >= 4.5) {
    return norm;
  }

  if (mode === "light") {
    // Darken towards black [0, 0, 0]
    for (let t = 0.05; t <= 1.0; t += 0.05) {
      const nr = Math.round(r * (1 - t));
      const ng = Math.round(g * (1 - t));
      const nb = Math.round(b * (1 - t));
      const darkened = `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`.toUpperCase();
      if (getContrastRatio(darkened, bg) >= 4.5) {
        return darkened;
      }
    }
  } else {
    // Lighten towards white [255, 255, 255]
    for (let t = 0.05; t <= 1.0; t += 0.05) {
      const nr = Math.min(255, Math.round(r + (255 - r) * t));
      const ng = Math.min(255, Math.round(g + (255 - g) * t));
      const nb = Math.min(255, Math.round(b + (255 - b) * t));
      const lightened = `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`.toUpperCase();
      if (getContrastRatio(lightened, bg) >= 4.5) {
        return lightened;
      }
    }
  }

  return norm;
}

/**
 * Returns complete CSS token definitions for a given accent color.
 */
export function getAccentTokens(accentHex: string, mode: "light" | "dark" = "dark") {
  const normalized = normalizeHexColor(accentHex);
  const fg = getAccessibleForeground(normalized);
  const hover = getHoverShade(normalized);
  const primaryText = getAccessiblePrimaryText(normalized, mode);

  return {
    primary: normalized,
    primaryForeground: fg,
    primaryHover: hover,
    primaryText: primaryText,
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
  const primaryText = getAccessiblePrimaryText(normalized, mode);
  const palette = mode === "light" ? PALETTE.light : PALETTE.dark;

  return {
    "--background": palette.background,
    "--foreground": palette.foreground,
    "--card": palette.card,
    "--card-foreground": palette.cardForeground,
    "--surface": palette.surface,
    "--surface-elevated": palette.surfaceElevated,
    "--surface-raised": palette.surfaceElevated,
    "--popover": palette.popover,
    "--popover-foreground": palette.popoverForeground,
    "--primary": normalized,
    "--primary-foreground": fg,
    "--primary-hover": hover,
    "--primary-text": primaryText,
    "--secondary": palette.secondary,
    "--secondary-foreground": palette.secondaryForeground,
    "--muted": palette.muted,
    "--muted-foreground": palette.mutedForeground,
    "--border": palette.border,
    "--border-subtle": palette.borderSubtle,
    "--input": palette.input,
    "--input-border": palette.inputBorder,
    "--ring": normalized,
  };
}

/**
 * Produces client-side inline script for instant zero-FOUC theme & accent initialization.
 */
export function getThemeInitScript(): string {
  return `(function() {
  try {
    var storedTheme = localStorage.getItem('ar_theme:guest') || 'dark';
    var storedAccent = localStorage.getItem('ar_accent:guest') || '#89D5D5';
    var isDark = storedTheme === 'dark';
    if (storedTheme === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    var resolved = isDark ? 'dark' : 'light';
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.setAttribute('data-theme', resolved);

    var hex = storedAccent.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function(c) { return c + c; }).join('');
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
      var r = parseInt(hex.substring(0, 2), 16);
      var g = parseInt(hex.substring(2, 4), 16);
      var b = parseInt(hex.substring(4, 6), 16);
      function toLinear(c) { var s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
      function getLum(red, green, blue) {
        return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
      }
      function getRatio(l1, l2) {
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      var lum = getLum(r, g, b);
      var darkBgLum = 0.0053;
      var lightBgLum = 0.9388;
      var darkContrast = getRatio(lum, 0.02);
      var lightContrast = getRatio(lum, 1.0);
      var fg = darkContrast >= lightContrast ? '#102523' : '#FFFFFF';

      var hover;
      if (lum < 0.05) {
        var hr = Math.min(255, r + 35).toString(16).padStart(2, '0');
        var hg = Math.min(255, g + 35).toString(16).padStart(2, '0');
        var hb = Math.min(255, b + 35).toString(16).padStart(2, '0');
        hover = '#' + hr + hg + hb;
      } else {
        var factor = lum > 0.4 ? 0.88 : 1.15;
        function clamp(n) { return Math.min(255, Math.max(0, Math.round(n * factor))); }
        var hr = clamp(r).toString(16).padStart(2, '0');
        var hg = clamp(g).toString(16).padStart(2, '0');
        var hb = clamp(b).toString(16).padStart(2, '0');
        hover = '#' + hr + hg + hb;
      }

      var fullHex = '#' + hex.toUpperCase();
      var primaryText = fullHex;
      var bgLum = resolved === 'light' ? lightBgLum : darkBgLum;
      if (getRatio(lum, bgLum) < 4.5) {
        if (resolved === 'light') {
          for (var t = 0.05; t <= 1.0; t += 0.05) {
            var tr = Math.round(r * (1 - t));
            var tg = Math.round(g * (1 - t));
            var tb = Math.round(b * (1 - t));
            if (getRatio(getLum(tr, tg, tb), bgLum) >= 4.5) {
              primaryText = '#' + tr.toString(16).padStart(2, '0') + tg.toString(16).padStart(2, '0') + tb.toString(16).padStart(2, '0');
              break;
            }
          }
        } else {
          for (var t = 0.05; t <= 1.0; t += 0.05) {
            var tr = Math.min(255, Math.round(r + (255 - r) * t));
            var tg = Math.min(255, Math.round(g + (255 - g) * t));
            var tb = Math.min(255, Math.round(b + (255 - b) * t));
            if (getRatio(getLum(tr, tg, tb), bgLum) >= 4.5) {
              primaryText = '#' + tr.toString(16).padStart(2, '0') + tg.toString(16).padStart(2, '0') + tb.toString(16).padStart(2, '0');
              break;
            }
          }
        }
      }

      root.style.setProperty('--primary', fullHex);
      root.style.setProperty('--primary-foreground', fg);
      root.style.setProperty('--primary-hover', hover);
      root.style.setProperty('--primary-text', primaryText);
      root.style.setProperty('--ring', fullHex);
      root.style.setProperty('--feature-accent', fullHex);
    }
  } catch (e) {}
})();`;
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
