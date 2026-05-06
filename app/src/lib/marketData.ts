const ALPHA_VANTAGE_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY || ''
const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY || ''
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

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
  private cacheDuration = 60000
  private apiFailed = false

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
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
    const cached = this.getCached<CryptoQuote[]>(cacheKey)
    if (cached) return cached

    if (this.apiFailed) {
      this.setCache(cacheKey, DEMO_CRYPTO)
      return DEMO_CRYPTO
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true`,
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
      this.apiFailed = true
      this.setCache(cacheKey, DEMO_CRYPTO)
      return DEMO_CRYPTO
    }
  }

  async getCryptoPrice(ids: string[]): Promise<CryptoQuote[]> {
    const cacheKey = `crypto_${ids.join('_')}`
    const cached = this.getCached<CryptoQuote[]>(cacheKey)
    if (cached) return cached

    try {
      const response = await fetch(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=true`,
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
