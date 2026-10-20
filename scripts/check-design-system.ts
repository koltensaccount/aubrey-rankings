import fs from "fs";
import path from "path";
import { PALETTE, DEFAULT_ACCENT } from "../src/lib/theme";

export const ROOT = path.resolve(__dirname, "..");
export const GLOBALS_CSS = path.join(ROOT, "src/app/globals.css");
export const BASELINE_PATH = path.join(ROOT, "scripts/design-system-baseline.json");

// Banned legacy crypto/dark hexes that bypass semantic tokens
export const FORBIDDEN_HEX_REGEX = /#(?:141a17|303b34|181f1b|102523|202b26|19241f|202824)/i;

// Covers all 22 standard Tailwind color families, all UI color prefixes (bg, text, border, fill, ring, from, to, via, accent, outline, divide),
// standard shades (50, 100-900, 950), optional opacity modifiers (/10, /25, etc.), and arbitrary variant prefixes (hover:, dark:, etc.)
export const COLOR_UTILITY_REGEX =
  /\b(?:[a-z0-9-]+:)*(?:bg|text|border|fill|ring|from|to|via|accent|outline|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)(?:\/\d+)?\b/g;

// Arbitrary hex color utilities forbidden in UI chrome (including variant prefixes)
export const ARBITRARY_HEX_REGEX =
  /\b(?:[a-z0-9-]+:)*(?:bg|text|border|fill|ring|from|to|via|accent|outline|divide)-\[#[0-9a-fA-F]{3,8}\]/g;

export interface TokenOccurrence {
  line: number;
  token: string;
}

export interface Violation {
  file: string;
  line: number;
  token: string;
}

/**
 * Checks whether globals.css tokens are in sync with PALETTE in src/lib/theme.ts.
 */
export function checkPaletteSync(cssContent: string): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  const lowerCss = cssContent.toLowerCase();

  for (const [key, hex] of Object.entries(PALETTE.dark)) {
    const cssVar = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${hex.toLowerCase()};`;
    if (!lowerCss.includes(cssVar)) {
      errors.push(`Mismatch in globals.css for dark ${key}: expected "${cssVar}"`);
    }
  }

  for (const [key, hex] of Object.entries(PALETTE.light)) {
    const cssVar = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${hex.toLowerCase()};`;
    if (!lowerCss.includes(cssVar)) {
      errors.push(`Mismatch in globals.css for light ${key}: expected "${cssVar}"`);
    }
  }

  if (!lowerCss.includes(`--primary: ${DEFAULT_ACCENT.toLowerCase()};`)) {
    errors.push(`globals.css does not have default primary accent ${DEFAULT_ACCENT}`);
  }

  const extensibleTokens = [
    "--radius-card:",
    "--radius-dialog:",
    "--radius-button:",
    "--radius-input:",
    "--radius-comment:",
    "--shadow-card:",
    "--shadow-dialog:",
    "--shadow-popover:",
    "--shadow-elevated:",
    "--border-card:",
    "--border-dialog:",
    "--border-input:",
  ];

  for (const token of extensibleTokens) {
    if (!lowerCss.includes(token)) {
      errors.push(`Missing extensible token in globals.css: ${token}`);
    }
  }

  return { success: errors.length === 0, errors };
}

/**
 * Finds all forbidden color tokens in a file's content, ignoring comments.
 */
export function extractColorTokens(content: string): TokenOccurrence[] {
  const lines = content.split("\n");
  const occurrences: TokenOccurrence[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // Ignore pure comments
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

    const colorMatches = line.match(COLOR_UTILITY_REGEX) || [];
    const hexMatches = line.match(ARBITRARY_HEX_REGEX) || [];

    for (const token of [...colorMatches, ...hexMatches]) {
      occurrences.push({ line: idx + 1, token });
    }
  });

  return occurrences;
}

/**
 * Audits tokens found in a file against its allowed baseline list.
 * Note: The compact baseline enforces per-file token occurrence pools for historical files.
 * If a file is unbaselined, any token occurrence is flagged as a new violation.
 * For baselined files, any token occurrence exceeding or outside the historical pool is flagged.
 */
