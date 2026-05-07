import 'dotenv/config'
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

const app = express()
const PORT = env.PORT
const CORS_ORIGIN = env.CORS_ORIGIN.split(',').map((s) => s.trim())

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
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

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`[verdexis-api] listening on http://localhost:${PORT}`)
})
