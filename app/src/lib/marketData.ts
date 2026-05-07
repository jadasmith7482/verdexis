const ALPHA_VANTAGE_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY || ''
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || ''
// CoinGecko is blocked by CORS for browser clients. We proxy through our own
// API which fetches server-side and caches. Vite dev proxies /api -> :4000.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''
const CG_PROXY = `${API_BASE}/api/market/coingecko`

export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: string
}

export interface CryptoQuote {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_24h: number
  price_change_percentage_24h: number
  market_cap: number
  total_volume: number
  high_24h: number
  low_24h: number
  sparkline_in_7d?: { price: number[] }
}

export interface MarketNews {
  category: string
  datetime: number
  headline: string
  source: string
  summary: string
  url: string
}

export interface Candle {
  time: number // ms epoch
  open: number
  high: number
  low: number
  close: number
}

export type OhlcRange = '1H' | '1D' | '1W' | '1M' | '1Y'

// Demo data that looks realistic
const DEMO_CRYPTO: CryptoQuote[] = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    current_price: 97432.18,
    price_change_24h: 1847.53,
    price_change_percentage_24h: 1.93,
    market_cap: 1927456789000,
    total_volume: 42567890123,
    high_24h: 98451.0,
    low_24h: 95432.0,
    sparkline_in_7d: { price: generateSparkline(92000, 98500, 168) },
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    current_price: 3847.92,
    price_change_24h: 92.45,
    price_change_percentage_24h: 2.46,
    market_cap: 462678901234,
    total_volume: 19876543210,
    high_24h: 3912.0,
    low_24h: 3723.0,
    sparkline_in_7d: { price: generateSparkline(3600, 3920, 168) },
  },
  {
    id: 'solana',
    symbol: 'sol',
    name: 'Solana',
    current_price: 248.73,
    price_change_24h: 8.92,
    price_change_percentage_24h: 3.72,
    market_cap: 118765432109,
    total_volume: 4567890123,
    high_24h: 256.0,
    low_24h: 237.0,
    sparkline_in_7d: { price: generateSparkline(220, 258, 168) },
  },
  {
    id: 'cardano',
    symbol: 'ada',
    name: 'Cardano',
    current_price: 1.0478,
    price_change_24h: 0.0324,
    price_change_percentage_24h: 3.19,
    market_cap: 37123456789,
    total_volume: 1234567890,
    high_24h: 1.07,
    low_24h: 1.01,
    sparkline_in_7d: { price: generateSparkline(0.98, 1.08, 168) },
  },
  {
    id: 'polkadot',
    symbol: 'dot',
    name: 'Polkadot',
    current_price: 7.84,
    price_change_24h: 0.21,
    price_change_percentage_24h: 2.75,
    market_cap: 11234567890,
    total_volume: 678901234,
    high_24h: 8.03,
    low_24h: 7.58,
    sparkline_in_7d: { price: generateSparkline(7.4, 8.1, 168) },
  },
]

function generateSparkline(min: number, max: number, points: number): number[] {
  const range = max - min
  return Array.from({ length: points }, () => min + Math.random() * range)
}

const DEMO_NEWS: MarketNews[] = [
  {
    category: 'crypto',
    datetime: Math.floor(Date.now() / 1000) - 3600,
    headline: 'Bitcoin ETF Inflows Reach Record $2.4B in Single Week',
    source: 'Bloomberg Crypto',
    summary: 'Institutional investors continue to pour capital into Bitcoin ETFs, marking the largest weekly inflow since launch.',
    url: '#',
  },
  {
    category: 'stock',
    datetime: Math.floor(Date.now() / 1000) - 7200,
    headline: 'Fed Signals Potential Rate Cuts in Q3 2025',
    source: 'Reuters',
    summary: 'Federal Reserve officials hint at monetary policy easing as inflation shows signs of cooling.',
    url: '#',
  },
  {
    category: 'crypto',
    datetime: Math.floor(Date.now() / 1000) - 10800,
    headline: 'Ethereum Layer 2 Networks See 300% Growth in TVL',
    source: 'The Defiant',
    summary: 'Total value locked in Ethereum scaling solutions reaches new all-time high amid surging DeFi activity.',
    url: '#',
  },
]

