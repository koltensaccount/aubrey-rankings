---
name: verify-feature
description: Run targeted tests, design system compliance, and type-checks for an affected feature without running expensive full-suite cycles.
---

# Feature Verification Skill

Use this skill when completing a bug fix or feature enhancement to verify the changes efficiently.

## 1. Identify Affected Test Suite

Refer to `docs/TEST_MATRIX.md` to identify which test covers your changes:

```bash
# Example: If editing safety, blocking, or comment permissions:
npx tsx --test src/tests/safety-and-controls.test.ts

# Example: If editing comments, replies, or spoilers:
npx tsx --test src/tests/comments-replies-spoilers.test.ts

# Example: If editing feeds or discovery:
npx tsx --test src/tests/community-feed.test.ts

# Example: If editing scoring or rubrics:
npx tsx --test src/tests/scoring.test.ts
npx tsx --test src/tests/rating_experience.test.ts
```

## 2. Check Design System Token Compliance

Ensure no hardcoded dark hex colors or raw inline styles were introduced:

```bash
npx tsx scripts/check-design-system.ts
```

## 3. Verify TypeScript Types

Verify that types, props, and schema bindings compile without errors:

```bash
npx tsc --noEmit
```

## 4. When to Run Full Suite

Only run the complete test suite (`npm test`) and production build (`npm run build`) when:
- Preparing a release or staging a merge to `main`.
- Modifying core shared infrastructure (`src/db/schema.ts`, `src/lib/auth.ts`, `src/lib/server-session.ts`, `scripts/migrate.cjs`).
