# Aubrey Rankings — Project State

## Current Architecture
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui design patterns + Motion
- **Database**: PostgreSQL (v16) with Drizzle ORM
- **Authentication**: Better Auth with email/password, session persistence, and transactional user seeding
- **Integrations**: TMDB API (server-side authenticated metadata, caching & artwork), Resend (transactional email)
- **Deployment Target**: Ubuntu 24.04 via Docker Compose (`aubrey-db`, `aubrey-web`), loopback-bound to `127.0.0.1:3200` for Cloudflare Tunnel ingress at `aubrey.koltensserver.com`
- **Session Management**: Dedicated persistent Codex session (`01a14b81-6943-7fc0-bb32-2000bed5159d`)

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
- [x] Codex Checkpoint A: Authentication & database integrity review and resolution
- [x] Private GitHub repository initialized and synchronized

## Automated Test Coverage
- `src/tests/scoring.test.ts`: Weighted scoring calculations, decimal weights, edge cases, zero weights, completeness checks (All pass)
- `src/tests/db_isolation.test.ts`: Cross-user collection isolation, duplicate prevention, global rating partial unique index, artwork override isolation, transactional seeding (All pass)
- `src/tests/importer.test.ts`: Black Mirror episode matching, fuzzy title handling, historical weighted score conversions (All pass)

## Current Status
- Production readiness complete. Pending user approval for deployment to `koltensserver`.
