// Live price ticker that polls our backend proxy at /api/market/tickers.
// The browser is often blocked from talking directly to exchange WebSockets
// (corp firewalls, geofencing), so the server side does the upstream work
// and caches it; the client just polls the union of subscribed coins every
// LIVE_POLL_MS. Sub-second feel without needing a WebSocket.

// Use the Vite dev-server proxy so the request goes to whichever host the
// page was loaded from (localhost on desktop, 192.168.x.x on phone). Vite
// rewrites /api -> http://localhost:4000 server-side. VITE_API_BASE override
// is honored for prod builds.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const LIVE_POLL_MS = 2_000

type Listener = (price: number) => void

class LiveTickerService {
  private listeners = new Map<string, Set<Listener>>()
  private latest = new Map<string, number>()
  private timer: number | null = null
  private inflight = false

  getPrice(coinId: string): number | null {
    return this.latest.get(coinId) ?? null
  }

  subscribe(coinId: string, cb: Listener): () => void {
    let bucket = this.listeners.get(coinId)
    if (!bucket) {
      bucket = new Set()
      this.listeners.set(coinId, bucket)
    }
    bucket.add(cb)
    const cached = this.latest.get(coinId)
    if (cached != null) cb(cached)
    this.ensurePolling()
    // Kick off an immediate fetch so the new subscriber sees data ASAP.
    void this.tick()
    return () => {
      const b = this.listeners.get(coinId)
      if (!b) return
      b.delete(cb)
      if (b.size === 0) this.listeners.delete(coinId)
      if (this.listeners.size === 0) this.stopPolling()
    }
  }

  private ensurePolling() {
    if (this.timer != null) return
    if (typeof window === 'undefined') return
    this.timer = window.setInterval(() => { void this.tick() }, LIVE_POLL_MS)
  }

  private stopPolling() {
    if (this.timer != null) { window.clearInterval(this.timer); this.timer = null }
  }

  private async tick() {
    if (this.inflight) return
    const ids = Array.from(this.listeners.keys())
    if (ids.length === 0) return
    this.inflight = true
    try {
      const url = `${API_BASE}/api/market/tickers?ids=${encodeURIComponent(ids.join(','))}`
      const r = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (!r.ok) return
      const data = (await r.json()) as Record<string, number>
      for (const [coinId, price] of Object.entries(data)) {
        if (typeof price !== 'number' || !isFinite(price)) continue
        const prev = this.latest.get(coinId)
        if (prev === price) continue
        this.latest.set(coinId, price)
        const bucket = this.listeners.get(coinId)
        if (bucket) for (const cb of bucket) cb(price)
      }
    } catch {
      /* network blip — try again next interval */
    } finally {
      this.inflight = false
    }
  }
}

export const liveTicker = new LiveTickerService()
