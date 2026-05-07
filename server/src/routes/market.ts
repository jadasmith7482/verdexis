import { Router } from 'express'
import https from 'node:https'
import { env } from '../env.js'

// Server-side market data proxy. The browser is often blocked (firewall, CORS)
// from talking directly to exchange APIs / WebSockets, so we proxy through
// here. We pull from Coinbase Exchange (public, no key) and cache aggressively
// so even if the client polls every 1s we only hit upstream once per
// CACHE_MS per product.

const router: Router = Router()

// CoinGecko id -> Coinbase product id.
const COIN_TO_COINBASE: Record<string, string> = {
  bitcoin: 'BTC-USD',
  ethereum: 'ETH-USD',
  solana: 'SOL-USD',
  cardano: 'ADA-USD',
  ripple: 'XRP-USD',
  dogecoin: 'DOGE-USD',
  polkadot: 'DOT-USD',
  chainlink: 'LINK-USD',
  'avalanche-2': 'AVAX-USD',
  avalanche: 'AVAX-USD',
  litecoin: 'LTC-USD',
  'matic-network': 'MATIC-USD',
  polygon: 'MATIC-USD',
  'shiba-inu': 'SHIB-USD',
  uniswap: 'UNI-USD',
  'bitcoin-cash': 'BCH-USD',
  stellar: 'XLM-USD',
  'cosmos-hub': 'ATOM-USD',
  cosmos: 'ATOM-USD',
  filecoin: 'FIL-USD',
  'near-protocol': 'NEAR-USD',
  near: 'NEAR-USD',
  aptos: 'APT-USD',
  arbitrum: 'ARB-USD',
  optimism: 'OP-USD',
}

const CACHE_MS = 2500
const cache = new Map<string, { price: number; ts: number }>()
const inflight = new Map<string, Promise<number | null>>()

// Use Node's https module directly. We saw native fetch() (undici) hang on
// keep-alive sockets to api.exchange.coinbase.com from a long-running
// tsx-watch process on Windows even after `dns.setDefaultResultOrder('ipv4first')`.
// A fresh https.request per call (no keep-alive) is rock-solid here, and we
// cache aggressively so it's not a perf concern.
function httpsGetJson(url: string, timeoutMs: number, extraHeaders: Record<string, string> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': 'verdexis/0.1 (+https://verdexis.local)',
          connection: 'close',
          ...extraHeaders,
        },
        family: 4,
      },
      (res) => {
        if ((res.statusCode ?? 0) >= 400) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        })
      },
    )
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    req.end()
  })
}

async function fetchOne(product: string): Promise<number | null> {
  const cached = cache.get(product)
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.price
  const existing = inflight.get(product)
  if (existing) return existing
  const promise = (async () => {
    try {
      const data = (await httpsGetJson(
        `https://api.exchange.coinbase.com/products/${product}/ticker`,
        4000,
      )) as { price?: string }
      const price = data.price ? parseFloat(data.price) : NaN
      if (!isFinite(price)) return cached?.price ?? null
      cache.set(product, { price, ts: Date.now() })
      return price
    } catch (err) {
      console.warn(`[market] coinbase ${product} failed:`, (err as Error).message)
      return cached?.price ?? null
    } finally {
      inflight.delete(product)
    }
  })()
  inflight.set(product, promise)
  return promise
}

// GET /api/market/tickers?ids=bitcoin,ethereum,solana
// Returns: { bitcoin: 81050, ethereum: 3200, ... } — only includes ids we
// could resolve (missing keys mean upstream failed or coin not supported).
router.get('/tickers', async (req, res) => {
  const idsParam = (req.query.ids as string | undefined)?.trim()
  if (!idsParam) { res.json({}); return }
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50)
  const out: Record<string, number> = {}
  await Promise.all(ids.map(async (id) => {
    const product = COIN_TO_COINBASE[id]
    if (!product) return
    const price = await fetchOne(product)
    if (price != null) out[id] = price
  }))
  res.json(out)
})

