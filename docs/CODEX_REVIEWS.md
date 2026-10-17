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
- **Status**: Completed (Review conducted, fixes verified)
- **Scope**: Production deployment configurations, container isolation, backup/restore scripts, auto-updater safeguards, and Cloudflare Tunnel routing.
- **Findings & Remediations**:
  1. *High — Restore atomicity*: `restore.sh` now enforces `psql -X -v ON_ERROR_STOP=1 --single-transaction`, halts `aubrey-web` during restoration to freeze writes, cleanly replaces the uploads volume, and verifies gzip integrity before execution.
  2. *High — Stream corruption risk in dumps*: `backup.sh` changed from `docker exec -t` to `docker exec -i` to prevent pseudo-TTY character/newline corruption in binary dump streams, verifies gzip integrity with `gzip -t`, and enforces `chmod 600` on generated backups.
  3. *High — Auto-update safety & rollback*: `auto-update.sh` now uses a `flock` concurrency mutex (`/tmp/aubrey-autoupdate.lock`), tracks the currently running container image ID rather than mutable tags, enforces verified pre-update backups before updating, applies migrations with error-stopping constraints, and automatically executes rollback to the tagged previous image if bounded health checks fail.
  4. *Medium — Network isolation*: `aubrey_internal` marked `internal: true` in `docker-compose.yml` to prevent non-routed outbound access, while `docker_default` connects `aubrey-web` directly to `cloudflare-tunnel`.
  5. *Medium — Secret enforcement*: Replaced default fallback credentials in `docker-compose.yml` with `${DB_PASSWORD:?...}` and `${BETTER_AUTH_SECRET:?...}` to ensure the stack fails fast if secrets are omitted.
  6. *Low — Build context isolation*: Added `.dockerignore` to prevent local development secrets, `.git`, `.next`, and uploads from entering Docker build contexts.
  7. *Documentation*: Corrected `docs/DEPLOYMENT.md` to specify `http://aubrey-web:3000` via internal Docker DNS on `docker_default`.
