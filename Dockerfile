# Stage 1: Base
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BETTER_AUTH_SECRET="build_placeholder_secret_for_compilation_only"
ARG APP_REVISION=unknown
ENV APP_REVISION=$APP_REVISION
RUN npm run build

# Stage 4: Production Runner
FROM base AS runner
WORKDIR /app

ARG APP_REVISION=unknown
ENV APP_REVISION=$APP_REVISION
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set up uploads directory with appropriate permissions
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder /app/docker-compose.yml ./docker-compose.yml
COPY --from=builder /app/scripts/migrate.cjs ./scripts/migrate.cjs
COPY --from=builder /app/scripts/auto-update.sh ./scripts/auto-update.sh
COPY --from=builder /app/scripts/backup.sh ./scripts/backup.sh
COPY --from=builder /app/src/db/migrations ./migrations

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
