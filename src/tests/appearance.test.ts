import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isValidHexColor,
  normalizeHexColor,
  getContrastRatio,
  getAccessibleForeground,
  getThemeTokens,
  getProfileAccentTokens,
  DEFAULT_ACCENT_COLOR,
  THEME_PRESETS,
} from "../lib/theme";

describe("Personalized Themes & Accent Color Engine", () => {
  describe("1. Hex Validation & Normalization", () => {
    it("validates standard 6-digit hex colors", () => {
      assert.strictEqual(isValidHexColor("#89D5D5"), true);
      assert.strictEqual(isValidHexColor("#5BA4E6"), true);
      assert.strictEqual(isValidHexColor("#111514"), true);
      assert.strictEqual(isValidHexColor("#ffffff"), true);
      assert.strictEqual(isValidHexColor("#000000"), true);
    });

    it("validates 3-digit hex shorthand", () => {
      assert.strictEqual(isValidHexColor("#fff"), true);
      assert.strictEqual(isValidHexColor("#000"), true);
      assert.strictEqual(isValidHexColor("#abc"), true);
    });

    it("normalizes hex colors correctly", () => {
      assert.strictEqual(normalizeHexColor("89D5D5"), "#89D5D5");
      assert.strictEqual(normalizeHexColor("#89d5d5"), "#89D5D5");
      assert.strictEqual(normalizeHexColor("fff"), "#FFFFFF");
      assert.strictEqual(normalizeHexColor("#abc"), "#AABBCC");
    });

    it("rejects invalid hex strings and CSS injection payloads", () => {
      assert.strictEqual(isValidHexColor("red"), false);
      assert.strictEqual(isValidHexColor("#12345"), false);
      assert.strictEqual(isValidHexColor("#1234567"), false);
      assert.strictEqual(isValidHexColor("#89D5D5; background: red;"), false);
      assert.strictEqual(isValidHexColor("url(evil.com)"), false);
      assert.strictEqual(isValidHexColor(""), false);
      assert.strictEqual(normalizeHexColor("invalid-payload"), DEFAULT_ACCENT_COLOR);
    });
  });

  describe("2. WCAG 2.1 Contrast & Accessibility", () => {
    it("computes accurate contrast ratios against dark backgrounds", () => {
      // Signature teal (#89D5D5) against dark canvas (#111514)
      const tealContrastDark = getContrastRatio("#89D5D5", "#111514");
      assert.ok(
        tealContrastDark >= 4.5,
        `Signature teal must achieve WCAG AA contrast (got ${tealContrastDark}:1)`
      );

      // Film blue (#5BA4E6) against dark canvas
      const blueContrastDark = getContrastRatio("#5BA4E6", "#111514");
      assert.ok(
        blueContrastDark >= 4.5,
        `Film blue must achieve WCAG AA contrast (got ${blueContrastDark}:1)`
      );
    });

    it("computes accurate contrast ratios against light backgrounds", () => {
      // Dark text against light mode canvas (#F5F3EF)
      const textContrastLight = getContrastRatio("#191C1B", "#F5F3EF");
      assert.ok(
        textContrastLight >= 10,
        `Dark text on light background must exceed WCAG AAA (got ${textContrastLight}:1)`
      );
    });

    it("determines accessible foreground (dark vs white text) for accent buttons", () => {
      // Bright teal (#89D5D5) must use dark text for legibility
      const tealFg = getAccessibleForeground("#89D5D5");
      assert.strictEqual(tealFg, "#102523");

      // Warm Coral (#F27A59) should pick the most legible foreground
      const coralFg = getAccessibleForeground("#F27A59");
      const contrastWithDark = getContrastRatio("#F27A59", "#102523");
      const contrastWithWhite = getContrastRatio("#F27A59", "#FFFFFF");
      assert.strictEqual(
        coralFg,
        contrastWithDark >= contrastWithWhite ? "#102523" : "#FFFFFF"
      );

      // Deep dark navy (#0B192C) must use white text
      const darkNavyFg = getAccessibleForeground("#0B192C");
      assert.strictEqual(darkNavyFg, "#FFFFFF");
    });
  });

  describe("3. Presets & Default System Aesthetics", () => {
    it("contains all 6 curated cinematic presets", () => {
      assert.strictEqual(THEME_PRESETS.length, 6);
      const presetIds = THEME_PRESETS.map((p) => p.id);
      assert.deepStrictEqual(presetIds, [
        "signature-teal",
        "film-blue",
        "regal-purple",
        "sage-green",
        "warm-coral",
        "dusty-rose",
      ]);

      const defaultPreset = THEME_PRESETS.find((p) => p.id === "signature-teal");
      assert.ok(defaultPreset);
      assert.strictEqual(defaultPreset.hex, DEFAULT_ACCENT_COLOR);
    });
  });

  describe("4. Dynamic CSS Token Generation", () => {
    it("generates correct theme tokens for dark mode", () => {
      const tokens = getThemeTokens("#5BA4E6", "dark");
      assert.strictEqual(tokens["--primary"], "#5BA4E6");
      assert.strictEqual(tokens["--background"], "#111514");
      assert.strictEqual(tokens["--foreground"], "#F1F0E9");
      assert.ok(tokens["--primary-foreground"]);
      assert.ok(tokens["--primary-hover"]);
      assert.ok(tokens["--ring"]);
    });

    it("generates correct theme tokens for light mode", () => {
      const tokens = getThemeTokens("#5BA4E6", "light");
      assert.strictEqual(tokens["--primary"], "#5BA4E6");
      assert.strictEqual(tokens["--background"], "#F5F3EF");
      assert.strictEqual(tokens["--foreground"], "#191C1B");
      assert.strictEqual(tokens["--card"], "#FFFFFF");
    });

    it("generates scoped profile accent tokens without mutating global background", () => {
      const scopedTokens = getProfileAccentTokens("#9D7FE6");
      assert.strictEqual(scopedTokens["--profile-accent"], "#9D7FE6");
      assert.ok(scopedTokens["--profile-accent-fg"]);
      assert.ok(scopedTokens["--profile-accent-hover"]);
      assert.ok(scopedTokens["--profile-accent-border"]);
      // Scoped tokens should NOT include global layout background
      assert.strictEqual(scopedTokens["--background"], undefined);
    });
  });
});
