# Aubrey Rankings — Architecture & System Map

Aubrey Rankings is an opinionated, cinematic media-ranking and criticism platform built on Next.js 16 (App Router), Drizzle ORM, PostgreSQL, and Better Auth.

---

## 1. Major Feature Boundaries

```
src/
├── app/                  # Next.js App Router (pages and API routes)
│   ├── collection/[id]/  # Ranking detail & presentation (owner workspace & visitor views)
│   ├── u/[username]/     # Public curator profiles and pinned canons
│   ├── explore/          # Discovery engine (titles, curators, TMDB live search)
│   ├── media/[id]/       # Media detail & public community reviews
│   ├── settings/         # User profile, appearance, notifications, privacy & safety
│   └── api/              # Authoritative REST endpoints
│       ├── collections/  # Collection CRUD, entries, and release tracking
│       ├── ratings/      # Authoritative rating submissions and scoring
│       ├── reports/      # Content and profile moderation reporting
│       ├── social/       # Follow, like, comment, block, and feed streams
│       └── user/         # Privacy preferences, search, and onboarding
├── components/           # Reusable UI components & design system building blocks
│   ├── social/           # Social interactions (comments, reports, follows, feed)
│   └── collections/      # Ranking banners, cards, and release trackers
├── db/                   # Database layer
│   ├── schema.ts         # Authoritative Drizzle schema and relations
│   └── migrations/       # Linear, checksum-protected SQL migrations
└── lib/                  # Pure business logic and domain engines
    ├── safety.ts         # Authoritative blocking and comment eligibility policy
    ├── scoring.ts        # Weighted average and rubric scoring calculations
    ├── theme.ts          # Semantic design tokens and palette definitions
    ├── admin.ts          # Moderator and administrator authorization
    └── notifications.ts  # Notification delivery and preference engine
```

---

## 2. Key Domain Rules & Ownership

### Ranking & Collection Ownership
- Defined by `collections.user_id`.
- **Owner Permissions**: Add/remove media items, customize rubric weights, upload custom backdrops/posters, adjust visibility (`private`, `unlisted`, `public`), toggle comments (`allow_comments`), or delete the collection.
- **Visitor Presentation**: Genuinely read-only. Author identity is prominent. Visitors can Like, Save, Follow, Share, and Comment (if eligible), but cannot modify scores or open the owner's rating dialog.

### Rating & Review Ownership
- Stored in the `ratings` table, owned by `ratings.user_id`.
- **Collection Scope**: When a rating belongs to a collection (`collection_id`), only the collection's owner may submit or edit ratings for that collection.
- **Privacy Protection**: `ratings.personal_notes` are strictly private to the rating author and are stripped by the API before sending to visitors or feeds.
- **Public Reviews**: Only reviews attached to public collections are exposed publicly (`src/lib/public-reviews.ts`).

### Safety, Blocking & Moderation
- Centralized in `src/lib/safety.ts`:
  - `isBlocked(a, b)`: Bidirectional block check.
  - `canInteract({ actorId, ownerId })`: Gates follows and likes.
  - `canComment({ authorId, commenterId, collectionAllowComments })`: Enforces ranking toggles, bidirectional blocks, and owner comment permissions (`everyone`, `following`, `nobody`).
  - *Following* means **curators the author follows** (`authorId` $\rightarrow$ `commenterId`).
- Blocking an account immediately deletes reciprocal follow relationships from `follows`.
- Content reports (`content_reports`) are submitted confidentially via `/api/reports` and reviewed by admins verified via `src/lib/admin.ts`.

---

## 3. Shared UI Components

| Component | Location | Purpose |
| :--- | :--- | :--- |
| `CinematicMediaCard` | `src/components/cinematic-media-card.tsx` | Standard 2:3 poster or 16:9 video frame with fallback states. |
| `CinematicArtworkBanner`| `src/components/cinematic-artwork-banner.tsx`| Immersive banner with dynamic backdrop, logo, and title typography. |
| `RatingDialog` | `src/components/rating-dialog.tsx` | Modal slider interface for weighted multi-category rubric scoring. |
| `ReportDialog` | `src/components/social/report-dialog.tsx` | Universal modal for reporting abusive comments, reviews, or profiles. |
| `FollowButton` | `src/components/social/follow-button.tsx` | Optimistic follow/unfollow toggle with live count updates. |
| `LikeButton` | `src/components/social/like-button.tsx` | Heart interaction for public rankings with optimistic increments. |
| `SaveRankingButton` | `src/components/social/save-ranking-button.tsx` | Bookmark toggle for public rankings. |
| `CommentsSection` | `src/components/social/comments-section.tsx` | Threaded discussions with replies, spoilers, and moderation. |

