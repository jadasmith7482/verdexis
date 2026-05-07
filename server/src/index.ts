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
import authRoutes from './routes/auth.js'
import profileRoutes from './routes/profile.js'
import holdingsRoutes from './routes/holdings.js'
import walletRoutes from './routes/wallet.js'
import tradesRoutes from './routes/trades.js'
import watchlistRoutes from './routes/watchlist.js'
import alertsRoutes from './routes/alerts.js'
import notificationsRoutes from './routes/notifications.js'
import aiRoutes from './routes/ai.js'
import marketRoutes from './routes/market.js'
import { startAlertPoller } from './alertPoller.js'

const app = express()
const PORT = env.PORT
const CORS_ORIGIN = env.CORS_ORIGIN.split(',').map((s) => s.trim())
// Allow any LAN origin (192.168.x.x / 10.x.x.x / 172.16-31.x.x) on port 3000
// or 5173 so phones / other devices on the same wifi can hit the dev API.
const LAN_ORIGIN_RE = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|localhost|127\.0\.0\.1)(:\d+)?$/

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // curl, server-to-server
      if (CORS_ORIGIN.includes(origin) || LAN_ORIGIN_RE.test(origin)) return cb(null, true)
      cb(new Error(`CORS blocked: ${origin}`))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'verdexis-api', version: '0.1.0', env: env.NODE_ENV })
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

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[verdexis-api] listening on http://0.0.0.0:${PORT} (LAN reachable)`)
  if (env.ALERT_POLL_ENABLED) {
    startAlertPoller({ intervalMs: env.ALERT_POLL_INTERVAL_MS })
  }
})
