# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (incl. devDependencies for tsc + prisma)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source + schema and build
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production deps only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy built artefacts + Prisma client (generated in build stage)
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
