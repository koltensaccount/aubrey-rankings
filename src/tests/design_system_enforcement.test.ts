import assert from "node:assert";
import { describe, it } from "node:test";
import {
  findViolationsInLine,
  isLegitimateException,
  auditFileContent,
  checkPaletteSync,
  runDesignSystemAudit,
} from "../../scripts/check-design-system";
import fs from "node:fs";
import path from "node:path";

describe("Permanent Design Token Enforcement", () => {
  describe("Line-level violation detection", () => {
    it("flags hardcoded amber badge as a violation (Settings → Account regression pattern)", () => {
      const amberBadgeLine =
        '<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">';
      const violations = findViolationsInLine(amberBadgeLine);
      assert.strictEqual(violations.length, 3);
      assert.ok(violations.includes("bg-amber-500/10"));
      assert.ok(violations.includes("text-amber-400"));
      assert.ok(violations.includes("border-amber-500/20"));
    });

    it("flags hardcoded emerald and red badges/banners as violations", () => {
      const emeraldLine = '<div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">';
      const redLine = '<div className="bg-red-500/10 border border-red-500/20 text-red-400">';

      const emeraldViolations = findViolationsInLine(emeraldLine);
      assert.strictEqual(emeraldViolations.length, 3);
      assert.ok(emeraldViolations.includes("bg-emerald-500/10"));

      const redViolations = findViolationsInLine(redLine);
      assert.strictEqual(redViolations.length, 3);
      assert.ok(redViolations.includes("text-red-400"));
    });

    it("flags arbitrary hardcoded hex classes like bg-[#123456]", () => {
      const arbitraryHexLine = '<div className="bg-[#141a17] text-[#89d5d5] border-[#28342d]">';
      const violations = findViolationsInLine(arbitraryHexLine);
      assert.strictEqual(violations.length, 3);
      assert.ok(violations.includes("bg-[#141a17]"));
      assert.ok(violations.includes("text-[#89d5d5]"));
      assert.ok(violations.includes("border-[#28342d]"));
    });

    it("passes approved semantic token verified badge", () => {
      const semanticVerifiedLine =
        '<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary-text border border-primary/25">';
      const violations = findViolationsInLine(semanticVerifiedLine);
      assert.strictEqual(violations.length, 0);
    });

    it("passes approved neutral unverified badge", () => {
      const neutralUnverifiedLine =
        '<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-elevated text-muted-foreground border border-border">';
      const violations = findViolationsInLine(neutralUnverifiedLine);
      assert.strictEqual(violations.length, 0);
    });

    it("passes approved semantic destructive error banner", () => {
      const destructiveLine =
        '<div className="p-3 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-xs">';
      const violations = findViolationsInLine(destructiveLine);
      assert.strictEqual(violations.length, 0);
    });
  });

  describe("Exceptions & Content Rules", () => {
    it("recognizes pure code comments as exempt from violation detection", () => {
      assert.ok(isLegitimateException("// Check text-amber-400 contrast on dark surface"));
      assert.ok(isLegitimateException("/* Legacy bg-red-500 reference */"));
      assert.ok(isLegitimateException(" * Note: avoid using emerald-500"));

      const commentLine = "// className='bg-amber-500 text-amber-400'";
      assert.strictEqual(findViolationsInLine(commentLine).length, 0);
    });

    it("recognizes Google brand logo SVG paths as legitimate brand exceptions", () => {
      const googleSvgPath = '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92..." />';
      assert.ok(isLegitimateException(googleSvgPath));
      assert.strictEqual(findViolationsInLine(googleSvgPath).length, 0);
    });

    it("recognizes user tier color swatches and dynamic tier styling as exceptions", () => {
      const swatchLine = 'const COLOR_SWATCHES = ["#EF4444", "#F97316", "#F59E0B", "#10B981"];';
      assert.ok(isLegitimateException(swatchLine));
      assert.strictEqual(findViolationsInLine(swatchLine).length, 0);

      const dynamicInlineStyle = '<div style={{ backgroundColor: tier.color }} className="w-8 h-8 rounded" />';
      assert.ok(isLegitimateException(dynamicInlineStyle));
      assert.strictEqual(findViolationsInLine(dynamicInlineStyle).length, 0);
    });
  });

  describe("File auditing & baseline enforcement", () => {
    it("rejects an unbaselined component introducing hardcoded amber or emerald", () => {
      const fakeComponent = `
        export function NewComponent() {
          return (
            <div className="bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span>Warning</span>
            </div>
          );
        }
      `;

      const { newViolations, historicalViolations } = auditFileContent(
        "src/components/new-component.tsx",
        fakeComponent,
        [] // empty baseline for a new component
      );

      assert.strictEqual(historicalViolations.length, 0);
      assert.strictEqual(newViolations.length, 1);
      assert.strictEqual(newViolations[0].tokens.length, 3);
      assert.ok(newViolations[0].tokens.includes("bg-amber-500/10"));
    });

    it("accepts a component whose violations match historical baseline entries", () => {
      const historicalSnippet = '<div className="bg-red-500 text-white">';
      const historicalComponent = `
        export function LegacyView() {
          return (
            ${historicalSnippet}
              <span>Legacy</span>
            </div>
          );
        }
      `;

      const baseline = [
        {
          line: 4,
          tokens: ["bg-red-500"],
          snippet: historicalSnippet,
        },
      ];

      const { newViolations, historicalViolations } = auditFileContent(
        "src/app/legacy/page.tsx",
        historicalComponent,
        baseline
      );

      assert.strictEqual(newViolations.length, 0);
      assert.strictEqual(historicalViolations.length, 1);
      assert.strictEqual(historicalViolations[0].snippet, historicalSnippet);
    });

    it("detects new violations when added to a file with existing baseline entries", () => {
      const historicalSnippet = '<div className="bg-red-500 text-white">';
      const newSnippet = '<div className="bg-amber-500 text-amber-400">';
      const mixedComponent = `
        export function MixedView() {
          return (
            <>
              ${historicalSnippet}
              ${newSnippet}
            </>
          );
        }
      `;

      const baseline = [
        {
          line: 4,
          tokens: ["bg-red-500"],
          snippet: historicalSnippet,
        },
      ];

      const { newViolations, historicalViolations } = auditFileContent(
        "src/app/mixed/page.tsx",
        mixedComponent,
        baseline
      );

      assert.strictEqual(historicalViolations.length, 1);
      assert.strictEqual(newViolations.length, 1);
      assert.strictEqual(newViolations[0].snippet, newSnippet);
    });
  });

  describe("Whole codebase design system audit", () => {
    it("confirms current codebase has 0 new violations and passes audit", () => {
      const rootDir = path.resolve(__dirname, "../..");
      const result = runDesignSystemAudit(rootDir);

      assert.strictEqual(result.errors.length, 0, `Errors found: ${result.errors.join(", ")}`);
      assert.strictEqual(
        result.newViolations.length,
        0,
        `New violations found: ${JSON.stringify(result.newViolations, null, 2)}`
      );
      assert.strictEqual(result.success, true);
    });

    it("verifies account-tab.tsx has zero hardcoded Tailwind color violations", () => {
      const accountTabPath = path.resolve(__dirname, "../app/settings/components/account-tab.tsx");
      const content = fs.readFileSync(accountTabPath, "utf-8");
      const { newViolations, historicalViolations } = auditFileContent(
        "src/app/settings/components/account-tab.tsx",
        content,
        []
      );

      assert.strictEqual(historicalViolations.length, 0);
      assert.strictEqual(newViolations.length, 0, "Account tab contains unexpected violations");
    });

    it("verifies verify-email/page.tsx has zero hardcoded Tailwind color violations", () => {
      const verifyEmailPath = path.resolve(__dirname, "../app/verify-email/page.tsx");
      const content = fs.readFileSync(verifyEmailPath, "utf-8");
      const { newViolations, historicalViolations } = auditFileContent(
        "src/app/verify-email/page.tsx",
        content,
        []
      );

      assert.strictEqual(historicalViolations.length, 0);
      assert.strictEqual(newViolations.length, 0, "Verify email page contains unexpected violations");
    });
  });
});
