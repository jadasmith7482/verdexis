// Markets Explorer — a dedicated discovery page for the full crypto list.
// The Trading page is a focused single-asset terminal; this page is the
// "shop the whole market" experience: category chips, filters, search,
// a sortable table with the metrics that actually matter (price, 24h,
// 7d, market cap, volume), and one-click jump into Trading or AssetDetail.
//
// All data comes from the same `marketData.getCryptoList()` call the rest
// of the app uses (250 coins, refreshed every 30s with live ticks layered
// on top via liveTicker), so there's nothing new to fetch — the page is
// pure presentation over data we already have.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, TrendingUp, TrendingDown, Star, ArrowUpDown, ArrowUp, ArrowDown,
  Sparkles, Filter, BarChart3, Layers, Coins, Brain, Smile, ShieldCheck,
} from 'lucide-react'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { Skeleton } from '../components/Skeleton'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { cryptoIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'
import { useCurrency } from '../lib/currencyContext'

// Lightweight category tagging. CoinGecko returns category metadata on a
// different endpoint we don't proxy; rather than make another upstream call
// per page-load we maintain a curated id->category map for the coins users
// actually browse. Anything not listed falls into "All" only.
type Category = 'all' | 'stablecoin' | 'l1' | 'defi' | 'ai' | 'meme' | 'watchlist'

const CATEGORIES: { id: Category; label: string; icon: typeof BarChart3 }[] = [
  { id: 'all', label: 'All', icon: BarChart3 },
  { id: 'watchlist', label: 'Watchlist', icon: Star },
  { id: 'stablecoin', label: 'Stablecoins', icon: ShieldCheck },
  { id: 'l1', label: 'Layer 1', icon: Layers },
  { id: 'defi', label: 'DeFi', icon: Coins },
  { id: 'ai', label: 'AI', icon: Brain },
  { id: 'meme', label: 'Memes', icon: Smile },
]

const CATEGORY_TAGS: Record<string, Category[]> = {
  // Stablecoins
  tether: ['stablecoin'], 'usd-coin': ['stablecoin'], dai: ['stablecoin'],
  'true-usd': ['stablecoin'], 'first-digital-usd': ['stablecoin'],
  'pax-dollar': ['stablecoin'], 'frax': ['stablecoin'],
  // Layer 1s
  bitcoin: ['l1'], ethereum: ['l1'], solana: ['l1'], cardano: ['l1'],
  ripple: ['l1'], 'binancecoin': ['l1'], tron: ['l1'], polkadot: ['l1'],
  'avalanche-2': ['l1'], litecoin: ['l1'], 'bitcoin-cash': ['l1'],
  stellar: ['l1'], cosmos: ['l1'], 'near-protocol': ['l1'], aptos: ['l1'],
  'internet-computer': ['l1'], 'ethereum-classic': ['l1'],
  vechain: ['l1'], algorand: ['l1'], tezos: ['l1'], eos: ['l1'],
  hedera: ['l1'], 'hedera-hashgraph': ['l1'], sui: ['l1'],
  toncoin: ['l1'], 'the-open-network': ['l1'], kaspa: ['l1'], 'kaspa-2': ['l1'],
  monero: ['l1'], zcash: ['l1'], dash: ['l1'], filecoin: ['l1'],
  fantom: ['l1'], 'mantle': ['l1'], 'sei-network': ['l1'], celestia: ['l1'],
  injective: ['l1'], 'injective-protocol': ['l1'], starknet: ['l1'],
  arbitrum: ['l1'], optimism: ['l1'], 'matic-network': ['l1'], polygon: ['l1'],
  // DeFi
  uniswap: ['defi'], aave: ['defi'], maker: ['defi'], curve: ['defi'],
  'curve-dao-token': ['defi'], lido: ['defi'], 'lido-dao': ['defi'],
  pendle: ['defi'], 'rocket-pool': ['defi'], chainlink: ['defi'],
  'wrapped-bitcoin': ['defi'], 'staked-ether': ['defi'],
  'wrapped-steth': ['defi'], thorchain: ['defi'], jupiter: ['defi'],
  'jupiter-exchange-solana': ['defi'], pyth: ['defi'], 'pyth-network': ['defi'],
  ondo: ['defi'], 'ondo-finance': ['defi'], blur: ['defi'],
  // AI
  'fetch-ai': ['ai'], fetch: ['ai'], 'render-token': ['ai'], render: ['ai'],
  bittensor: ['ai'], worldcoin: ['ai'], 'worldcoin-wld': ['ai'],
  'the-graph': ['ai'], 'singularitynet': ['ai'], 'ocean-protocol': ['ai'],
  // Memes
  dogecoin: ['meme'], 'shiba-inu': ['meme'], pepe: ['meme'], bonk: ['meme'],
  wif: ['meme'], dogwifcoin: ['meme'], 'floki': ['meme'],
}

function categoriesFor(coin: CryptoQuote): Category[] {
  return CATEGORY_TAGS[coin.id] ?? []
}

const WATCHLIST_KEY = 'verdexis_markets_watchlist'

function loadWatchlist(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(arr)
  } catch { return new Set() }
}

