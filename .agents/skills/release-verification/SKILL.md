---
name: release-verification
description: Checklist and commands to verify production builds, GitHub Actions pipelines, server deployment, and live health status.
---

# Release Verification Skill

Use this skill when preparing, pushing, and validating a production release on `https://aubrey.koltensserver.com`.

## 1. Local Pre-Flight Checklist

Before pushing any commit to `main`:

```bash
# 1. Verify design system compliance
npx tsx scripts/check-design-system.ts

# 2. Run full test suite
npm test

# 3. Verify TypeScript types
npx tsc --noEmit

# 4. Verify Next.js production build
npm run build

# 5. Check git working tree
git status
```

All 5 steps must pass with 0 errors.

## 2. Push & CI/CD Pipeline Monitoring

When approved to release:

```bash
# Push to GitHub
git push origin main

# Monitor GitHub Actions run
gh run list -L 1
gh run watch <run_id>
```

The GitHub Actions pipeline will:
1. Run automated tests against a fresh PostgreSQL container.
2. Build the optimized Next.js Docker image.
3. Publish to `ghcr.io/koltensaccount/aubrey-rankings:latest` tagged with the commit SHA.

## 3. Server Deployment Execution

Once the GitHub Actions build succeeds, trigger the server-side updater:

```bash
ssh -o BatchMode=yes koltensserver '/home/koltensaccount/aubrey-rankings/scripts/auto-update.sh'
```

The updater will:
1. Lock against concurrent updates.
2. Pull the candidate image from GHCR.
3. Run `scripts/backup.sh` (Postgres dump + volume backup synced to Google Drive).
4. Run pending database migrations via one-shot container.
5. Recreate the `aubrey-web` container.
6. Verify local health at `http://127.0.0.1:3200/api/health`.
7. Roll back automatically to `aubrey-web:rollback-backup` if health checks fail.

## 4. Live Health & Revision Verification

Verify from the public internet that the deployed revision matches the git commit:

```bash
curl -fsS https://aubrey.koltensserver.com/api/health
```

Expected response format:
```json
{"status":"ok","revision":"<git_commit_sha>"}
```
