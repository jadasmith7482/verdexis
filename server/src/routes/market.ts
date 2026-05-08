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
// Returns: { bitcoin: 81050, ethereum: 3200, ... }. Tries Coinbase Exchange
// first (sub-2s freshness, no key needed) and falls back to CoinGecko's
// /simple/price for any id Coinbase doesn't list — so every coin in the
// app gets a live price, not just the ~25 in COIN_TO_COINBASE.
router.get('/tickers', async (req, res) => {
  const idsParam = (req.query.ids as string | undefined)?.trim()
  if (!idsParam) { res.json({}); return }
  const ids = idsParam.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 50)
  const out: Record<string, number> = {}
  // 1) Coinbase Exchange for the fast-path coins.
  await Promise.all(ids.map(async (id) => {
    const product = COIN_TO_COINBASE[id]
    if (!product) return
    const price = await fetchOne(product)
    if (price != null) out[id] = price
  }))
  // 2) CoinGecko fallback for everything else.
  const missing = ids.filter((id) => out[id] == null)
  if (missing.length > 0) {
    try {
      const data = (await cgFetch(
        `/simple/price?ids=${encodeURIComponent(missing.join(','))}&vs_currencies=usd`,
        15_000,
      )) as Record<string, { usd?: number }>
      for (const id of missing) {
        const p = data?.[id]?.usd
        if (typeof p === 'number' && isFinite(p)) out[id] = p
      }
    } catch (err) {
      console.warn('[market] tickers coingecko fallback failed:', (err as Error).message)
    }
  }
  res.set('Cache-Control', 'public, max-age=2')
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
// Tries CoinGecko first (richer history) and falls back to Coinbase Exchange
// candles when CoinGecko is rate-limited or down so the chart never goes
// blank for users.
router.get('/coingecko/ohlc', async (req, res) => {
  const id = ((req.query.id as string | undefined) || '').trim().toLowerCase()
  const vs = ((req.query.vs_currency as string | undefined) || 'usd').toLowerCase()
  const days = parseInt((req.query.days as string) || '1', 10) || 1
  if (!id || !/^[a-z0-9-]+$/.test(id)) { res.status(400).json({ error: 'bad_id' }); return }
  try {
    const data = await cgFetch(`/coins/${id}/ohlc?vs_currency=${vs}&days=${days}`, 60_000)
    if (Array.isArray(data) && data.length > 0) {
      res.set('Cache-Control', 'public, max-age=45')
      res.json(data)
      return
    }
    throw new Error('coingecko empty')
  } catch (cgErr) {
    // Fallback: Coinbase Exchange candles. Pick a granularity so we get a
    // sensible candle count for the requested window (target ~150 candles).
    const product = COIN_TO_COINBASE[id]
    if (!product) {
      res.status(502).json({ error: 'coingecko_unavailable', detail: (cgErr as Error).message })
      return
    }
    try {
      const candles = await fetchCoinbaseCandles(product, days)
      if (candles.length === 0) throw new Error('coinbase empty')
      res.set('Cache-Control', 'public, max-age=45')
      res.set('X-Data-Source', 'coinbase')
      res.json(candles)
    } catch (cbErr) {
      res.status(502).json({
        error: 'ohlc_unavailable',
        detail: `coingecko: ${(cgErr as Error).message}; coinbase: ${(cbErr as Error).message}`,
      })
    }
  }
})

// Coinbase /products/{id}/candles returns [time(s), low, high, open, close, volume].
// We normalise to CoinGecko's [time(ms), open, high, low, close] shape so the
// client doesn't have to care which upstream answered.
const cbCandlesCache = new Map<string, { data: number[][]; ts: number }>()
async function fetchCoinbaseCandles(product: string, days: number): Promise<number[][]> {
  const granularity =
    days <= 1 ? 300         // 5-min  → 288 candles for 1d
    : days <= 7 ? 3600      // 1-hour → 168 candles for 1w
    : days <= 30 ? 21600    // 6-hour → 120 candles for 1m
    : 86400                 // 1-day  → up to 365 candles for 1y
  const cacheKey = `${product}:${granularity}:${days}`
  const cached = cbCandlesCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < 60_000) return cached.data
  const end = Math.floor(Date.now() / 1000)
  const start = end - days * 24 * 60 * 60
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${granularity}&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`
  const raw = (await httpsGetJson(url, 6000)) as Array<[number, number, number, number, number, number]>
  if (!Array.isArray(raw)) return []
  // Coinbase returns newest-first; reverse so the chart plots left→right.
  const normalised = raw
    .slice()
    .reverse()
    .map(([t, low, high, open, close]) => [t * 1000, open, high, low, close])
  cbCandlesCache.set(cacheKey, { data: normalised, ts: Date.now() })
  return normalised
}

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

// ---------------------------------------------------------------------------
// News aggregator
// ---------------------------------------------------------------------------
// GET /api/market/news?category=general
// Tries NewsAPI first (richer + multi-source), falls back to Finnhub. Both
// keys live server-side so they're never shipped in the JS bundle.
type NewsItem = {
  id: string
  headline: string
  summary?: string
  source?: string
  url?: string
  image?: string
  datetime?: number
  category?: string
}
const newsCache = new Map<string, { data: NewsItem[]; ts: number }>()
const NEWS_TTL_MS = 60_000

router.get('/news', async (req, res) => {
  const category = ((req.query.category as string | undefined) || 'general').toLowerCase()
  const cacheKey = `news:${category}`
  const cached = newsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < NEWS_TTL_MS) {
    res.set('Cache-Control', 'public, max-age=45')
    res.json(cached.data)
    return
  }
  const errors: string[] = []
  // Provider 1: NewsAPI.org
  if (env.NEWS_API_KEY) {
    try {
      const q = category === 'crypto' || category === 'defi'
        ? 'cryptocurrency OR bitcoin OR ethereum'
        : category === 'macro' ? 'inflation OR "federal reserve" OR economy'
        : category === 'stocks' ? 'stocks OR markets OR earnings'
        : 'finance OR markets'
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${env.NEWS_API_KEY}`
      const data = (await httpsGetJson(url, 6000)) as {
        articles?: Array<{ title: string; description?: string; source?: { name?: string }; url?: string; urlToImage?: string; publishedAt?: string }>
      }
      const items: NewsItem[] = (data.articles ?? [])
        .filter((a) => a.title && a.url)
        .map((a, i) => ({
          id: `na-${i}-${a.publishedAt ?? ''}`,
          headline: a.title,
          summary: a.description ?? '',
          source: a.source?.name ?? 'NewsAPI',
          url: a.url,
          image: a.urlToImage ?? '',
          datetime: a.publishedAt ? Math.floor(new Date(a.publishedAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
          category,
        }))
      if (items.length > 0) {
        newsCache.set(cacheKey, { data: items, ts: Date.now() })
        res.set('Cache-Control', 'public, max-age=45')
        res.json(items)
        return
      }
      errors.push('newsapi: empty')
    } catch (err) {
      errors.push(`newsapi: ${(err as Error).message}`)
    }
  }
  // Provider 2: Finnhub
  if (env.FINNHUB_API_KEY) {
    try {
      const finnhubCat = category === 'stocks' ? 'general'
        : category === 'macro' ? 'forex'
        : category === 'defi' ? 'crypto'
        : category === 'all' ? 'general'
        : category
      const url = `https://finnhub.io/api/v1/news?category=${encodeURIComponent(finnhubCat)}&token=${env.FINNHUB_API_KEY}`
      const data = (await httpsGetJson(url, 6000)) as Array<{
        id?: number; headline?: string; summary?: string; source?: string; url?: string; image?: string; datetime?: number; category?: string
      }>
      const items: NewsItem[] = (Array.isArray(data) ? data : [])
        .filter((a) => a.headline && a.url)
        .slice(0, 30)
        .map((a, i) => ({
          id: String(a.id ?? `fh-${i}`),
          headline: a.headline ?? '',
          summary: a.summary ?? '',
          source: a.source ?? 'Finnhub',
          url: a.url,
          image: a.image ?? '',
          datetime: a.datetime,
          category: a.category ?? category,
        }))
      if (items.length > 0) {
        newsCache.set(cacheKey, { data: items, ts: Date.now() })
        res.set('Cache-Control', 'public, max-age=45')
        res.json(items)
        return
      }
      errors.push('finnhub: empty')
    } catch (err) {
      errors.push(`finnhub: ${(err as Error).message}`)
    }
  }
  // Stale cache fallback
  if (cached) { res.json(cached.data); return }
  res.status(502).json({ error: 'news_unavailable', detail: errors.join('; ') || 'no providers configured' })
})