export function auditFileTokens(
  filePath: string,
  tokensFound: TokenOccurrence[],
  allowedTokens: string[] = []
): Violation[] {
  const remainingBaseline = [...allowedTokens];
  const newViolations: Violation[] = [];

  for (const item of tokensFound) {
    const matchIndex = remainingBaseline.indexOf(item.token);
    if (matchIndex !== -1) {
      remainingBaseline.splice(matchIndex, 1);
    } else {
      newViolations.push({
        file: filePath,
        line: item.line,
        token: item.token,
      });
    }
  }

  return newViolations;
}

/**
 * Recursively scans directory for TypeScript UI components, ignoring prototype mockups.
 */
export function getUIFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (entry === "prototype") continue; // Exclude archived prototype mockups
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getUIFiles(fullPath, fileList);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Runs complete design system check across the codebase.
 */
export function runDesignSystemAudit(rootDir: string = ROOT) {
  const errors: string[] = [];
  const newViolations: Violation[] = [];

  // 1. Check palette synchronization
  const cssPath = path.join(rootDir, "src/app/globals.css");
  if (fs.existsSync(cssPath)) {
    const sync = checkPaletteSync(fs.readFileSync(cssPath, "utf-8"));
    if (!sync.success) errors.push(...sync.errors);
  } else {
    errors.push(`globals.css not found at ${cssPath}`);
  }

  // 2. Scan UI files
  const searchDirs = [path.join(rootDir, "src/app"), path.join(rootDir, "src/components")];
  const uiFiles: string[] = [];
  for (const dir of searchDirs) {
    getUIFiles(dir, uiFiles);
  }

  // Load baseline
  const baselinePath = path.join(rootDir, "scripts/design-system-baseline.json");
  const baseline: Record<string, string[]> = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, "utf-8"))
    : {};

  for (const file of uiFiles) {
    const relPath = path.relative(rootDir, file);
    const content = fs.readFileSync(file, "utf-8");

    // Check forbidden legacy hexes
    if (FORBIDDEN_HEX_REGEX.test(content)) {
      errors.push(`Hardcoded legacy hex violation in ${relPath}`);
    }

    // Check color utility tokens against baseline pool
    const tokensFound = extractColorTokens(content);
    const allowed = baseline[relPath] || [];
    const violations = auditFileTokens(relPath, tokensFound, allowed);
    if (violations.length > 0) {
      newViolations.push(...violations);
    }
  }

  return {
    success: errors.length === 0 && newViolations.length === 0,
    errors,
    newViolations,
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith("check-design-system.ts")) {
  console.log("🎨 Verifying Aubrey Rankings Design System Integrity...");

  const result = runDesignSystemAudit();

  if (result.errors.length > 0) {
    for (const err of result.errors) console.error(`❌ ${err}`);
  }

  if (result.newViolations.length > 0) {
    console.error(`\n❌ Found ${result.newViolations.length} NEW design token violation(s):`);
    for (const v of result.newViolations) {
      console.error(`  ${v.file}:${v.line}: Found forbidden token "${v.token}"`);
      console.error(`    ↳ Rule: Raw Tailwind palette colors (amber-*, red-*, etc.) are forbidden in UI chrome.`);
      console.error(`    ↳ Fix: Use semantic design tokens from docs/DESIGN_SYSTEM.md:`);
      console.error(`        • Verified / Success: bg-primary/10 text-primary-text border-primary/25`);
      console.error(`        • Unverified / Neutral: bg-surface-elevated text-muted-foreground border-border`);
      console.error(`        • Error / Destructive: bg-destructive/10 text-destructive border-destructive/20\n`);
    }
  }

  if (result.success) {
    console.log("✔ globals.css and src/lib/theme.ts palettes are 100% synchronized.");
    console.log("✔ No forbidden legacy dark/crypto hexes found.");
    console.log("✔ Design token audit passed with 0 new violations.");
    console.log("✅ Aubrey Rankings Design System check passed cleanly!");
    process.exit(0);
  } else {
    console.error("❌ Aubrey Rankings Design System verification failed!");
    process.exit(1);
  }
}
