import 'dotenv/config'
import dns from 'node:dns'
// On some Windows networks Node's default dual-stack DNS hangs on IPv6
// to public APIs (e.g. Coinbase). Force IPv4 first to keep upstream
// fetches snappy.
dns.setDefaultResultOrder('ipv4first')
import { env } from './env.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import authRoutes, { promoteAllAdminEmails } from './routes/auth.js'
import profileRoutes from './routes/profile.js'
import holdingsRoutes from './routes/holdings.js'
import walletRoutes from './routes/wallet.js'
import tradesRoutes from './routes/trades.js'
import watchlistRoutes from './routes/watchlist.js'
import alertsRoutes from './routes/alerts.js'
import notificationsRoutes from './routes/notifications.js'
import aiRoutes from './routes/ai.js'
import marketRoutes from './routes/market.js'
import reviewsRoutes from './routes/reviews.js'
import adminRoutes from './routes/admin.js'
import { startAlertPoller } from './alertPoller.js'
import { startKeepAlive } from './keepAlive.js'

const app = express()
// Disable ETag generation on JSON responses. The client polls /api/wallet,
// /api/holdings, etc. expecting fresh data; ETag-driven 304s caused stale
// balances after admin mutations because the browser kept reusing its
// cached body even though the underlying data had changed.
app.set('etag', false)
const PORT = env.PORT
const IS_PROD = env.NODE_ENV === 'production'
const CORS_ORIGIN = env.CORS_ORIGIN.split(',').map((s) => s.trim())
// Allow any LAN origin (192.168.x.x / 10.x.x.x / 172.16-31.x.x) on port 3000
// or 5173 so phones / other devices on the same wifi can hit the dev API.
// Only enabled in non-production to avoid widening the prod CORS surface.
const LAN_ORIGIN_RE = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?$/

// Trust the first proxy hop (Railway / Cloudflare) so rate-limit + IP logging
// see the real client IP rather than the load balancer.
app.set('trust proxy', 1)

app.use(helmet({
  // CSP is delivered by the static host (Vite) for the app shell; here we
  // only serve JSON, so a permissive CSP is fine.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(compression())
// Build the set of allowed origins. We always allow the server's own public
// hostname (so the bundled SPA can call its own API without operators
// having to remember to set CORS_ORIGIN) plus anything explicitly listed.
const SELF_ORIGINS = [process.env.RENDER_EXTERNAL_URL, process.env.PUBLIC_URL]
  .filter((s): s is string => !!s)
  .map((s) => s.replace(/\/+$/, ''))
const ALLOWED_ORIGINS = new Set([...CORS_ORIGIN, ...SELF_ORIGINS])
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // curl, server-to-server
      if (ALLOWED_ORIGINS.has(origin)) return cb(null, true)
      // Always allow *.onrender.com for the SPA served from the same service.
      if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return cb(null, true)
      if (!IS_PROD && LAN_ORIGIN_RE.test(origin)) return cb(null, true)
      cb(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
    // Idempotency-Key powers safe retries on money-mutating endpoints.
    // Without listing it here the browser strips the header on cross-origin
    // POSTs and the server can't dedupe duplicates.
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Idempotent-Replay'],
  }),
)
app.use(express.json({ limit: '512kb' }))
app.use(cookieParser())
app.use(morgan(IS_PROD ? 'combined' : 'dev'))

// Global request limiter — generous, just to stop runaway scrapers / loops.
// Tighter per-route limits live in their own routers (e.g. /auth, /ai).
//
// VPN-friendly keying: many real users share a single VPN / corporate NAT
// exit-IP. If we keyed purely on IP they'd collectively exhaust the limit
// and the site would appear "broken" behind the VPN. Instead, when an
// Authorization: Bearer <jwt> header is present we key on the JWT's
// `sub` (user id) so each user gets their own bucket. Anonymous traffic
// still falls back to IP. We don't verify the token here — this is just
// a bucket key, and a forged token only earns the attacker their own
// bucket (no security value).
import jwt from 'jsonwebtoken'
function rateLimitKey(req: express.Request): string {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(header.slice(7)) as { sub?: string } | null
      if (decoded?.sub) return `u:${decoded.sub}`
    } catch {
      /* fall through to IP */
    }
  }
  // ipKeyGenerator-equivalent: req.ip already respects `trust proxy`.
  return `ip:${req.ip || 'anon'}`
}
app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 600, // higher ceiling; per-user keying makes this safe
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
  }),
)

const SERVER_BOOT_TIME = Date.now()

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'verdexis-api',
    version: '0.1.0',
    env: env.NODE_ENV,
    uptimeSec: Math.round((Date.now() - SERVER_BOOT_TIME) / 1000),
    nodeVersion: process.version,
    bootedAt: new Date(SERVER_BOOT_TIME).toISOString(),
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/holdings', holdingsRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/trades', tradesRoutes)
app.use('/api/watchlist', watchlistRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/market', marketRoutes)
app.use('/api/reviews', reviewsRoutes)
app.use('/api/admin', adminRoutes)

// In production, serve the built frontend (copied into ./public during the
// Docker build). API routes are registered above so they take precedence.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const STATIC_DIR = path.resolve(__dirname, '../public')
if (IS_PROD && fs.existsSync(STATIC_DIR)) {
  app.use(
    express.static(STATIC_DIR, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        // Hashed asset bundles can be cached aggressively.
        if (/\/assets\/.+\.[a-f0-9]{6,}\.(js|css|woff2?|png|jpg|svg)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      },
    }),
  )
  // SPA fallback — anything that isn't /api/* or a real file gets index.html.
  app.get(/^(?!\/api\/).*/, (_req, res, next) => {
    const indexPath = path.join(STATIC_DIR, 'index.html')
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath)
    next()
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[verdexis-api] unhandled error on ${req.method} ${req.path}:`, err)
  res.status(500).json({
    error: 'Internal server error',
    detail: err?.message || String(err),
    path: req.path,
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[verdexis-api] listening on http://0.0.0.0:${PORT} (LAN reachable)`)
  if (env.ALERT_POLL_ENABLED) {
    startAlertPoller({ intervalMs: env.ALERT_POLL_INTERVAL_MS })
  }
  startKeepAlive()
  // Best-effort: ensure ADMIN_EMAILS users are promoted on every boot.
  // Runs after listen so it never blocks healthchecks.
  promoteAllAdminEmails().catch((e) => console.error('[verdexis-api] admin bootstrap failed:', e))
})
