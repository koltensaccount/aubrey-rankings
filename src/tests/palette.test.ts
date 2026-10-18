import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hexToRgb, rgbToOklch, calibrateOklchTheme } from "../lib/palette";

describe("Stage 7: Dynamic Artwork Personalization & OKLCH Contrast Guarantees", () => {
  it("1. Hex Parsing: converts 6-char, 3-char, and invalid hexes safely", () => {
    const [r1, g1, b1] = hexToRgb("#ffffff");
    assert.equal(r1, 1);
    assert.equal(g1, 1);
    assert.equal(b1, 1);

    const [r2, g2, b2] = hexToRgb("#000");
    assert.equal(r2, 0);
    assert.equal(g2, 0);
    assert.equal(b2, 0);

    // Invalid hex falls back to Aubrey teal
    const [r3, g3, b3] = hexToRgb("invalid");
    assert.ok(r3 > 0.5 && g3 > 0.8 && b3 > 0.8);
  });

  it("2. OKLCH Conversion: computes accurate perceived lightness, chroma, and hue", () => {
    // Pure White
    const whiteOklch = rgbToOklch(1, 1, 1);
    assert.equal(whiteOklch.l, 1);
    assert.equal(whiteOklch.c, 0);

    // Aubrey Teal (#89d5d5)
    const [tr, tg, tb] = hexToRgb("#89d5d5");
    const tealOklch = rgbToOklch(tr, tg, tb);
    assert.ok(tealOklch.l >= 0.75, "Aubrey teal should have high perceived lightness");
    assert.ok(tealOklch.h >= 180 && tealOklch.h <= 210, "Hue should be in teal spectrum");
  });

  it("3. Contrast Guarantee: lifts dark poster hues to guarantee >= 4.5:1 contrast against #111514", () => {
    // Very dark moody poster burgundy / navy (#1a0d26)
    const darkTheme = calibrateOklchTheme("#1a0d26");
    assert.ok(
      darkTheme.calibratedOklch.l >= 0.72,
      `Calibrated lightness should be >= 0.72 (got ${darkTheme.calibratedOklch.l})`
    );
    assert.ok(
      darkTheme.contrastRatioAgainstDark >= 4.5,
      `Contrast ratio must meet WCAG AA (got ${darkTheme.contrastRatioAgainstDark}:1)`
    );
    assert.match(darkTheme.primaryAccent, /^oklch\(0\.7[2-9]/);
  });

  it("4. Editorial Restraint: clamps radioactive neon colors to prevent garish styling", () => {
    // Harsh neon green (#00ff00)
    const neonTheme = calibrateOklchTheme("#00ff00");
    assert.ok(
      neonTheme.calibratedOklch.c <= 0.14,
      `Chroma should be restrained for cinema elegance (got ${neonTheme.calibratedOklch.c})`
    );
    assert.ok(
      neonTheme.contrastRatioAgainstDark >= 4.5,
      "Maintains legibility against dark background"
    );
  });

  it("5. CSS Generation: outputs valid oklch() color definitions for aura, borders, and chips", () => {
    const theme = calibrateOklchTheme("#d97706"); // Amber blade runner tone
    assert.ok(theme.primaryAccent.startsWith("oklch("));
    assert.ok(theme.softGlow.includes("/ 0.18"));
    assert.ok(theme.borderTone.includes("/ 0.35"));
    assert.ok(theme.badgeBg.startsWith("oklch("));
    assert.ok(theme.badgeText.startsWith("oklch("));
  });
});
