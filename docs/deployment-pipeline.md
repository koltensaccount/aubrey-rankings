# Production release pipeline

GitHub Actions runs the committed SQL migrations against a fresh test database, tests the app, and publishes the image. Production cron checks GHCR every two minutes. The container package must be **Public**. The updater uses a dedicated, credential-free `.docker-public` config, so an expired or insufficient personal Docker credential cannot break pulls. Runtime secrets remain exclusively in the server's `.env` and are never part of the image.

## Failures found

- Production was still running `4ffd78d`; the newer `b74619a` image had not been deployed.
- The stored GHCR credential lacked `read:packages`. Login succeeded but manifest requests were denied. Anonymous access also fails while the package is private.
- Cron redirected to a nonexistent `logs` directory and could fail before starting the script.
- Pull failures were hidden and returned exit 0.
- Artwork backup archives were created by container root; the host permission step failed.
- SQL came from a stale host directory, was replayed on every update, had no applied history, and ignored errors. Replaying the visibility backfill could undo later privacy choices.
- Report administration defaulted to allowing any authenticated user when administrator lists were empty.

## Current contract

- Serialized publishing prevents older builds from overtaking newer builds.
- Images contain SQL, deployment helpers, compose configuration, and an immutable revision. Production uses an exact local image ID throughout migration and launch.
- Backups run first; host-owned archives use restrictive permissions.
- SQL runs from the candidate image in a one-shot container with existing Compose credentials. One transaction, a database advisory lock, timeouts, and a checksum journal prevent partial execution, duplicate application, or edited migration history. Errors abort deployment.
- Existing installations require one explicit baseline adoption, after inspecting their schema and taking a backup. `node scripts/migrate.cjs --baseline-through 0004_add_social_features.sql` verifies historical tables/columns/indexes and records them without replaying old data updates; later migrations are applied transactionally. Normal updates never baseline automatically. New installations apply all files normally.
- Only additive, backward-compatible migrations may accompany rolling application releases. Destructive schema changes require a separate reviewed deployment; application rollback never restores or deletes database data.
- `/api/health` checks database/schema availability and returns `{status, revision}` with no cache. A rollout succeeds only when its exact revision is healthy. Failed application rollout restores the prior image.
- Successful releases refresh the host updater, backup helper and Compose configuration from the image. There is no source checkout or application build on the server.
- Updater errors are nonzero, visible in `logs/update.log`, persisted in `logs/last-deployment-error`, and sent to syslog (`aubrey-updater`). `logs/deployed-revision` records the last healthy rollout.
- Compose maps optional Google OAuth and report administrator variables from `.env`. Empty administrator lists deny all report viewing/management in every environment; email grants require a verified email. Public report submission is unchanged.

## Installation and verification

Install the reviewed `scripts/auto-update.sh` and run `scripts/install-updater.sh` as the application owner. It creates the log directory before registering cron and preserves unrelated cron jobs. The existing nightly backup cron entry can remain in place.

After publishing, observe `logs/update.log`, compare the running image's `org.opencontainers.image.revision` label with `https://aubrey.koltensserver.com/api/health`, and confirm a subsequent cron run reports that revision already healthy. This verifies the pull/migration/launch path rather than just GitHub's image build.

Never print `.env`, `docker compose config`, Docker container environment values, or registry credentials in deployment logs. To grant report administration, set `ADMIN_USER_IDS` to explicit stable user IDs (preferred), or `ADMIN_EMAILS` to verified accounts, then recreate the web container on the next release. All users can continue submitting reports.
