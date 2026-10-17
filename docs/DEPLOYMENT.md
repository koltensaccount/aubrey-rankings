# Aubrey Rankings — Production Deployment Architecture & Runbook

## Host Overview
- **Host**: Ubuntu 24.04.5 LTS (`koltensserver`)
- **Domain**: `aubrey.koltensserver.com` (Cloudflare-managed DNS)
- **Ingress**: Existing Cloudflare Tunnel container (`cloudflare-tunnel` on server)
- **Database**: Dedicated PostgreSQL 16 Alpine container with isolated Docker volume (`aubrey_pgdata`)
- **Artwork Storage**: Isolated volume for user-uploaded artwork (`aubrey_uploads`)
- **Web App Port**: Loopback bind `127.0.0.1:3200` (strictly non-public, host-only)

---

## 1. Cloudflare Tunnel Ingress Configuration

To connect the application through your existing Cloudflare Tunnel **without exposing ports to the public internet**:

Add the following ingress rule to your Cloudflare Tunnel configuration (either in `/home/koltensaccount/.../config.yml` or the Cloudflare Zero Trust Dashboard):

```yaml
ingress:
  - hostname: aubrey.koltensserver.com
    service: http://127.0.0.1:3200
  # (preserve existing fallback rules below)
  - service: http_status:404
```

> [!NOTE]
> Since `cloudflare-tunnel` runs on the Docker host network, pointing to `http://127.0.0.1:3200` reaches the Aubrey Rankings Next.js container directly through loopback without modifying any server firewall rules.

---

## 2. Server Deployment Instructions (When Approved)

1. Clone or copy project repository to the server:
   ```bash
   ssh koltensserver
   mkdir -p /home/koltensaccount/docker/aubrey-rankings
   cd /home/koltensaccount/docker/aubrey-rankings
   git clone https://github.com/koltensaccount/aubrey-rankings.git .
   ```

2. Create production `.env` file:
   ```bash
   cat << 'EOF' > .env
   DB_PASSWORD=YOUR_STRONG_DATABASE_PASSWORD_HERE
   BETTER_AUTH_SECRET=YOUR_GENERATED_32_BYTE_HEX_SECRET_HERE
   BETTER_AUTH_URL=https://aubrey.koltensserver.com
   NEXT_PUBLIC_APP_URL=https://aubrey.koltensserver.com
   TMDB_API_READ_ACCESS_TOKEN=YOUR_TMDB_READ_TOKEN_HERE
   TMDB_API_KEY=YOUR_TMDB_API_KEY_HERE
   RESEND_API_KEY=YOUR_RESEND_API_KEY_HERE
   EMAIL_FROM=Aubrey Rankings <accounts@aubrey.koltensserver.com>
   EOF
   chmod 600 .env
   ```

3. Launch the Docker Compose stack:
   ```bash
   docker compose up -d --build
   ```

4. Run the initial database push/migration:
   ```bash
   docker compose exec aubrey-web npx drizzle-kit push
   ```

5. Verify health:
   ```bash
   docker compose ps
   curl -I http://127.0.0.1:3200
   ```

---

## 3. Automated Backups & Off-Host Strategy

1. **Nightly Cron Job**:
   On `koltensserver`, add a nightly backup task via `crontab -e`:
   ```cron
   0 3 * * * /home/koltensaccount/docker/aubrey-rankings/scripts/backup.sh >> /home/koltensaccount/backups/aubrey-rankings/backup.log 2>&1
   ```

2. **Restore Procedure**:
   To test or restore a backup:
   ```bash
   /home/koltensaccount/docker/aubrey-rankings/scripts/restore.sh \
     /home/koltensaccount/backups/aubrey-rankings/aubrey_db_YYYYMMDD_HHMMSS.sql.gz \
     /home/koltensaccount/backups/aubrey-rankings/aubrey_uploads_YYYYMMDD_HHMMSS.tar.gz
   ```

3. **Off-Host Copy Recommendation**:
   Use an external rsync or restic schedule to replicate `/home/koltensaccount/backups/aubrey-rankings` to secondary offsite storage or encrypted object store. Never treat GitHub as a database backup.
