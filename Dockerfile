# syntax=docker/dockerfile:1.6
# Monorepo build: compiles the Vite frontend and the Express/Prisma API,
# then ships a single Node container that serves the API at /api/* and
# the SPA shell for everything else. Build context = repo root.

# --- frontend build stage -------------------------------------------------
FROM node:20-alpine AS web
WORKDIR /web
COPY app/package.json app/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY app/ ./
RUN npm run build

# --- server build stage ---------------------------------------------------
FROM node:20-alpine AS api
WORKDIR /api
COPY server/package.json server/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY server/ ./
# Prisma's schema parser requires DATABASE_URL to exist even though
# `generate` never connects. The real value is injected at runtime by
# Render/Railway from the Postgres add-on.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npx prisma generate
RUN npm run build

# --- runtime stage --------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

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
CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate && node dist/index.js"]