class MarketDataService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map()
  private cacheDuration = 30000              // generic cache (stocks etc)
  private cryptoCacheDuration = 20000        // live crypto list refreshes faster
  private ohlcCacheDuration = 60000          // OHLC bars don't tick every second
  private apiFailedUntil = 0                 // cooldown timestamp; 0 = healthy
  private apiCooldownMs = 45000              // back off this long after a failure, then retry

  private isApiCoolingDown(): boolean {
    return Date.now() < this.apiFailedUntil
  }

  private markApiFailed() {
    this.apiFailedUntil = Date.now() + this.apiCooldownMs
  }

  private getCached<T>(key: string, ttlMs: number = this.cacheDuration): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data as T
    }
    return null
  }

  private setCache<T>(key: string, data: T) {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    if (!ALPHA_VANTAGE_KEY) return this.getMockStockQuote(symbol)

    const cacheKey = `stock_${symbol}`
    const cached = this.getCached<StockQuote>(cacheKey)
    if (cached) return cached

    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
      )
      const data = await response.json()
      if (data['Global Quote']) {
        const quote = data['Global Quote']
        const result: StockQuote = {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
          volume: parseInt(quote['06. volume']),
          high: parseFloat(quote['03. high']),
          low: parseFloat(quote['04. low']),
          open: parseFloat(quote['02. open']),
          previousClose: parseFloat(quote['08. previous close']),
          timestamp: quote['07. latest trading day'],
        }
        this.setCache(cacheKey, result)
        return result
      }
      return this.getMockStockQuote(symbol)
    } catch {
      return this.getMockStockQuote(symbol)
    }
  }

  async getCryptoList(): Promise<CryptoQuote[]> {
    const cacheKey = 'crypto_list'
    const cached = this.getCached<CryptoQuote[]>(cacheKey, this.cryptoCacheDuration)
    if (cached) return cached

    if (this.isApiCoolingDown()) {
      const drifted = this.driftedDemoCrypto()
      this.setCache(cacheKey, drifted)
      return drifted
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(
        `${CG_PROXY}/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`)
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Empty response from CoinGecko')
      }

      this.setCache(cacheKey, data)
      return data
    } catch (error) {
      console.warn('CoinGecko API failed, using demo data:', error)
      this.markApiFailed()
      const drifted = this.driftedDemoCrypto()
      this.setCache(cacheKey, drifted)
      return drifted
    }
  }

  // Apply a small per-second random walk on top of DEMO_CRYPTO so the UI keeps
  // moving when CoinGecko is rate-limiting us. Deterministic per-call so two
  // simultaneous reads in the same tick agree.
  private driftedDemoCrypto(): CryptoQuote[] {
    const t = Date.now()
    return DEMO_CRYPTO.map((c) => {
      const seed = ((t / 1000) | 0) ^ [...c.id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7)
      const r = ((seed * 1664525 + 1013904223) >>> 0) / 0xffffffff
      const driftPct = (r - 0.5) * 0.004 // +/-0.2% per tick
      const price = c.current_price * (1 + driftPct)
      return { ...c, current_price: price, price_change_percentage_24h: c.price_change_percentage_24h + driftPct * 100 }
    })
  }

  async getCryptoPrice(ids: string[]): Promise<CryptoQuote[]> {
    const cacheKey = `crypto_${ids.join('_')}`
    const cached = this.getCached<CryptoQuote[]>(cacheKey)
    if (cached) return cached

    try {
      const response = await fetch(
        `${CG_PROXY}/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=true`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)
      const data = await response.json()
      this.setCache(cacheKey, data)
      return data
    } catch {
      return DEMO_CRYPTO.filter((c) => ids.includes(c.id))
    }
  }

  async getOhlc(coinId: string, range: OhlcRange): Promise<Candle[]> {
    // CoinGecko's /coins/{id}/ohlc supports days = 1, 7, 14, 30, 90, 180, 365, max.
    // Granularity is auto: <=2d → 30min, <=30d → 4h, >30d → 4d.
    const days = range === '1H' ? 1 : range === '1D' ? 1 : range === '1W' ? 7 : range === '1M' ? 30 : 365
    const cacheKey = `ohlc_${coinId}_${days}`
    const cached = this.getCached<Candle[]>(cacheKey, this.ohlcCacheDuration)
    if (cached) return cached

    if (this.isApiCoolingDown()) {
      const fake = this.simulateOhlc(coinId, range)
      this.setCache(cacheKey, fake)
      return fake
    }

    try {
      const url = `${CG_PROXY}/ohlc?id=${encodeURIComponent(coinId)}&vs_currency=usd&days=${days}`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) throw new Error(`OHLC ${res.status}`)
      const raw = (await res.json()) as Array<[number, number, number, number, number]>
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('empty')
      let candles: Candle[] = raw.map(([time, open, high, low, close]) => ({ time, open, high, low, close }))
      // For "1H" tighten to the last hour using the highest-resolution slice we got back.
      if (range === '1H') {
        const cutoff = Date.now() - 60 * 60 * 1000
        const recent = candles.filter((c) => c.time >= cutoff)
        if (recent.length >= 4) candles = recent
        else candles = candles.slice(-12)
      }
      this.setCache(cacheKey, candles)
      return candles
    } catch (error) {
      console.warn('CoinGecko OHLC failed, simulating:', error)
      const fake = this.simulateOhlc(coinId, range)
      this.setCache(cacheKey, fake)
      return fake
    }
  }

  // Deterministic, seeded random walk used as a fallback so the chart doesn't
  // re-roll on every render. Uses a coin/range seed so it's stable per pair.
  private simulateOhlc(coinId: string, range: OhlcRange): Candle[] {
    const seed = [...coinId, range].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)
    let rng = seed || 1
    const rand = () => {
      rng = (rng * 1664525 + 1013904223) >>> 0
      return rng / 0xffffffff
    }
    const points = range === '1H' ? 30 : range === '1D' ? 48 : range === '1W' ? 56 : range === '1M' ? 60 : 52
    const totalMs =
      range === '1H' ? 60 * 60 * 1000 :
      range === '1D' ? 24 * 60 * 60 * 1000 :
      range === '1W' ? 7 * 24 * 60 * 60 * 1000 :
      range === '1M' ? 30 * 24 * 60 * 60 * 1000 :
      365 * 24 * 60 * 60 * 1000
    const step = totalMs / points
    const seedQuote = DEMO_CRYPTO.find((c) => c.id === coinId)
    const base = seedQuote?.current_price ?? 50000
    const vol = base * 0.012
    let price = base * (1 - 0.03 + rand() * 0.06)
    const out: Candle[] = []
    const now = Date.now()
    for (let i = 0; i < points; i++) {
      const open = price
      const drift = (rand() - 0.5) * vol * 1.4
      const close = Math.max(0.0001, open + drift)
      const high = Math.max(open, close) + rand() * vol * 0.6
      const low = Math.min(open, close) - rand() * vol * 0.6
      out.push({ time: now - totalMs + step * i, open, high, low, close })
      price = close
    }
    // Tick the trailing bar with a time-based perturbation so successive calls
    // produce a slightly different last candle (live-ticking effect even when
    // CoinGecko is rate-limiting).
    const last = out[out.length - 1]
    const tickSeed = ((Date.now() / 1000) | 0) ^ seed
    const tickRand = ((tickSeed * 1664525 + 1013904223) >>> 0) / 0xffffffff
    const tickDrift = (tickRand - 0.5) * vol * 0.8
    last.close = Math.max(0.0001, last.close + tickDrift)
    last.high = Math.max(last.high, last.close)
    last.low = Math.min(last.low, last.close)
    last.time = Date.now()
    return out
  }

  async getMarketNews(): Promise<MarketNews[]> {
    if (!FINNHUB_KEY) return DEMO_NEWS

    const cacheKey = 'news'
    const cached = this.getCached<MarketNews[]>(cacheKey)
    if (cached) return cached

    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      )
      const data = await response.json()
      const result = data.slice(0, 10)
      this.setCache(cacheKey, result)
      return result
    } catch {
      return DEMO_NEWS
    }
  }

  async searchStocks(query: string): Promise<unknown[]> {
    if (!ALPHA_VANTAGE_KEY) return []
    try {
      const response = await fetch(
        `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${ALPHA_VANTAGE_KEY}`
      )
      const data = await response.json()
      return data.bestMatches || []
    } catch {
      return []
    }
  }

  private getMockStockQuote(symbol: string): StockQuote {
    const basePrice = Math.random() * 500 + 50
    return {
      symbol,
      price: basePrice,
      change: (Math.random() - 0.5) * 10,
      changePercent: (Math.random() - 0.5) * 5,
      volume: Math.floor(Math.random() * 100000000),
      high: basePrice * 1.02,
      low: basePrice * 0.98,
      open: basePrice * 0.99,
      previousClose: basePrice * 0.995,
      timestamp: new Date().toISOString(),
    }
  }
}

export const marketData = new MarketDataService()
