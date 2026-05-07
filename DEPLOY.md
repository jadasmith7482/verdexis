# Deploying Verdexis

The repo is configured to deploy as a **single container** to
[Railway](https://railway.com) (or any Docker host). The container builds the
Vite frontend and the Express/Prisma API, then runs a single Node process
that serves the SPA at `/` and the API at `/api/*` — no CORS, no second
service, no extra DNS to configure.

## What's in the box

- `Dockerfile` (repo root) — multi-stage build for `app/` + `server/`.
- `railway.json` — Railway build config (Dockerfile + `/api/health` healthcheck).
- `.dockerignore` — keeps the build context lean.
- `server/prisma/schema.prisma` — `provider = "postgresql"`.
- `server/src/index.ts` — serves `./public` (the built SPA) in production.

## One-time Railway setup

1. **Create a project** at <https://railway.com/new> → **Deploy from GitHub
   repo** → pick `Phillipjr9/verdexis`.
2. **Add Postgres**: in the project, click **+ New → Database → Add PostgreSQL**.
   Railway exposes a `DATABASE_URL` reference variable automatically.
3. **Set env vars** on the web service (Settings → Variables):

   | Variable | Required | Notes |
   | --- | --- | --- |
   | `DATABASE_URL` | yes | `${{Postgres.DATABASE_URL}}` (reference) |
   | `JWT_SECRET` | yes | Generate: `openssl rand -hex 32` |
   | `NODE_ENV` | yes | `production` |
   | `CORS_ORIGIN` | no | Same-origin deploy doesn't need this |
   | `APP_BASE_URL` | recommended | Your Railway URL, e.g. `https://verdexis.up.railway.app` |
   | `ADMIN_EMAILS` | no | Comma-separated list — auto-promotes on next login |
   | `FINNHUB_API_KEY` | optional | Stocks + news |
   | `ALPHA_VANTAGE_KEY` | optional | Stocks fallback |
   | `COINGECKO_API_KEY` | optional | Higher rate limits |
   | `OPENAI_API_KEY` | optional | AI Assistant |
   | `ANTHROPIC_API_KEY` | optional | AI Assistant fallback |

4. **Deploy** — Railway will detect `railway.json`, build the Dockerfile,
   run `prisma db push` against Postgres on first boot, and start the
   server. The healthcheck hits `/api/health`.

5. **Generate a public domain** (Settings → Networking → Generate Domain).

## Subsequent deploys

Push to `main` → Railway auto-builds and rolls out. There's no separate
frontend host to update.

## Local dev

Local dev still uses two processes:

```powershell
# Terminal 1 — API (needs Postgres running locally)
cd server
# One-time: copy .env.example to .env and set DATABASE_URL + JWT_SECRET
npx prisma generate
npx prisma db push
npm run dev

# Terminal 2 — frontend
cd app
npm run dev
```

If you don't have Postgres installed locally, run it in Docker:

```powershell
docker run -d --name verdexis-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
# DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres
```

## Production schema migrations

The Dockerfile uses `prisma db push --accept-data-loss --skip-generate` to
sync the schema on boot. This is fine for a single-source-of-truth schema
but **does not preserve history**. Once the schema stabilises, generate
proper Postgres migrations and switch the start command to
`prisma migrate deploy`:

```powershell
# Against a Postgres DB (local or staging)
cd server
rm -r prisma/migrations  # old SQLite migrations no longer apply
npx prisma migrate dev --name init
git add prisma/migrations && git commit -m "chore(db): postgres init migration"
```

Then update `Dockerfile` and `railway.json` `startCommand`:

```diff
- npx prisma db push --accept-data-loss --skip-generate && node dist/index.js
+ npx prisma migrate deploy && node dist/index.js
```
