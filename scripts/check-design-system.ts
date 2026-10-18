import fs from "fs";
import path from "path";
import { PALETTE, DEFAULT_ACCENT } from "../src/lib/theme";

const ROOT = path.resolve(__dirname, "..");
const GLOBALS_CSS = path.join(ROOT, "src/app/globals.css");

console.log("🎨 Verifying Aubrey Rankings Design System Integrity...");

// 1. Verify globals.css contains tokens matching PALETTE
const cssContent = fs.readFileSync(GLOBALS_CSS, "utf-8").toLowerCase();

// Check dark theme palette synchronization
let mismatchCount = 0;

for (const [key, hex] of Object.entries(PALETTE.dark)) {
  const cssVarName = key.replace(/([A-Z])/g, "-$1").toLowerCase();
  const expected = `--${cssVarName}: ${hex.toLowerCase()};`;
  if (!cssContent.includes(expected)) {
    console.error(`❌ Mismatch in globals.css for dark ${key}: expected "${expected}"`);
    mismatchCount++;
  }
}

// Check light theme palette synchronization
for (const [key, hex] of Object.entries(PALETTE.light)) {
  const cssVarName = key.replace(/([A-Z])/g, "-$1").toLowerCase();
  const expected = `--${cssVarName}: ${hex.toLowerCase()};`;
  if (!cssContent.includes(expected)) {
    console.error(`❌ Mismatch in globals.css for light ${key}: expected "${expected}"`);
    mismatchCount++;
  }
}

// Check default accent
if (!cssContent.includes(`--primary: ${DEFAULT_ACCENT.toLowerCase()};`)) {
  console.error(`❌ globals.css does not have default primary accent ${DEFAULT_ACCENT}`);
  mismatchCount++;
}

// Required extensible component tokens
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
  if (!cssContent.includes(token)) {
    console.error(`❌ Missing extensible token in globals.css: ${token}`);
    mismatchCount++;
  }
}

if (mismatchCount === 0) {
  console.log("✔ globals.css and src/lib/theme.ts palettes are 100% synchronized.");
  console.log("✔ Extensible design tokens (--radius-*, --shadow-*, --border-*) verified.");
} else {
  console.error(`❌ Found ${mismatchCount} theme token mismatches.`);
  process.exit(1);
}

// 2. Scan component files for hardcoded legacy crypto/dark hexes
const scanDirs = [
  path.join(ROOT, "src/app"),
  path.join(ROOT, "src/components"),
];

// Hexes that were explicitly banned from presentation code (bypassing semantic tokens)
const forbiddenHexRegex = /#(?:141a17|303b34|181f1b|102523|202b26|19241f|202824)/i;

function walk(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

let hexViolations = 0;
for (const dir of scanDirs) {
  const files = walk(dir);
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    if (forbiddenHexRegex.test(content)) {
      const relPath = path.relative(ROOT, file);
      console.error(`❌ Hardcoded legacy hex violation in ${relPath}`);
      hexViolations++;
    }
  }
}

if (hexViolations === 0) {
  console.log("✔ No legacy crypto/dark hex violations found in app or components.");
} else {
  console.error(`❌ Found ${hexViolations} hardcoded legacy hex violations.`);
  process.exit(1);
}

console.log("✅ Aubrey Rankings Design System check passed cleanly!");
