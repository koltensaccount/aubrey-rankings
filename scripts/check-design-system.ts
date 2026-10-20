import fs from "fs";
import path from "path";
import { PALETTE, DEFAULT_ACCENT } from "../src/lib/theme";

export const ROOT = path.resolve(__dirname, "..");
export const GLOBALS_CSS = path.join(ROOT, "src/app/globals.css");
export const BASELINE_PATH = path.join(ROOT, "scripts/design-system-baseline.json");

export const FORBIDDEN_HEX_REGEX = /#(?:141a17|303b34|181f1b|102523|202b26|19241f|202824)/i;

export const HARDCODED_COLOR_REGEX =
  /\b(?:bg|text|border|fill|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:[1-9]00|\d{2,3})(?:\/\d+)?\b/g;

export const ARBITRARY_HEX_REGEX =
  /\b(?:bg|text|border|fill|ring|from|to|via)-\[#[0-9a-fA-F]{3,8}\]/g;

export interface BaselineEntry {
  line?: number;
  tokens: string[];
  snippet: string;
}

export type BaselineMap = Record<string, BaselineEntry[]>;

export interface Violation {
  file: string;
  line: number;
  tokens: string[];
  snippet: string;
}

export function isLegitimateException(line: string): boolean {
  const trimmed = line.trim();
  // Pure comments or block comment continuations
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return true;
  }
  // User data tier color definitions and swatches
  if (
    trimmed.includes("COLOR_SWATCHES") ||
    trimmed.includes("DEFAULT_TIERS") ||
    trimmed.includes("DEFAULT_TIER_DEFINITIONS")
  ) {
    return true;
  }
  // Inline styles for user data tier colors (e.g. style={{ backgroundColor: tier.color }})
  if (
    trimmed.includes("style={{ backgroundColor:") ||
    trimmed.includes("style={{ color:") ||
    trimmed.includes("style={{ borderColor:")
  ) {
    return true;
  }
  // Legitimate third-party brand logo SVG paths (e.g., Google logo colors)
  if (
    /fill="#(?:4285F4|34A853|FBBC05|EA4335)"/i.test(trimmed) ||
    /d="M22\.56 12\.25/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

export function findViolationsInLine(line: string): string[] {
  if (isLegitimateException(line)) return [];
  const colorMatches = line.match(HARDCODED_COLOR_REGEX) || [];
  const hexMatches = line.match(ARBITRARY_HEX_REGEX) || [];
  return [...colorMatches, ...hexMatches];
}

export function checkPaletteSync(cssContent: string): { success: boolean; errors: string[] } {
  const errors: string[] = [];
  const lowerCss = cssContent.toLowerCase();

  // Check dark theme palette synchronization
  for (const [key, hex] of Object.entries(PALETTE.dark)) {
    const cssVarName = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    const expected = `--${cssVarName}: ${hex.toLowerCase()};`;
    if (!lowerCss.includes(expected)) {
      errors.push(`Mismatch in globals.css for dark ${key}: expected "${expected}"`);
    }
  }

  // Check light theme palette synchronization
  for (const [key, hex] of Object.entries(PALETTE.light)) {
    const cssVarName = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    const expected = `--${cssVarName}: ${hex.toLowerCase()};`;
    if (!lowerCss.includes(expected)) {
      errors.push(`Mismatch in globals.css for light ${key}: expected "${expected}"`);
    }
  }

  // Check default accent
  if (!lowerCss.includes(`--primary: ${DEFAULT_ACCENT.toLowerCase()};`)) {
    errors.push(`globals.css does not have default primary accent ${DEFAULT_ACCENT}`);
  }

  // Extensible component tokens
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

export function walkDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDirectory(fullPath, fileList);
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function loadBaseline(baselinePath: string = BASELINE_PATH): BaselineMap {
  if (!fs.existsSync(baselinePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
  } catch (err) {
    console.error(`Failed to parse baseline file: ${err}`);
    return {};
  }
}

export function auditFileContent(
  relPath: string,
  content: string,
  fileBaseline: BaselineEntry[] = []
): { newViolations: Violation[]; historicalViolations: Violation[] } {
  const lines = content.split("\n");
  const newViolations: Violation[] = [];
  const historicalViolations: Violation[] = [];

  // Copy baseline entries so we can match them greedily
  const unusedBaseline = [...fileBaseline];

  lines.forEach((line, idx) => {
    const tokens = findViolationsInLine(line);
    if (tokens.length === 0) return;

    const trimmed = line.trim();
    const violation: Violation = {
      file: relPath,
      line: idx + 1,
      tokens,
      snippet: trimmed,
    };

    // Attempt to match with an unused baseline entry
    const matchIndex = unusedBaseline.findIndex((b) => {
      // Primary match: exact trimmed line snippet
      if (b.snippet === trimmed) return true;
      // Secondary match: same tokens on same line number
      if (b.line === idx + 1 && JSON.stringify(b.tokens.slice().sort()) === JSON.stringify(tokens.slice().sort())) {
        return true;
      }
      return false;
    });

    if (matchIndex !== -1) {
      unusedBaseline.splice(matchIndex, 1);
      historicalViolations.push(violation);
    } else {
      newViolations.push(violation);
    }
  });

  return { newViolations, historicalViolations };
}

export function runDesignSystemAudit(rootDir: string = ROOT) {
  const errors: string[] = [];
  const newViolations: Violation[] = [];
  let legacyHexViolations = 0;

  // 1. Palette synchronization
  const cssPath = path.join(rootDir, "src/app/globals.css");
  if (!fs.existsSync(cssPath)) {
    errors.push(`Missing globals.css at ${cssPath}`);
  } else {
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    const syncRes = checkPaletteSync(cssContent);
    if (!syncRes.success) {
      errors.push(...syncRes.errors);
    }
  }

  // 2. Scan component files for forbidden legacy crypto/dark hexes
  const scanDirs = [path.join(rootDir, "src/app"), path.join(rootDir, "src/components")];
  const allFiles: string[] = [];
  for (const dir of scanDirs) {
    walkDirectory(dir, allFiles);
  }

  for (const file of allFiles) {
    const content = fs.readFileSync(file, "utf-8");
    if (FORBIDDEN_HEX_REGEX.test(content)) {
      const relPath = path.relative(rootDir, file);
      errors.push(`Hardcoded legacy dark/crypto hex violation in ${relPath}`);
      legacyHexViolations++;
    }
  }

  // 3. Scan all UI code for hardcoded Tailwind colors & arbitrary hexes
  const baseline = loadBaseline(path.join(rootDir, "scripts/design-system-baseline.json"));
  let historicalTotal = 0;

  for (const file of allFiles) {
    const relPath = path.relative(rootDir, file);
    const content = fs.readFileSync(file, "utf-8");
    const fileBaseline = baseline[relPath] || [];

    const { newViolations: fileNew, historicalViolations: fileHist } = auditFileContent(
      relPath,
      content,
      fileBaseline
    );

    historicalTotal += fileHist.length;

    if (fileNew.length > 0) {
      newViolations.push(...fileNew);
    }
  }

  return {
    success: errors.length === 0 && newViolations.length === 0,
    errors,
    newViolations,
    legacyHexViolations,
    historicalTotal,
  };
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith("check-design-system.ts")) {
  console.log("🎨 Verifying Aubrey Rankings Design System Integrity...");

  const result = runDesignSystemAudit();

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(`❌ ${err}`);
    }
  }

  if (result.newViolations.length > 0) {
    console.error(`\n❌ Found ${result.newViolations.length} NEW hardcoded design token violation(s):`);
    for (const v of result.newViolations) {
      console.error(`  ${v.file}:${v.line}: [${v.tokens.join(", ")}]`);
      console.error(`    ↳ Line: ${v.snippet}\n`);
    }
    console.error(
      "👉 Do not use raw Tailwind palette colors (amber-*, red-*, emerald-*, etc.) or arbitrary hexes for UI chrome."
    );
    console.error(
      "👉 Use semantic tokens: bg-primary, text-primary-text, bg-surface, border-border, text-destructive, etc."
    );
  }

  if (result.success) {
    console.log("✔ globals.css and src/lib/theme.ts palettes are 100% synchronized.");
    console.log("✔ Extensible design tokens (--radius-*, --shadow-*, --border-*) verified.");
    console.log("✔ No legacy crypto/dark hex violations found in app or components.");
    console.log(
      `✔ Universal design token audit passed: 0 new violations (${result.historicalTotal} tolerated historical baseline entries).`
    );
    console.log("✅ Aubrey Rankings Design System check passed cleanly!");
    process.exit(0);
  } else {
    console.error("\n❌ Aubrey Rankings Design System verification failed!");
    process.exit(1);
  }
}
