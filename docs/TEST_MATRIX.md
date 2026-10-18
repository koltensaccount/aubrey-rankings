# Aubrey Rankings — Test Matrix & Discoverability

All tests run via the Node.js native test runner executed through `tsx`:
```bash
npm test                                      # Run all suites
npx tsx --test src/tests/<name>.test.ts       # Run specific suite
```

---

## 1. Test Suite Map

| Test Suite | File Location | Key Behaviors & Guarantees Verified |
| :--- | :--- | :--- |
| **Admin & RBAC** | `src/tests/admin.test.ts` | Email verification requirement, `ADMIN_EMAILS` and `ADMIN_USER_IDS` parsing, fails closed for unauthenticated requests. |
| **Appearance & Theming** | `src/tests/appearance.test.ts` | Theme switching (dark/light), custom accent color updates, WCAG contrast compliance. |
| **Audit & Integrity** | `src/tests/audit-integrity.test.ts` | Private collection isolation, entry removal ownership checks, letterboxd import deduplication. |
| **Comments & Moderation** | `src/tests/comments-replies-spoilers.test.ts` | Single-level reply threading, author-only editing (`isEdited`), spoiler flags, ranking owner moderation rights. |
| **Community Feed & Discovery** | `src/tests/community-feed.test.ts` | Following vs. Discover feed, privacy boundaries, like and bookmark aggregation. |
| **Comparison Engine** | `src/tests/comparison.test.ts` | Side-by-side ranking comparison, score normalization across different scales. |
| **Database Isolation** | `src/tests/db_isolation.test.ts` | Postgres transaction atomicity and concurrency locking. |
| **Design System Extensibility**| `src/tests/design-system-extensibility.test.ts` | CSS token synchronization (`theme.ts` vs `globals.css`), component radius overrides, color contrast. |
| **Email Dispatcher** | `src/tests/email.test.ts` | Resend email client, graceful fallback when API key is unconfigured. |
| **Full Stack Audit** | `src/tests/full-audit.test.ts` | Comprehensive pre-release audit of ratings, imports, privacy, and scoring. |
| **Importer Engine** | `src/tests/importer.test.ts` | Black Mirror seed importer, rubric template assignment. |
| **Letterboxd Importer** | `src/tests/letterboxd.test.ts` | CSV parsing, media resolution against TMDB, rating scale conversion (5-star to 10-point). |
| **Collection Management** | `src/tests/management_and_deletion.test.ts` | Cascading deletions, orphan entry cleanup, entry reordering. |
| **Database Migrations** | `src/tests/migrations.test.ts` | Transactional migration execution, checksum tamper prevention, rollback isolation on error. |
| **Notifications & Releases** | `src/tests/notifications-and-releases.test.ts` | Notification creation, preference filtering, TMDB release detection, and deduplication. |
| **Onboarding Lifecycle** | `src/tests/onboarding-lifecycle.test.ts` | Username selection, reserved username rejection, pending follow resolution, explore discoverability. |
| **Color & Palette** | `src/tests/palette.test.ts` | OKLCH conversion, chroma clamping, 4.5:1 contrast guarantee against `#111514`. |
| **Privacy & Boundaries** | `src/tests/privacy.test.ts` | Strict privacy overrides, unlisted link sharing, owner vs. visitor collection access. |
| **Rating Validation** | `src/tests/rating-validation.test.ts` | Bounds checking, foreign category rejection, scale handling, non-finite value protection. |
| **Rating Experience Engine** | `src/tests/rating_experience.test.ts` | In-progress vs. rated states, decimal category weights, progress bar percentages. |
| **Community Safety & Controls**| `src/tests/safety-and-controls.test.ts` | User blocks, reciprocal follow deletion, notification suppression, comment permissions, report deduplication, admin resolution. |
| **Saved Rankings** | `src/tests/saved-rankings.test.ts` | Bookmark toggling, uniqueness, user saved lists, cascade deletion. |
| **Scoring Engine** | `src/tests/scoring.test.ts` | Core mathematical algorithm for `calculateWeightedAverage`, handling omitted optional categories. |
| **Social Core** | `src/tests/social.test.ts` | Follow relationships, like counter atomicity, comment creation. |
| **Auto-Updater** | `src/tests/updater.test.ts` | Pull verification, checksum checking, health-check failure rollback to previous image tag. |
| **Username Normalizer** | `src/tests/username.test.ts` | Regex validation, lowercase normalization, reserved slug protection. |

---

## 2. Identified Coverage Gaps & Future Targets

1. **Visitor Collection Presentation (End-to-End)**:
   - While API ownership is strictly enforced, browser-level assertion that rating sliders never render for non-owners should be verified via Playwright.
2. **TMDB On-Demand Fallback**:
   - Verification that unpersisted TMDB search results render a valid media detail fallback page instead of a 404 error.
3. **Draft Review Publishing State**:
   - Integration tests for standalone review drafts once Phase 10 introduces review-specific publication flags.
