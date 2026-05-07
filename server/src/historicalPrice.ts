// Historical spot-price lookup for an asset on a given date.
//
// Used by the admin "deposit + invest as" flow so a backdated deposit can be
// converted into a holding sized at the price the asset actually traded at on
// that day (no fabricated numbers, no random seeds).
//
// Crypto: CoinGecko's free /coins/{id}/history endpoint, keyed by the coin
//   id (e.g. 'bitcoin', 'ethereum'). It returns market_data.current_price.usd
//   for the date in `dd-mm-yyyy`.
// Stocks/ETFs: Alpha Vantage's TIME_SERIES_DAILY (close on the requested
//   date, falling back to the most recent prior trading day).

import { env } from './env.js'

interface CacheEntry { value: number; at: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 1000 * 60 * 60 * 6 // 6h — historical prices don't change

function cached(key: string): number | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) { cache.delete(key); return null }
  return hit.value
}
function put(key: string, value: number) { cache.set(key, { value, at: Date.now() }) }

function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function fetchJson<T = unknown>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// Resolve a CoinGecko coin id (BTC -> bitcoin, ETH -> ethereum, ...).
const SYMBOL_TO_COIN: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano', DOT: 'polkadot',
  XRP: 'ripple', DOGE: 'dogecoin', MATIC: 'matic-network', BNB: 'binancecoin',
  AVAX: 'avalanche-2', LINK: 'chainlink', UNI: 'uniswap', LTC: 'litecoin',
  USDT: 'tether', USDC: 'usd-coin',
}

export function coinIdFor(symbol: string): string | null {
  return SYMBOL_TO_COIN[symbol.toUpperCase()] ?? null
}

export async function getHistoricalCryptoPrice(symbol: string, when: Date): Promise<number | null> {
  const coinId = coinIdFor(symbol)
  if (!coinId) return null
  const date = ddmmyyyy(when)
  const key = `cg:${coinId}:${date}`
  const c = cached(key); if (c !== null) return c
  const j = await fetchJson<{ market_data?: { current_price?: { usd?: number } } }>(
    `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${date}&localization=false`,
  )
  const px = j?.market_data?.current_price?.usd
  if (typeof px === 'number' && isFinite(px) && px > 0) { put(key, px); return px }
  return null
}

export async function getHistoricalStockPrice(symbol: string, when: Date): Promise<number | null> {
  const key = env.ALPHA_VANTAGE_KEY
  if (!key) return null
  const cacheKey = `av:${symbol}:${isoDate(when)}`
  const c = cached(cacheKey); if (c !== null) return c
  const j = await fetchJson<{ ['Time Series (Daily)']?: Record<string, { ['4. close']?: string }> }>(
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${key}`,
  )
  const series = j?.['Time Series (Daily)']
  if (!series) return null
  // Walk back up to 7 days to skip weekends/holidays.
  const target = isoDate(when)
  for (let i = 0; i < 7; i++) {
    const probe = new Date(when)
    probe.setUTCDate(probe.getUTCDate() - i)
    const day = isoDate(probe)
    const row = series[day]
    const closeStr = row?.['4. close']
    if (closeStr) {
      const px = parseFloat(closeStr)
      if (isFinite(px) && px > 0) { put(cacheKey, px); return px }
    }
    if (i === 0 && target === day && !row) continue
  }
  return null
}

export async function getHistoricalPrice(
  symbol: string,
  type: 'crypto' | 'stock' | 'etf',
  when: Date,
): Promise<number | null> {
  if (type === 'crypto') return getHistoricalCryptoPrice(symbol, when)
  return getHistoricalStockPrice(symbol, when)
}

export async function getCurrentCryptoPrice(symbol: string): Promise<number | null> {
  const coinId = coinIdFor(symbol)
  if (!coinId) return null
  const key = `cg:current:${coinId}`
  // Short TTL for current price (5 min)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value
  const j = await fetchJson<Record<string, { usd?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
  )
  const px = j?.[coinId]?.usd
  if (typeof px === 'number' && isFinite(px) && px > 0) { put(key, px); return px }
  return null
}