---

## 4. Design System Tokens & Locations

- **Authoritative CSS Variables**: Defined in `src/app/globals.css`.
- **Palette & Contrast Logic**: `src/lib/theme.ts` and `src/lib/palette.ts`.
- **Extensible Semantic Tokens**:
  - Border Radii: `--radius-card` (12px), `--radius-button` (8px), `--radius-dialog` (16px), `--radius-input` (8px), `--radius-comment` (8px).
  - Shadows: `--shadow-card`, `--shadow-dialog`, `--shadow-elevated`.
  - Borders: `--border-card`, `--border-dialog`.
- **Verification**: Run `npx tsx scripts/check-design-system.ts`. Never introduce arbitrary hardcoded dark hex colors (`#141a17`, `#111514`, etc.) into presentation components.

---

## 5. Database Migrations

- Migrations live in `src/db/migrations/` as numbered SQL files (`0000_...sql` to `0010_...sql`).
- Executed via `scripts/migrate.cjs`:
  ```bash
  node scripts/migrate.cjs
  ```
- **Guarantees**: Atomic (runs in a transaction), checksum protected (aborts if existing files are modified), and recorded in `aubrey_schema_migrations`.
- When adding schema changes, update `src/db/schema.ts` and verify with `node --test src/tests/migrations.test.ts`.

---

## 6. Authentication & Roles

- Powered by **Better Auth** (`src/lib/auth.ts`) using the Drizzle PostgreSQL adapter.
- Server session retrieval: `getServerSession(req?: Request)` in `src/lib/server-session.ts`.
- **Admin Verification**: `checkIsAdmin(session)` in `src/lib/admin.ts` checks verified emails against `ADMIN_EMAILS` or `ADMIN_USER_IDS`.

---

## 7. Essential Development & Release Commands

| Action | Command |
| :--- | :--- |
| **Run Unit & Integration Tests** | `npm test` |
| **Run Specific Test File** | `npx tsx --test src/tests/<filename>.test.ts` |
| **Check Design System Tokens** | `npx tsx scripts/check-design-system.ts` |
| **Verify TypeScript Types** | `npx tsc --noEmit` |
| **Build Next.js Application** | `npm run build` |
| **Verify Live Deployment** | `curl -fsS https://aubrey.koltensserver.com/api/health` |

---

## 8. Contributor Quick Reference

- **Where do I change review visibility?**
  - Schema: `src/db/schema.ts` (`defaultReviewVisibility`).
  - Public profile visibility: `src/lib/public-reviews.ts` (`getPublicReviews`).
  - Feed discovery: `src/app/api/social/feed/route.ts` (`reviewItems`).
  - User settings: `src/app/settings/components/privacy-tab.tsx` and `src/app/api/user/privacy/route.ts`.

- **Where do I change a card radius?**
  - CSS Custom Property: `--radius-card` in `src/app/globals.css`.
  - Constant: `src/lib/theme.ts`.
  - Component usage: `className="rounded-card ..."` (see `.agents/skills/design-system-change/SKILL.md`).

- **How do I add a rating-system type?**
  - Database schema: `ratingSystems` table in `src/db/schema.ts`.
  - Math & calculations: `calculateWeightedAverage` in `src/lib/scoring.ts`.
  - UI Editor: `src/components/rating-dialog.tsx`.
  - Tests: `src/tests/scoring.test.ts` and `src/tests/rating_experience.test.ts`.

- **How do I test a permission rule?**
  - Safety & permission policy: `src/lib/safety.ts`.
  - Integration test suite: `src/tests/safety-and-controls.test.ts`.
  - Run via: `npx tsx --test src/tests/safety-and-controls.test.ts`.

- **How do I safely prepare a migration?**
  - Follow the runbook in `.agents/skills/safe-database-migration/SKILL.md`.
  - Add `src/db/migrations/00XX_<name>.sql` and update `src/db/schema.ts`.
  - Apply locally: `node --env-file=.env.local scripts/migrate.cjs`.
  - Verify atomicity: `node --test src/tests/migrations.test.ts`.

- **How do I verify the deployed revision?**
  - Health check: `curl -fsS https://aubrey.koltensserver.com/api/health`.
  - Inspect output: `{"status":"ok","revision":"<git_commit_sha>"}`.