// ---------------------------------------------------------------------------
// Stock quote (Twelve Data primary, Alpha Vantage fallback)
// ---------------------------------------------------------------------------
// GET /api/market/stock-quote?symbol=AAPL
const stockCache = new Map<string, { data: unknown; ts: number }>()
router.get('/stock-quote', async (req, res) => {
  const symbol = ((req.query.symbol as string | undefined) || '').trim().toUpperCase()
  if (!symbol || !/^[A-Z0-9.\-]{1,12}$/.test(symbol)) { res.status(400).json({ error: 'bad_symbol' }); return }
  const cached = stockCache.get(symbol)
  if (cached && Date.now() - cached.ts < 30_000) {
    res.set('Cache-Control', 'public, max-age=20')
    res.json(cached.data)
    return
  }
  const errors: string[] = []
  if (env.TWELVE_DATA_API_KEY) {
    try {
      const data = (await httpsGetJson(
        `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${env.TWELVE_DATA_API_KEY}`,
        6000,
      )) as { symbol?: string; name?: string; close?: string; change?: string; percent_change?: string; status?: string; message?: string }
      if (data.status === 'error' || !data.close) throw new Error(data.message || 'twelve data error')
      const out = {
        symbol: data.symbol ?? symbol,
        name: data.name ?? symbol,
        price: parseFloat(data.close),
        change: data.change ? parseFloat(data.change) : 0,
        changePercent: data.percent_change ? parseFloat(data.percent_change) : 0,
        source: 'twelvedata',
      }
      stockCache.set(symbol, { data: out, ts: Date.now() })
      res.set('Cache-Control', 'public, max-age=20')
      res.json(out)
      return
    } catch (err) {
      errors.push(`twelvedata: ${(err as Error).message}`)
    }
  }
  if (env.ALPHA_VANTAGE_KEY) {
    try {
      const data = (await httpsGetJson(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${env.ALPHA_VANTAGE_KEY}`,
        6000,
      )) as { 'Global Quote'?: Record<string, string> }
      const q = data['Global Quote']
      if (!q || !q['05. price']) throw new Error('alphavantage empty')
      const out = {
        symbol,
        name: symbol,
        price: parseFloat(q['05. price']),
        change: parseFloat(q['09. change'] ?? '0'),
        changePercent: parseFloat((q['10. change percent'] ?? '0').replace('%', '')),
        source: 'alphavantage',
      }
      stockCache.set(symbol, { data: out, ts: Date.now() })
      res.set('Cache-Control', 'public, max-age=20')
      res.json(out)
      return
    } catch (err) {
      errors.push(`alphavantage: ${(err as Error).message}`)
    }
  }
  if (cached) { res.json(cached.data); return }
  res.status(502).json({ error: 'stock_unavailable', detail: errors.join('; ') || 'no providers configured' })
})

export default router