function saveWatchlist(set: Set<string>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
}

type SortKey = 'rank' | 'price' | 'change24h' | 'change7d' | 'marketCap' | 'volume'
type SortDir = 'asc' | 'desc'

function pct7d(coin: CryptoQuote): number {
  const spark = coin.sparkline_in_7d?.price
  if (!spark || spark.length < 2) return 0
  const first = spark[0]
  const last = spark[spark.length - 1]
  if (!first) return 0
  return ((last - first) / first) * 100
}

function compactNumber(n: number): string {
  if (!isFinite(n) || n === 0) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function MiniSpark({ prices, isUp }: { prices: number[]; isUp: boolean }) {
  if (!prices || prices.length < 2) return <div className="w-20 h-8" />
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const step = 80 / (prices.length - 1)
  const path = prices
    .map((p, i) => {
      const x = i * step
      const y = 24 - ((p - min) / range) * 20 - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 80 24" preserveAspectRatio="none" className="w-20 h-8">
      <path
        d={path}
        fill="none"
        stroke={isUp ? '#4CAF50' : '#f44336'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  )
}

// One row that subscribes to the live ticker so the price column animates.
function MarketRow({
  coin,
  index,
  watchlisted,
  onToggleWatch,
  fmtMoney,
}: {
  coin: CryptoQuote
  index: number
  watchlisted: boolean
  onToggleWatch: (id: string) => void
  fmtMoney: (n: number) => string
}) {
  const [livePrice, setLivePrice] = useState<number>(coin.current_price)
  useEffect(() => {
    setLivePrice(liveTicker.getPrice(coin.id) ?? coin.current_price)
    return liveTicker.subscribe(coin.id, (p) => setLivePrice(p))
  }, [coin.id, coin.current_price])

  const isUp = coin.price_change_percentage_24h >= 0
  const change7d = pct7d(coin)
  const is7dUp = change7d >= 0
  const sparkline = coin.sparkline_in_7d?.price ?? []
  const icon = cryptoIconFor(coin)

  return (
    <tr className="border-b border-[#ffffff05] hover:bg-[#ffffff03] transition-colors group">
      <td className="py-3 px-3 text-xs text-[#737373] tabular-nums w-12">
        <button
          onClick={() => onToggleWatch(coin.id)}
          className={`p-1 rounded transition-colors ${watchlisted ? 'text-[#FFC107]' : 'text-[#737373] opacity-0 group-hover:opacity-100 hover:text-[#FFC107]'}`}
          title={watchlisted ? 'Unwatch' : 'Add to watchlist'}
        >
          <Star className="w-3.5 h-3.5" fill={watchlisted ? '#FFC107' : 'none'} />
        </button>
      </td>
      <td className="py-3 px-2 text-xs text-[#737373] tabular-nums w-10">{index + 1}</td>
      <td className="py-3 px-2">
        <Link to={`/asset/${coin.id}`} className="flex items-center gap-3 min-w-0">
          {icon ? (
            <img
              src={icon}
              alt={coin.name}
              className="w-7 h-7 rounded-full object-cover shrink-0"
              onError={cryptoIconErrorFallback(coin.symbol[0]?.toUpperCase() || '?', coin.id)}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44] shrink-0">
              {coin.symbol[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-[#E5E5E5] truncate">{coin.name}</p>
            <p className="text-[10px] text-[#737373] uppercase">{coin.symbol}</p>
          </div>
        </Link>
      </td>
      <td className="py-3 px-2 text-right text-sm text-[#E5E5E5] tabular-nums">{fmtMoney(livePrice)}</td>
      <td className={`py-3 px-2 text-right text-xs tabular-nums ${isUp ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
        {isUp ? '+' : ''}{coin.price_change_percentage_24h.toFixed(2)}%
      </td>
      <td className={`py-3 px-2 text-right text-xs tabular-nums ${is7dUp ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
        {is7dUp ? '+' : ''}{change7d.toFixed(2)}%
      </td>
      <td className="py-3 px-2 text-right text-xs text-[#A0A0A0] tabular-nums">{compactNumber(coin.market_cap)}</td>
      <td className="py-3 px-2 text-right text-xs text-[#A0A0A0] tabular-nums">{compactNumber(coin.total_volume)}</td>
      <td className="py-3 px-2"><MiniSpark prices={sparkline} isUp={is7dUp} /></td>
      <td className="py-3 px-2 text-right">
        <Link
          to={`/trading?asset=${coin.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0C8B44]/10 hover:bg-[#0C8B44]/20 text-xs text-[#0C8B44] transition-colors"
        >
          Trade
        </Link>
      </td>
    </tr>
  )
}

export default function Markets() {
  const { format } = useCurrency()
  const fmtMoney = (n: number) => format(n)

  const [coins, setCoins] = useState<CryptoQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [watchlist, setWatchlist] = useState<Set<string>>(() => loadWatchlist())
  const [hideStables, setHideStables] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async (silent: boolean) => {
      if (!silent) setLoading(true)
      const data = await marketData.getCryptoList()
      if (cancelled) return
      setCoins(data)
      setLoading(false)
    }
    load(false)
    const id = setInterval(() => load(true), 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const toggleWatch = (id: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveWatchlist(next)
      return next
    })
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Sensible default direction per column.
      setSortDir(key === 'rank' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = coins
    if (q) {
      out = out.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
      )
    }
    if (category === 'watchlist') {
      out = out.filter((c) => watchlist.has(c.id))
    } else if (category !== 'all') {
      out = out.filter((c) => categoriesFor(c).includes(category))
    }
    if (hideStables && category !== 'stablecoin') {
      out = out.filter((c) => !categoriesFor(c).includes('stablecoin'))
    }
    const dir = sortDir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'rank': return dir * ((b.market_cap || 0) - (a.market_cap || 0)) * -1 // rank=asc means biggest mc first
        case 'price': return dir * (a.current_price - b.current_price)
        case 'change24h': return dir * (a.price_change_percentage_24h - b.price_change_percentage_24h)
        case 'change7d': return dir * (pct7d(a) - pct7d(b))
        case 'marketCap': return dir * ((a.market_cap || 0) - (b.market_cap || 0))
        case 'volume': return dir * ((a.total_volume || 0) - (b.total_volume || 0))
      }
    })
    return out
  }, [coins, search, category, watchlist, hideStables, sortKey, sortDir])

  // Top stats banner — global market context.
  const stats = useMemo(() => {
    if (coins.length === 0) return null
    const totalCap = coins.reduce((s, c) => s + (c.market_cap || 0), 0)
    const totalVol = coins.reduce((s, c) => s + (c.total_volume || 0), 0)
    const avg24h = coins.reduce((s, c) => s + c.price_change_percentage_24h, 0) / coins.length
    const gainers = coins.filter((c) => c.price_change_percentage_24h > 0).length
    const losers = coins.filter((c) => c.price_change_percentage_24h < 0).length
    return { totalCap, totalVol, avg24h, gainers, losers }
  }, [coins])

  const SortHeader = ({ label, k, align = 'right' }: { label: string; k: SortKey; align?: 'left' | 'right' }) => {
    const active = sortKey === k
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
    return (
      <th className={`py-3 px-2 text-${align}`}>
        <button
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition-colors ${active ? 'text-[#0C8B44]' : 'text-[#737373] hover:text-[#E5E5E5]'}`}
        >
          {label} <Icon className="w-3 h-3" />
        </button>
      </th>
    )
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-light text-[#E5E5E5] tracking-[-0.02em]">Markets</h1>
              <p className="text-sm text-[#737373] mt-1">
                {coins.length > 0 ? `${coins.length} assets` : 'Loading…'} · live prices
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0C8B44] ml-2 animate-pulse" />
              </p>
            </div>
            <Link
              to="/trading"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0C8B44] hover:bg-[#0C8B44]/90 text-white text-sm transition-colors"
            >
              <BarChart3 className="w-4 h-4" /> Open Trading
            </Link>
          </div>

          {/* Global market stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
                <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Total Market Cap</p>
                <p className="text-base font-light text-[#E5E5E5] tabular-nums">{compactNumber(stats.totalCap)}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
                <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">24h Volume</p>
                <p className="text-base font-light text-[#E5E5E5] tabular-nums">{compactNumber(stats.totalVol)}</p>
              </div>
              <div className="p-4 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
                <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Avg 24h Change</p>
                <p className={`text-base font-light tabular-nums ${stats.avg24h >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                  {stats.avg24h >= 0 ? '+' : ''}{stats.avg24h.toFixed(2)}%
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
                <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Gainers</p>
                <p className="text-base font-light text-[#4CAF50] tabular-nums flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> {stats.gainers}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
                <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Losers</p>
                <p className="text-base font-light text-[#f44336] tabular-nums flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> {stats.losers}
                </p>
              </div>
            </div>
          )}

          {/* Search + filter row */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets by name, symbol, or id..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1619] border border-[#ffffff08] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
              />
            </div>
            <button
              onClick={() => setHideStables((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs transition-colors ${hideStables ? 'bg-[#0C8B44]/10 border-[#0C8B44]/40 text-[#0C8B44]' : 'bg-[#0f1619] border-[#ffffff08] text-[#737373] hover:text-[#E5E5E5]'}`}
            >
              <Filter className="w-3.5 h-3.5" /> Hide stablecoins
            </button>
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((cat) => {
              const active = category === cat.id
              const Icon = cat.icon
              const count = cat.id === 'all'
                ? coins.length
                : cat.id === 'watchlist'
                  ? watchlist.size
                  : coins.filter((c) => categoriesFor(c).includes(cat.id)).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${active ? 'bg-[#0C8B44] text-white' : 'bg-[#0f1619] text-[#A0A0A0] hover:text-[#E5E5E5] border border-[#ffffff08]'}`}
                >
                  <Icon className="w-3 h-3" /> {cat.label}
                  <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-[#1a1a1a] text-[#737373]'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Table */}
          <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-16 text-center text-sm text-[#737373]">
                <Sparkles className="w-6 h-6 mx-auto mb-3 opacity-50" />
                No assets match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0a1012] border-b border-[#ffffff05]">
                    <tr>
                      <th className="py-3 px-3 w-12" />
                      <th className="py-3 px-2 text-left text-[10px] uppercase tracking-wider text-[#737373] w-10">#</th>
                      <th className="py-3 px-2 text-left text-[10px] uppercase tracking-wider text-[#737373]">Asset</th>
                      <SortHeader label="Price" k="price" />
                      <SortHeader label="24h" k="change24h" />
                      <SortHeader label="7d" k="change7d" />
                      <SortHeader label="Market Cap" k="marketCap" />
                      <SortHeader label="Volume" k="volume" />
                      <th className="py-3 px-2 text-left text-[10px] uppercase tracking-wider text-[#737373]">7d Chart</th>
                      <th className="py-3 px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((coin, i) => (
                      <MarketRow
                        key={coin.id}
                        coin={coin}
                        index={i}
                        watchlisted={watchlist.has(coin.id)}
                        onToggleWatch={toggleWatch}
                        fmtMoney={fmtMoney}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[10px] text-[#737373] mt-3 text-center">
            Market data by CoinGecko · live prices via Coinbase Exchange · refreshes every 30s
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
