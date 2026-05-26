# syntax=docker/dockerfile:1.6
# Monorepo build: compiles the Vite frontend and the Express/Prisma API,
# then ships a single Node container that serves the API at /api/* and
# the SPA shell for everything else. Build context = repo root.

# --- frontend build stage -------------------------------------------------
FROM node:20-slim AS web
WORKDIR /web
COPY app/package.json app/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY app/ ./
# Vite + Rollup peak well over 1 GiB after the WalletConnect / @web3icons
# additions; 1024 MB triggers SIGABRT (exit 134). 4096 leaves headroom on
# Render/Railway free-tier 8 GiB build VMs.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

# --- server build stage ---------------------------------------------------
# Debian (glibc + OpenSSL 3) avoids the Alpine/musl Prisma engine crash:
#   "Could not parse schema engine response: Error loading shared library".
FROM node:20-slim AS api
WORKDIR /api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Copy the full server directory before installing to ensure any changes
# to server files (package.json, prisma schema, .d.ts stubs) invalidate
# the npm install cache layer on rebuild. This guarantees the build uses
# the latest package.json and runs prisma generate prior to tsc.
COPY server/ ./
RUN npm install --no-audit --no-fund
# Prisma's schema parser requires DATABASE_URL to exist even though
# `generate` never connects. The real value is injected at runtime by
# Render/Railway from the Postgres add-on.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate
RUN npm run build

# --- runtime stage --------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Production deps only
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Built API + Prisma artefacts
COPY --from=api /api/dist ./dist
COPY --from=api /api/prisma ./prisma
COPY --from=api /api/node_modules/.prisma ./node_modules/.prisma
COPY --from=api /api/node_modules/@prisma ./node_modules/@prisma

# Built SPA, served by Express in production (see server/src/index.ts)
COPY --from=web /web/dist ./public

EXPOSE 4000
# `db push` syncs the Postgres schema without requiring a migration history;
# safe for the current single-source-of-truth schema. Switch to
# `prisma migrate deploy` once you generate Postgres-native migrations.
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --accept-data-loss --skip-generate && node dist/index.js"]
