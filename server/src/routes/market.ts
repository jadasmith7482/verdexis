import { Router } from 'express'
import https from 'node:https'

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
function httpsGetJson(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': 'verdexis/0.1 (+https://verdexis.local)',
          connection: 'close',
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

export default router