// GET /api/market/supported-ids — for the client to know which coins it can
// expect live prices for.
router.get('/supported-ids', (_req, res) => {
  res.json({ ids: Object.keys(COIN_TO_COINBASE) })
})

// ---------------------------------------------------------------------------
// Real order book + recent trades from Coinbase Exchange (public, no key).
// ---------------------------------------------------------------------------

const obCache = new Map<string, { data: unknown; ts: number }>()
const trCache = new Map<string, { data: unknown; ts: number }>()
const OB_TTL_MS = 1500
const TR_TTL_MS = 3000

// GET /api/market/orderbook?id=bitcoin&level=2
// Returns a normalized { bids:[{price,size}], asks:[...] } structure with
// up to 25 levels per side, sourced from Coinbase's public order book.
router.get('/orderbook', async (req, res) => {
  const id = ((req.query.id as string | undefined) || '').trim().toLowerCase()
  const product = COIN_TO_COINBASE[id]
  if (!product) { res.status(400).json({ error: 'unsupported_id' }); return }
  const cached = obCache.get(product)
  if (cached && Date.now() - cached.ts < OB_TTL_MS) {
    res.set('Cache-Control', 'public, max-age=1')
    res.json(cached.data)
    return
  }
  try {
    const raw = await httpsGetJson(
      `https://api.exchange.coinbase.com/products/${product}/book?level=2`,
      4000,
    ) as { bids?: [string, string, number][]; asks?: [string, string, number][] }
    const bids = (raw.bids || []).slice(0, 25).map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) }))
    const asks = (raw.asks || []).slice(0, 25).map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) }))
    const out = { product, bids, asks }
    obCache.set(product, { data: out, ts: Date.now() })
    res.set('Cache-Control', 'public, max-age=1')
    res.json(out)
  } catch (err) {
    if (cached) { res.json(cached.data); return }
    res.status(502).json({ error: 'orderbook_unavailable', detail: (err as Error).message })
  }
})

// GET /api/market/recent-trades?id=bitcoin
// Returns Coinbase's last ~50 public trades for the product.
router.get('/recent-trades', async (req, res) => {
  const id = ((req.query.id as string | undefined) || '').trim().toLowerCase()
  const product = COIN_TO_COINBASE[id]
  if (!product) { res.status(400).json({ error: 'unsupported_id' }); return }
  const cached = trCache.get(product)
  if (cached && Date.now() - cached.ts < TR_TTL_MS) {
    res.set('Cache-Control', 'public, max-age=2')
    res.json(cached.data)
    return
  }
  try {
    const raw = await httpsGetJson(
      `https://api.exchange.coinbase.com/products/${product}/trades?limit=50`,
      4000,
    ) as { time: string; trade_id: number; price: string; size: string; side: 'buy' | 'sell' }[]
    const trades = raw.map((t) => ({
      id: t.trade_id,
      time: t.time,
      price: parseFloat(t.price),
      size: parseFloat(t.size),
      // Coinbase's `side` is the taker side: 'buy' means an ask was lifted.
      side: t.side,
    }))
    const out = { product, trades }
    trCache.set(product, { data: out, ts: Date.now() })
    res.set('Cache-Control', 'public, max-age=2')
    res.json(out)
  } catch (err) {
    if (cached) { res.json(cached.data); return }
    res.status(502).json({ error: 'trades_unavailable', detail: (err as Error).message })
  }
})

// ---------------------------------------------------------------------------
// CoinGecko proxy
// ---------------------------------------------------------------------------
// CoinGecko's public API is blocked by CORS for browser clients in many
// regions/networks. We proxy a small whitelist of read-only endpoints with
// short server-side caching so the client always has reliable data.

const CG_BASE = env.COINGECKO_API_KEY && env.COINGECKO_API_TIER === 'pro'
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3'
const CG_HEADERS: Record<string, string> = env.COINGECKO_API_KEY
  ? env.COINGECKO_API_TIER === 'pro'
    ? { 'x-cg-pro-api-key': env.COINGECKO_API_KEY }
    : { 'x-cg-demo-api-key': env.COINGECKO_API_KEY }
  : {}
