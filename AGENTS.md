<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aubrey Rankings — Architectural Agent Guidelines

## 1. Single Source of Truth for Design Tokens
- The authoritative palettes are declared in `src/lib/theme.ts` (`PALETTE.dark`, `PALETTE.light`) and mirrored in `src/app/globals.css`.
- Extensible tokens (`--radius-card`, `--radius-dialog`, `--radius-button`, `--radius-input`, `--radius-comment`, `--shadow-card`, `--shadow-dialog`, `--border-card`) must always be used instead of hardcoded arbitrary border radii or hex shadows.
- Verify tokens with `npx tsx scripts/check-design-system.ts`. Never introduce hardcoded hex colors (`#141a17`, `#303b34`, `#102523`, etc.) into presentation components.

## 2. Component Modularity Standard
- Avoid monolithic page components exceeding 500 lines.
- Complex views (e.g. `src/app/collection/[id]/`, `src/app/settings/`, `src/components/rating/`) must be decomposed into focused subcomponents under their dedicated `components/` directories.

## 3. Strict Functional Correctness
- **Scoring Formulas**: Never modify `calculateWeightedAverage`, score normalization, or rubric decimal weighting formulas without explicit instructions.
- **Privacy Enforcement**: `visibility === 'private'` strictly overrides legacy `isPublic: true`. Always check `col.visibility !== 'private'` before exposing collections, ratings, or activity feed items.
- **Data Protection**: Never delete, mutate, or reseed real production users (`Aubrey`, `@koltensaccount`). Never store session cookies or private auth tokens in public manifests.

## 4. Verification Workflow
- Always run `npx tsx scripts/check-design-system.ts`, `npm test`, and `npm run build` before committing.
