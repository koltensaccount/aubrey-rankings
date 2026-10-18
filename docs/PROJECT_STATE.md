# Aubrey Rankings — Project State

## Current Architecture
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Modern Cinema Editorial design system (Barlow Condensed bold display typography + Inter interface/body, dark neutral palette `#111514`, artwork cyan/teal accents `#89d5d5`, authentic ClearLOGO artwork integration)
- **Database**: PostgreSQL (v16) with Drizzle ORM
- **Authentication**: Better Auth with email/password, session persistence, and transactional user seeding
- **Integrations**: TMDB API (server-side authenticated metadata, caching & artwork), Resend (transactional email)
- **Deployment Target**: Ubuntu 24.04 via Docker Compose (`aubrey-db`, `aubrey-web`), loopback-bound to `127.0.0.1:3200` for Cloudflare Tunnel ingress at `aubrey.koltensserver.com`
- **Session Management**: Dedicated persistent Codex session (`01a14c00-e0fb-7d72-9c6e-38aec95276da`)

## Important Decisions & Security Hardening
1. **Multi-tenant isolation**: All collection, rating, custom score, and image records are strictly isolated to `userId`.
2. **Partial unique indexes**: PostgreSQL partial unique index prevents duplicate global ratings where `collection_id IS NULL`, and guarantees a single default rating system per user.
3. **Artwork override privacy**: Artwork queries strictly scope to the authenticated user's ID, preventing cross-user artwork disclosure.
4. **Rating system ownership verification**: API operations strictly verify that `defaultRatingSystemId` and `ratingSystemId` belong to the calling user.
5. **Transactional integrity**: Rating updates, category score synchronizations, and default system seeding execute in atomic PostgreSQL transactions.
6. **Input validation**: Enforced strict boolean types on PATCH operations, preventing `"false"` string coercion bugs.

## Implemented Features
- [x] Phase 1: Foundation, Database schema, Drizzle ORM, and Better Auth
- [x] Phase 2: TMDB API integration, search, TV show and Movie Franchise imports
- [x] Phase 3: Personalized weighted rating systems, live scoring calculation engine, collection rankings view (grid and compact list), season filtering, and rating modal
- [x] Phase 4: Custom artwork uploads with Sharp image validation, Settings interface, profile and rating system management
- [x] Phase 5: Aubrey's Black Mirror historical rating importer and episode matcher
- [x] Phase 6: Production multi-stage Dockerfile, Docker Compose stack, automated backup/restore scripts, deployment runbook
- [x] Phase 7: Live production deployment to Ubuntu server (`koltensserver`), persistent database initialization, volume configuration, automated backups with off-server sync, and continuous deployment pipeline
- [x] Stage 1 (Production UI): Unified Modern Cinema Editorial UI across all application pages (Home/Feed, Ranking Detail, Profile, Settings, Auth, Create Ranking) with locked Barlow Condensed + Inter typography
- [x] Stage 2 (Accounts & Identity): Google OAuth provider, normalized lowercase unique usernames (3–20 chars, reserved keywords protection), case-insensitive unique DB index, `/onboarding` flow, live availability checking API, Settings profile editor, and Resend transactional email integration.
- [x] Stage 3 (Letterboxd Importer): Repeatable, non-destructive Letterboxd ZIP archive importer (`ratings.csv`, `watched.csv`, `diary.csv`, `reviews.csv`), star rating scale preservation (0.5 to 5.0), duplicate protection, preview breakdown, and Settings UI.

## Active Implementation Stage
- **Stage 4 — Privacy & Public Profiles**: Public profiles at `/u/[username]` displaying user metadata, avatar, bio, pinned ranking, public collections, reviews; Private (default), Unlisted, and Public ranking visibility states with server-side authorization enforcement.

## Long-Term Product Roadmap (Post Stage 3)
- **Stage 4 — Privacy & Public Profiles**: Private (default), unlisted, and public rankings, shareable URLs, public user profiles, pinned rankings, public reviews, privacy-aware search.
- **Stage 5 — Social Platform**: Following / followers, social activity dispatch feed, likes, comments, user discovery, notifications, and moderation/abuse protection.
- **Stage 6 — Advanced Rankings**: Side-by-side user ranking comparisons, category score comparison, disagreement indexes, shareable ranking cards.
- **Stage 7 — Advanced Personalization**: Automatic artwork-based accent colors, manual accent overrides, custom editorial ranking covers.

## Automated Test Coverage
- `src/tests/scoring.test.ts`: Weighted scoring calculations, decimal weights, edge cases, zero weights, completeness checks (All pass)
- `src/tests/db_isolation.test.ts`: Cross-user collection isolation, duplicate prevention, global rating partial unique index, artwork override isolation, transactional seeding (All pass)
- `src/tests/importer.test.ts`: Black Mirror episode matching, fuzzy title handling, historical weighted score conversions (All pass)

## Current Status
- **Application Live on Server**: Running on `koltensserver` via Docker Compose (`aubrey-web`, `aubrey-db`).
- **Internal Routing Ready**: Accessible for Cloudflare Tunnel at `http://aubrey-web:3000` on `docker_default` and `http://172.21.0.1:3200`.
- **Private Verification**: Accessible on private tailnet at `http://100.73.94.105:3200`.
- **Automated Operations**: Nightly backups at 3:00 AM (`backup.sh`) with Google Drive sync; automatic update polling (`auto-update.sh`) every 2 minutes with rollback safeguards.