// Without an API key, raise the cache TTL floor so we don't hammer the
// public endpoint and trip rate-limits on shared cloud egress IPs.
const CG_TTL_FLOOR_MS = env.COINGECKO_API_KEY ? 0 : 60_000
const cgCache = new Map<string, { data: unknown; ts: number }>()
const cgInflight = new Map<string, Promise<unknown>>()

async function cgFetch(pathAndQuery: string, ttlMs: number, timeoutMs = 6000): Promise<unknown> {
  const effectiveTtl = Math.max(ttlMs, CG_TTL_FLOOR_MS)
  const cached = cgCache.get(pathAndQuery)
  if (cached && Date.now() - cached.ts < effectiveTtl) return cached.data
  const existing = cgInflight.get(pathAndQuery)
  if (existing) return existing
  const promise = (async () => {
    try {
      const data = await httpsGetJson(`${CG_BASE}${pathAndQuery}`, timeoutMs, CG_HEADERS)
      cgCache.set(pathAndQuery, { data, ts: Date.now() })
      return data
    } catch (err) {
      // On error, return stale cache if we have it; otherwise rethrow.
      if (cached) return cached.data
      throw err
    } finally {
      cgInflight.delete(pathAndQuery)
    }
  })()
  cgInflight.set(pathAndQuery, promise)
  return promise
}

// GET /api/market/coingecko/markets?ids=bitcoin,ethereum&vs_currency=usd&sparkline=true&per_page=20
router.get('/coingecko/markets', async (req, res) => {
  const ids = ((req.query.ids as string | undefined) || '').trim()
  const vs = ((req.query.vs_currency as string | undefined) || 'usd').toLowerCase()
  const sparkline = String(req.query.sparkline ?? 'false') === 'true'
  const perPage = Math.min(250, Math.max(1, parseInt((req.query.per_page as string) || '50', 10) || 50))
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1)
  const order = (req.query.order as string | undefined) || 'market_cap_desc'
  const params = new URLSearchParams({
    vs_currency: vs,
    order,
    per_page: String(perPage),
    page: String(page),
    sparkline: String(sparkline),
  })
  if (ids) params.set('ids', ids)
  try {
    const data = await cgFetch(`/coins/markets?${params.toString()}`, 30_000)
    res.set('Cache-Control', 'public, max-age=20')
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: 'coingecko_unavailable', detail: (err as Error).message })
  }
})

// GET /api/market/coingecko/ohlc?id=bitcoin&days=1&vs_currency=usd
router.get('/coingecko/ohlc', async (req, res) => {
  const id = ((req.query.id as string | undefined) || '').trim().toLowerCase()
  const vs = ((req.query.vs_currency as string | undefined) || 'usd').toLowerCase()
  const days = parseInt((req.query.days as string) || '1', 10) || 1
  if (!id || !/^[a-z0-9-]+$/.test(id)) { res.status(400).json({ error: 'bad_id' }); return }
  try {
    const data = await cgFetch(`/coins/${id}/ohlc?vs_currency=${vs}&days=${days}`, 60_000)
    res.set('Cache-Control', 'public, max-age=45')
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: 'coingecko_unavailable', detail: (err as Error).message })
  }
})

// GET /api/market/coingecko/simple-price?ids=bitcoin,ethereum&vs_currencies=usd,eur,gbp
router.get('/coingecko/simple-price', async (req, res) => {
  const ids = ((req.query.ids as string | undefined) || '').trim()
  const vs = ((req.query.vs_currencies as string | undefined) || 'usd').trim()
  if (!ids) { res.json({}); return }
  const params = new URLSearchParams({ ids, vs_currencies: vs })
  try {
    const data = await cgFetch(`/simple/price?${params.toString()}`, 60_000)
    res.set('Cache-Control', 'public, max-age=45')
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: 'coingecko_unavailable', detail: (err as Error).message })
  }
})

export default router
