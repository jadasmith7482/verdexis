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

// Holdings are keyed by lowercase symbol ('btc') but the server's
// /api/market/tickers endpoint expects CoinGecko ids ('bitcoin'). Without
// this map a `liveTicker.subscribe('btc', cb)` call would ask the server
// for `ids=btc`, get an empty response, and never fire — which is exactly
// why dashboard prices were "frozen between refreshes". Anything we can
// resolve here is normalized to the CoinGecko id before going on the wire.
const SYMBOL_TO_COIN_ID: Record<string, string> = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ada: 'cardano',
  xrp: 'ripple', doge: 'dogecoin', dot: 'polkadot', link: 'chainlink',
  avax: 'avalanche-2', ltc: 'litecoin', matic: 'matic-network',
  shib: 'shiba-inu', uni: 'uniswap', bch: 'bitcoin-cash', xlm: 'stellar',
  atom: 'cosmos', fil: 'filecoin', near: 'near-protocol', apt: 'aptos',
  arb: 'arbitrum', op: 'optimism', bnb: 'binancecoin',
}

function canonical(idOrSymbol: string): string {
  const k = idOrSymbol.toLowerCase()
  return SYMBOL_TO_COIN_ID[k] ?? k
}

type Listener = (price: number) => void

class LiveTickerService {
  private listeners = new Map<string, Set<Listener>>()
  private latest = new Map<string, number>()
  private timer: number | null = null
  private inflight = false

  getPrice(coinId: string): number | null {
    return this.latest.get(canonical(coinId)) ?? null
  }

  subscribe(coinId: string, cb: Listener): () => void {
    const id = canonical(coinId)
    let bucket = this.listeners.get(id)
    if (!bucket) {
      bucket = new Set()
      this.listeners.set(id, bucket)
    }
    bucket.add(cb)
    const cached = this.latest.get(id)
    if (cached != null) cb(cached)
    this.ensurePolling()
    void this.tick()
    return () => {
      const b = this.listeners.get(id)
      if (!b) return
      b.delete(cb)
      if (b.size === 0) this.listeners.delete(id)
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
