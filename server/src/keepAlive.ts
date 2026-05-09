// Self-pinger to keep free-tier hosts (Render, Railway, Fly, Cyclic) awake.
//
// Render free web services spin down after ~15 minutes of inactivity and a
// cold start can take 30-60s. This module hits our own /api/health every
// KEEP_ALIVE_INTERVAL_MS so the platform never marks us idle.
//
// Auto-detects the public URL from these env vars (in order):
//   1. KEEP_ALIVE_URL                (explicit override)
//   2. RENDER_EXTERNAL_URL           (Render injects this automatically)
//   3. RAILWAY_PUBLIC_DOMAIN         (Railway, no scheme — we add https://)
//   4. RAILWAY_STATIC_URL            (older Railway var)
//   5. FLY_APP_NAME                  (Fly.io → https://<name>.fly.dev)
//   6. APP_BASE_URL                  (last resort — frontend URL, may be same host)
//
// If nothing resolves, the pinger logs once and stays disabled (no retries,
// no noise). Set KEEP_ALIVE_ENABLED=false to opt out entirely.

import { env } from './env.js'

let started = false

function resolveUrl(): string | null {
  if (env.KEEP_ALIVE_URL) return env.KEEP_ALIVE_URL.replace(/\/$/, '') + '/api/health'

  const render = process.env.RENDER_EXTERNAL_URL
  if (render) return render.replace(/\/$/, '') + '/api/health'

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
  if (railwayDomain) return `https://${railwayDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/health`

  const railwayStatic = process.env.RAILWAY_STATIC_URL
  if (railwayStatic) return railwayStatic.replace(/\/$/, '') + '/api/health'

  const fly = process.env.FLY_APP_NAME
  if (fly) return `https://${fly}.fly.dev/api/health`

  // Fallback: same host as the configured app base, but only if it's not
  // localhost (no point self-pinging in dev).
  if (env.APP_BASE_URL && !/localhost|127\.0\.0\.1/i.test(env.APP_BASE_URL)) {
    return env.APP_BASE_URL.replace(/\/$/, '') + '/api/health'
  }

  return null
}

export function startKeepAlive() {
  if (started) return
  if (!env.KEEP_ALIVE_ENABLED) {
    console.log('[verdexis-api] keep-alive disabled (KEEP_ALIVE_ENABLED=false)')
    return
  }

  const url = resolveUrl()
  if (!url) {
    console.log('[verdexis-api] keep-alive: no public URL detected — set KEEP_ALIVE_URL to enable')
    return
  }

  started = true
  const intervalMs = env.KEEP_ALIVE_INTERVAL_MS
  console.log(`[verdexis-api] keep-alive: pinging ${url} every ${Math.round(intervalMs / 1000)}s`)

  const ping = async () => {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 10_000)
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': 'verdexis-keepalive/1.0' },
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (!res.ok && res.status !== 304) {
        console.warn(`[verdexis-api] keep-alive: ${res.status} from ${url}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[verdexis-api] keep-alive: ping failed — ${msg}`)
    }
  }

  // First ping after 30s so the server has time to finish booting, then
  // every intervalMs after that. unref() so the timer doesn't block exit.
  const initial = setTimeout(() => { void ping() }, 30_000)
  initial.unref?.()
  const timer = setInterval(() => { void ping() }, intervalMs)
  timer.unref?.()
}
