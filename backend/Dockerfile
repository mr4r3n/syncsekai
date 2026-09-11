# ==========================================
# PlexSync Backend - Multi-Stage Production Dockerfile
# ==========================================

# 1. Base Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar Prisma y módulos nativos
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias
RUN npm ci

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar código fuente y compilar
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# 2. Production Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache openssl libc6-compat

RUN addgroup -S -g 10001 plexsync && \
    adduser -S -D -H -u 10001 -G plexsync plexsync

# Copiar dependencias de producción y cliente de Prisma generado
COPY --from=builder --chown=plexsync:plexsync /app/package*.json ./
COPY --from=builder --chown=plexsync:plexsync /app/node_modules ./node_modules
COPY --from=builder --chown=plexsync:plexsync /app/prisma ./prisma
COPY --from=builder --chown=plexsync:plexsync /app/dist ./dist

RUN mkdir -p /app/uploads /app/backups && \
    chown plexsync:plexsync /app/uploads /app/backups

# Script de arranque para sincronizar base de datos y lanzar API
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -eu' >> /app/entrypoint.sh && \
    echo './node_modules/.bin/prisma db push --skip-generate' >> /app/entrypoint.sh && \
    echo 'exec node dist/src/main' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 4000

USER plexsync

ENTRYPOINT ["/app/entrypoint.sh"]
