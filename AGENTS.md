<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aubrey Rankings — Core Engineering Guidelines

## 1. Core Engineering Principles

1. **Correctness Before Appearance**: Scoring formulas, database integrity, access controls, and privacy boundaries always take precedence over decorative UI.
2. **Simplicity Before Abstraction**: Keep components direct and readable. Do not introduce speculative abstractions or micro-frameworks for simple operations.
3. **One Authoritative Implementation Per Business Rule**: Every domain rule must live in one central location (e.g. `src/lib/safety.ts` for safety & blocking, `src/lib/scoring.ts` for scoring math, `src/lib/admin.ts` for admin checks). Never duplicate authorization or business logic.
4. **No Unnecessary Rewrites**: Make the smallest coherent change that solves the problem. Preserve existing working code, comments, docstrings, and structure.
5. **Type-Safe Feature Boundaries**: Keep data types, API payloads, and Drizzle relations strictly typed without using `any` or loose casts. Verify with `npx tsc --noEmit`.
6. **Design Tokens & Theme Compliance**: Never use hardcoded Tailwind color utilities (`amber-*`, `emerald-*`, `red-*`, etc.) or arbitrary hexes (`bg-[#...]`) for UI chrome. All UI elements must adapt to the user's selected theme mode and primary accent. Use semantic tokens (`bg-primary`, `text-primary-text`, `bg-surface`, `border-border`, `text-destructive`). See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for the authoritative token specification. Validate with `npm run check:design-system`.
7. **Preserve Historical User Data**: Never delete, truncate, or overwrite real user data, production rankings, or existing Letterboxd imports. Database migrations must be forward-compatible and additive.
8. **Verify Affected User Journeys**: Test both ends of every interaction (e.g. ranking owner vs. visitor, author vs. commenter, blocker vs. blocked).
9. **Never Claim Unverified Deployment Success**: Always verify against live endpoints (`curl -fsS https://aubrey.koltensserver.com/api/health`) before declaring a release successful.

---

## 2. Contributor Quality Workflow

For every task, follow this lightweight cycle:
1. **Understand the task**: Read existing relevant code before modifying anything.
2. **Identify affected boundaries**: Check `docs/ARCHITECTURE.md` to see domain ownership and relevant test suites.
3. **Make the smallest coherent change**: Stay focused on the problem. Do not refactor unrelated files.
4. **Run focused tests**: Execute the specific test file covering the modified feature (`npx tsx --test src/tests/<name>.test.ts`).
5. **Run release checks**: For non-trivial changes, verify design tokens (`npx tsx scripts/check-design-system.ts`) and TypeScript types (`npx tsc --noEmit`).
6. **Review the diff**: Inspect `git diff` to ensure no debug code, accidental reformatting, or unneeded files are staged.
7. **Report verified results**: State clearly what changed and provide the exact test commands and outputs.

---

## 3. Specialized Agent Skills

Detailed procedural runbooks are partitioned into on-demand skills under `.agents/skills/`:
- `verify-feature`: Run targeted tests, token checks, and type validation for affected modules.
- `design-system-change`: Adjusting theme palettes, radius tokens, or component overrides without breaking design system guarantees.
- `safe-database-migration`: Writing atomic schema migrations, updating Drizzle schema, and verifying rollback isolation.
- `release-verification`: Pre-flight checklist, GitHub Actions monitoring, container deployment, and live health verification.
