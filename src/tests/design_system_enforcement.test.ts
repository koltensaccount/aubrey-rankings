import assert from "node:assert";
import { describe, it } from "node:test";
import path from "node:path";
import fs from "node:fs";
import {
  extractColorTokens,
  auditFileTokens,
  checkPaletteSync,
  runDesignSystemAudit,
} from "../../scripts/check-design-system";

describe("Permanent Design Token Enforcement", () => {
  describe("Token extraction & parsing", () => {
    it("flags hardcoded amber badge classes as violations (Settings regression)", () => {
      const code = `
        export function BadBadge() {
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Unverified
            </span>
          );
        }
      `;
      const tokens = extractColorTokens(code);
      assert.strictEqual(tokens.length, 3);
      assert.deepStrictEqual(
        tokens.map((t) => t.token),
        ["bg-amber-500/10", "text-amber-400", "border-amber-500/20"]
      );
    });

    it("flags all standard Tailwind palette families and gradient/utility prefixes (bg-cyan-500, text-pink-500, border-slate-300, from-rose-500)", () => {
      const code = `
        <div className="bg-cyan-500 text-pink-500 border-slate-300 from-rose-500 via-emerald-400 to-amber-500 accent-teal-600 outline-indigo-400 divide-zinc-200" />
      `;
      const tokens = extractColorTokens(code);
      assert.strictEqual(tokens.length, 9);
      const tokenNames = tokens.map((t) => t.token);
      assert.ok(tokenNames.includes("bg-cyan-500"));
      assert.ok(tokenNames.includes("text-pink-500"));
      assert.ok(tokenNames.includes("border-slate-300"));
      assert.ok(tokenNames.includes("from-rose-500"));
      assert.ok(tokenNames.includes("via-emerald-400"));
      assert.ok(tokenNames.includes("to-amber-500"));
      assert.ok(tokenNames.includes("accent-teal-600"));
      assert.ok(tokenNames.includes("outline-indigo-400"));
      assert.ok(tokenNames.includes("divide-zinc-200"));
    });

    it("flags variant-prefixed utility classes (hover:bg-cyan-500, dark:text-pink-500, focus:ring-slate-300)", () => {
      const code = `
        <button className="hover:bg-cyan-500 dark:text-pink-500 focus:ring-slate-300 dark:hover:bg-red-600/20" />
      `;
      const tokens = extractColorTokens(code);
      assert.strictEqual(tokens.length, 4);
      const tokenNames = tokens.map((t) => t.token);
      assert.ok(tokenNames.includes("hover:bg-cyan-500"));
      assert.ok(tokenNames.includes("dark:text-pink-500"));
      assert.ok(tokenNames.includes("focus:ring-slate-300"));
      assert.ok(tokenNames.includes("dark:hover:bg-red-600/20"));
    });

    it("flags arbitrary hardcoded hex classes including variant prefixes (bg-[#123456], hover:bg-[#123456])", () => {
      const code = '<div className="bg-[#141a17] text-[#89d5d5] hover:border-[#28342d]" />';
      const tokens = extractColorTokens(code);
      assert.strictEqual(tokens.length, 3);
      assert.ok(tokens.some((t) => t.token === "bg-[#141a17]"));
      assert.ok(tokens.some((t) => t.token === "hover:border-[#28342d]"));
    });

    it("passes semantic tokens without flagging any violations", () => {
      const code = `
        export function GoodBadge() {
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary-text border border-primary/25">
              Verified
            </span>
          );
        }
      `;
      const tokens = extractColorTokens(code);
      assert.strictEqual(tokens.length, 0);
    });

    it("ignores code comments referencing color names", () => {
      const code = `
        // TODO: replace legacy bg-cyan-500 with bg-primary
        /* text-pink-500 note */
        const x = 1;
      `;
      const tokens = extractColorTokens(code);
      assert.strictEqual(tokens.length, 0);
    });

    it("does not flag XML SVG fill attributes or standard inline styles", () => {
      const code = `
        <svg viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25..." />
          <path fill="#34A853" d="M12 23..." />
        </svg>
        <div style={{ backgroundColor: tier.color }} />
      `;
      const tokens = extractColorTokens(code);
      assert.strictEqual(tokens.length, 0);
    });
  });

  describe("Baseline per-file occurrence pool auditing", () => {
    it("reports violations when an unbaselined file introduces forbidden tokens", () => {
      const tokensFound = [
        { line: 12, token: "bg-amber-500/10" },
        { line: 12, token: "text-amber-400" },
      ];
      const violations = auditFileTokens("src/app/new-feature.tsx", tokensFound, []);

      assert.strictEqual(violations.length, 2);
      assert.strictEqual(violations[0].file, "src/app/new-feature.tsx");
      assert.strictEqual(violations[0].line, 12);
      assert.strictEqual(violations[0].token, "bg-amber-500/10");
    });

    it("permits tokens that are present in the allowed per-file baseline pool", () => {
      const tokensFound = [
        { line: 45, token: "bg-red-500" },
        { line: 50, token: "text-red-400" },
      ];
      const allowed = ["bg-red-500", "text-red-400"];
      const violations = auditFileTokens("src/app/legacy.tsx", tokensFound, allowed);

      assert.strictEqual(violations.length, 0);
    });

    it("flags newly introduced tokens that exceed the historical per-file baseline count/pool", () => {
      const tokensFound = [
        { line: 45, token: "bg-red-500" },
        { line: 50, token: "text-red-400" },
        { line: 55, token: "bg-cyan-500" }, // New token exceeding allowed pool
      ];
      const allowed = ["bg-red-500", "text-red-400"];
      const violations = auditFileTokens("src/app/legacy.tsx", tokensFound, allowed);

      assert.strictEqual(violations.length, 1);
      assert.strictEqual(violations[0].line, 55);
      assert.strictEqual(violations[0].token, "bg-cyan-500");
    });
  });

  describe("Whole codebase health", () => {
    it("passes whole-codebase design system audit with 0 new violations", () => {
      const rootDir = path.resolve(__dirname, "../..");
      const result = runDesignSystemAudit(rootDir);

      assert.strictEqual(result.errors.length, 0, `Sync errors: ${result.errors.join(", ")}`);
      assert.strictEqual(
        result.newViolations.length,
        0,
        `Violations found: ${JSON.stringify(result.newViolations, null, 2)}`
      );
      assert.strictEqual(result.success, true);
    });

    it("verifies account-tab.tsx and verify-email/page.tsx have 0 violations and 0 baseline entries", () => {
      const rootDir = path.resolve(__dirname, "../..");
      const baseline: Record<string, string[]> = JSON.parse(
        fs.readFileSync(path.join(rootDir, "scripts/design-system-baseline.json"), "utf-8")
      );

      assert.strictEqual(
        baseline["src/app/settings/components/account-tab.tsx"],
        undefined,
        "Account tab must not be in baseline"
      );
      assert.strictEqual(
        baseline["src/app/verify-email/page.tsx"],
        undefined,
        "Verify email page must not be in baseline"
      );

      const accountTabContent = fs.readFileSync(
        path.join(rootDir, "src/app/settings/components/account-tab.tsx"),
        "utf-8"
      );
      const verifyEmailContent = fs.readFileSync(
        path.join(rootDir, "src/app/verify-email/page.tsx"),
        "utf-8"
      );

      assert.strictEqual(extractColorTokens(accountTabContent).length, 0);
      assert.strictEqual(extractColorTokens(verifyEmailContent).length, 0);
    });
  });
});
