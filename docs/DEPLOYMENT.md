# Aubrey Rankings — Production Deployment Architecture & Runbook

## Host Overview
- **Host**: Ubuntu 24.04.5 LTS (`koltensserver`)
- **App Path**: `/home/koltensaccount/aubrey-rankings`
- **Domain**: `aubrey.koltensserver.com` (Cloudflare-managed DNS)
- **Ingress**: Existing Cloudflare Tunnel container (`cloudflare-tunnel` on `docker_default` network)
- **Database**: Dedicated PostgreSQL 16 Alpine container with isolated Docker volume (`aubrey_pgdata`)
- **Artwork Storage**: Isolated volume for user-uploaded artwork (`aubrey_uploads`)
- **Internal Routing for Cloudflare Tunnel**: `http://aubrey-web:3000` on `docker_default` network (or host bridge `http://172.21.0.1:3200`)
- **Private Tailscale Testing**: `http://100.73.94.105:3200`

---

## 1. Cloudflare Tunnel Ingress Configuration

To connect the application through your existing Cloudflare Tunnel **without exposing ports to the public internet**:

In the Cloudflare Zero Trust Dashboard (or local tunnel config):
- **Public Hostname**: `aubrey.koltensserver.com`
- **Service Type**: `HTTP`
- **Service URL**: `aubrey-web:3000` (or `172.21.0.1:3200`)

> [!NOTE]
> `cloudflare-tunnel` runs inside Docker on the `docker_default` bridge network. `aubrey-web` is connected to this same network, allowing the tunnel to resolve `http://aubrey-web:3000` directly via internal Docker DNS without needing host network binding or public firewall openings.

---

## 2. Automatic CI/CD & Updates

- **GitHub Actions**: Every verified push to `main` triggers automated tests (`npm test`) and publishes a multi-stage Docker build to GitHub Container Registry (`ghcr.io/koltensaccount/aubrey-rankings:latest`).
- **Server Auto-Updater**: A lightweight cron task runs `/home/koltensaccount/aubrey-rankings/scripts/auto-update.sh` every 2 minutes:
  - Verifies running image digest against GHCR
  - Takes a pre-update safety backup of database and uploaded artwork
  - Applies any pending database migrations safely
  - Launches new container and executes bounded health checks
  - Automatically rolls back to the previous running image if health check fails

---

## 3. Automated Backups & Off-Host Strategy

1. **Nightly Cron Job**:
   On `koltensserver`, runs nightly at 3:00 AM:
   ```cron
   0 3 * * * /home/koltensaccount/aubrey-rankings/scripts/backup.sh >> /home/koltensaccount/backups/aubrey-rankings/backup.log 2>&1
   ```

2. **Restore Procedure**:
   To test or restore a backup:
   ```bash
   /home/koltensaccount/aubrey-rankings/scripts/restore.sh \
     /home/koltensaccount/backups/aubrey-rankings/aubrey_db_YYYYMMDD_HHMMSS.sql.gz \
     /home/koltensaccount/backups/aubrey-rankings/aubrey_uploads_YYYYMMDD_HHMMSS.tar.gz
   ```

3. **Off-Host Sync**:
   `backup.sh` automatically coordinates off-host copies via `rclone` to `gdrive:Backups/aubrey-rankings` and retains the last 14 days of local backups.
