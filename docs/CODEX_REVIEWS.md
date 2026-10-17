# Codex Reviews & Verifications

## Session Context
- Persistent Session ID: Managed via local `.codex-session.json` (`01a14b81-6943-7fc0-bb32-2000bed5159d`)
- Target Environment: macOS local development -> Ubuntu 24.04 Docker production

## Review Log

### Checkpoint A: Authentication & Database Integrity
- **Status**: Completed (Review conducted, fixes being applied)
- **Scope**: Session handling, authorization boundaries, cross-user data isolation, DB constraints & schema integrity
- **Findings**:
  1. *High*: Cross-user artwork disclosure in collection detail GET (loaded all user overrides for shared media).
  2. *High*: Rating-system ownership unchecked in Collection PATCH and Ratings POST.
  3. *High*: Global rating saves could overwrite collection-scoped ratings due to missing `isNull(collectionId)` predicate.
  4. *Medium*: Global-rating uniqueness ineffective when `collectionId` is NULL; missing partial unique index.
  5. *Medium*: Ratings and category score synchronization and non-transactional writes.
  6. *Medium*: Loose boolean coercion (`Boolean("false") === true`) in PATCH requests.
  7. *Medium*: Non-transactional default rating system seeding.
  8. *Medium*: Missing DB foreign key on `mediaItems.parentMediaId`.
  9. *Low/Config*: Hardcoded auth secret fallback in production.
- **Fixes Applied**:
  - Filtered artwork overrides strictly by authenticated viewer.
  - Added strict ownership validation on `ratingSystemId` before referencing or updating.
  - Added `isNull(r.collectionId)` in existing rating query and partial unique index on `(userId, mediaItemId) WHERE collection_id IS NULL`.
  - Added partial unique index on `(userId) WHERE is_default = true`.
  - Added foreign key self-reference on `mediaItems.parentMediaId`.
  - Wrapped rating and category score updates in atomic `db.transaction()`.
  - Enforced strict boolean and input type checking in collection PATCH and ratings API.
  - Wrapped `seedDefaultRatingSystem` in `db.transaction()`.
  - Disallowed fallback auth secret in production environments.
- **Verification Status**: In progress (Pushing schema and running updated test suite).

### Checkpoint B: Security-Sensitive Features (Uploads, Sharing & APIs)
- **Status**: Pending

### Checkpoint C: Release & Production Review
- **Status**: Pending
