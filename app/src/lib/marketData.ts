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

// No mock crypto / news fallbacks. When the upstream APIs are unreachable
// the service returns empty arrays so the UI can render an explicit
// empty/error state instead of fabricated prices that look like real money.

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
    if (!ALPHA_VANTAGE_KEY) return null

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
      return null
    } catch {
      return null
    }
  }

  async getCryptoList(): Promise<CryptoQuote[]> {
    const cacheKey = 'crypto_list'
    const cached = this.getCached<CryptoQuote[]>(cacheKey, this.cryptoCacheDuration)
    if (cached) return cached

    if (this.isApiCoolingDown()) {
      const stale = this.cache.get(cacheKey)?.data as CryptoQuote[] | undefined
      return stale ?? []
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
      console.warn('CoinGecko API failed; returning empty crypto list:', error)
      this.markApiFailed()
      // Reuse the last good cached value if we have one; otherwise empty.
      const stale = this.cache.get(cacheKey)?.data as CryptoQuote[] | undefined
      return stale ?? []
    }
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
      const stale = this.cache.get(cacheKey)?.data as CryptoQuote[] | undefined
      return stale ?? []
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
      const stale = this.cache.get(cacheKey)?.data as Candle[] | undefined
      return stale ?? []
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
      console.warn('CoinGecko OHLC failed; returning empty candles:', error)
      const stale = this.cache.get(cacheKey)?.data as Candle[] | undefined
      return stale ?? []
    }
  }

  async getMarketNews(): Promise<MarketNews[]> {
    if (!FINNHUB_KEY) return []

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
      return []
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
}

export const marketData = new MarketDataService()
