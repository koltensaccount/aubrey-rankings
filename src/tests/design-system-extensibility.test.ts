import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PALETTE,
  getThemeTokens,
  getAccessiblePrimaryText,
  getContrastRatio,
  getHoverShade,
} from "../lib/theme";
import { buttonVariants } from "../components/ui/button";

describe("Design System Extensibility & Architectural Invariants", () => {
  it("1. Single Source of Truth: globals.css and theme.ts palettes are synchronized", () => {
    const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // Dark palette synchronization
    assert.ok(cssContent.includes(`--background: ${PALETTE.dark.background.toLowerCase()}`), "Dark background matches");
    assert.ok(cssContent.includes(`--card: ${PALETTE.dark.card.toLowerCase()}`), "Dark card matches");
    assert.ok(cssContent.includes(`--surface: ${PALETTE.dark.surface.toLowerCase()}`), "Dark surface matches");
    assert.ok(cssContent.includes(`--surface-elevated: ${PALETTE.dark.surfaceElevated.toLowerCase()}`), "Dark surface-elevated matches");
    assert.ok(cssContent.includes(`--border: ${PALETTE.dark.border.toLowerCase()}`), "Dark border matches");
    assert.ok(cssContent.includes(`--foreground: ${PALETTE.dark.foreground.toLowerCase()}`), "Dark foreground matches");
    assert.ok(cssContent.includes(`--muted-foreground: ${PALETTE.dark.mutedForeground.toLowerCase()}`), "Dark muted-foreground matches");

    // Light palette synchronization
    assert.ok(cssContent.includes(`--background: ${PALETTE.light.background.toLowerCase()}`), "Light background matches");
    assert.ok(cssContent.includes(`--card: ${PALETTE.light.card.toLowerCase()}`), "Light card matches");
    assert.ok(cssContent.includes(`--surface: ${PALETTE.light.surface.toLowerCase()}`), "Light surface matches");
    assert.ok(cssContent.includes(`--surface-elevated: ${PALETTE.light.surfaceElevated.toLowerCase()}`), "Light surface-elevated matches");
    assert.ok(cssContent.includes(`--border: ${PALETTE.light.border.toLowerCase()}`), "Light border matches");
    assert.ok(cssContent.includes(`--foreground: ${PALETTE.light.foreground.toLowerCase()}`), "Light foreground matches");
    assert.ok(cssContent.includes(`--muted-foreground: ${PALETTE.light.mutedForeground.toLowerCase()}`), "Light muted-foreground matches");
  });

  it("2. Extensible Tokens: globals.css exports semantic component radii and shadows", () => {
    const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    const requiredTokens = [
      "--radius-card",
      "--radius-dialog",
      "--radius-button",
      "--radius-input",
      "--radius-comment",
      "--radius-badge",
      "--shadow-card",
      "--shadow-dialog",
      "--shadow-popover",
      "--shadow-elevated",
      "--border-card",
      "--border-dialog",
      "--border-input",
      "--color-surface-raised",
    ];

    for (const token of requiredTokens) {
      assert.ok(cssContent.includes(token), `globals.css must define or map ${token}`);
    }
  });

  it("3. Button Variants: default is neutral surface and primary is explicit brand accent", () => {
    const defaultClasses = buttonVariants({ variant: "default" });
    assert.ok(
      defaultClasses.includes("bg-surface") && defaultClasses.includes("text-foreground"),
      `Button default must be neutral surface (got ${defaultClasses})`
    );
    assert.ok(
      defaultClasses.includes("rounded-button"),
      "Button default must use --radius-button token"
    );

    const primaryClasses = buttonVariants({ variant: "primary" });
    assert.ok(
      primaryClasses.includes("bg-primary") && primaryClasses.includes("text-primary-foreground"),
      `Button primary must use accent token (got ${primaryClasses})`
    );
    assert.ok(
      primaryClasses.includes("rounded-button"),
      "Button primary must use --radius-button token"
    );
  });

  it("4. Acceptance Test: Extreme Accent Colors maintain WCAG AA contrast (>= 4.5:1)", () => {
    const extremeAccents = ["#000000", "#FFFFFF", "#89D5D5", "#F97316", "#9D7FE6"];

    for (const accent of extremeAccents) {
      const darkText = getAccessiblePrimaryText(accent, "dark");
      const darkRatio = getContrastRatio(darkText, PALETTE.dark.background);
      assert.ok(
        darkRatio >= 4.5,
        `Dark mode contrast for ${accent} must be >= 4.5:1 (got ${darkRatio}:1)`
      );

      const lightText = getAccessiblePrimaryText(accent, "light");
      const lightRatio = getContrastRatio(lightText, PALETTE.light.background);
      assert.ok(
        lightRatio >= 4.5,
        `Light mode contrast for ${accent} must be >= 4.5:1 (got ${lightRatio}:1)`
      );
    }
  });

  it("5. Acceptance Test: Hover shade for pure black (#000000) produces a visible lift", () => {
    const blackHover = getHoverShade("#000000");
    assert.notStrictEqual(blackHover, "#000000");
    assert.strictEqual(blackHover, "#232323");
  });
});
