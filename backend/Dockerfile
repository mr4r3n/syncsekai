# ==========================================
# SyncSekai backend - multi-stage production image
# ==========================================

# 1. Build
FROM node:22-alpine AS builder

WORKDIR /app

# System packages to build Prisma and native modules
RUN apk add --no-cache openssl libc6-compat python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Only runtime dependencies go to the final image (the Prisma CLI is one: the
# entrypoint applies migrations with it).
RUN npm prune --omit=dev

# 2. Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache openssl libc6-compat

RUN addgroup -S -g 10001 plexsync && \
    adduser -S -D -H -u 10001 -G plexsync plexsync

COPY --from=builder --chown=plexsync:plexsync /app/package*.json ./
COPY --from=builder --chown=plexsync:plexsync /app/node_modules ./node_modules
COPY --from=builder --chown=plexsync:plexsync /app/prisma ./prisma
COPY --from=builder --chown=plexsync:plexsync /app/dist ./dist
COPY --chown=plexsync:plexsync entrypoint.sh ./entrypoint.sh

RUN mkdir -p /app/uploads /app/backups && \
    chown plexsync:plexsync /app/uploads /app/backups && \
    sed -i 's/\r$//' /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 4000

USER plexsync

ENTRYPOINT ["/app/entrypoint.sh"]
