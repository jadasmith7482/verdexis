import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import AuthModal from '../components/AuthModal'
import Footer from '../components/Footer'
import RiskMetricsCard from '../components/RiskMetricsCard'
import { Skeleton } from '../components/Skeleton'
import TopMovers from '../components/dashboard/TopMovers'
import PortfolioHealthCard from '../components/dashboard/PortfolioHealthCard'
import MorningBriefCard from '../components/dashboard/MorningBriefCard'
import AlertsSummaryCard from '../components/dashboard/AlertsSummaryCard'
import NewsSnippetCard from '../components/dashboard/NewsSnippetCard'
import GoalsProgressCard from '../components/dashboard/GoalsProgressCard'
import CategoryBreakdownCard from '../components/dashboard/CategoryBreakdownCard'
import StakingCard from '../components/dashboard/StakingCard'
import DcaCard from '../components/dashboard/DcaCard'
import GreetingHeader from '../components/dashboard/GreetingHeader'
import CurrencySelector from '../components/dashboard/CurrencySelector'
import ExportMenu from '../components/dashboard/ExportMenu'
import CustomizeWidgets from '../components/dashboard/CustomizeWidgets'
import AdminQuickPanel from '../components/dashboard/AdminQuickPanel'
import AdminConsoleEmbed from '../components/dashboard/AdminConsoleEmbed'
import TimeRangePicker, { type ChartRange } from '../components/dashboard/TimeRangePicker'
import NetWorthChart from '../components/NetWorthChart'
import EmptyStateCta from '../components/dashboard/EmptyStateCta'
import WatchlistPanel from '../components/WatchlistPanel'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { aiService, type AIInsight } from '../lib/aiService'
import { portfolioStore, type PortfolioHolding, type Trade, type WalletBalance, type WalletTransaction } from '../lib/portfolioStore'
import { assetIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'
import { useCurrency } from '../lib/currencyContext'
import { dashboardLayout, DASHBOARD_LAYOUT_EVENT } from '../lib/dashboardLayout'
import { computePortfolioHealth } from '../lib/portfolioHealth'
import { dcaStore, nextRunMs } from '../lib/dcaStore'
import { headlineAmountClass } from '../lib/utils'
import { Toaster, toast } from 'sonner'
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  BrainCircuit, Zap, Sparkles, AlertTriangle, BarChart3,
  PieChart, Activity, Lock,
  ArrowRight, Gem, Layers,
  History, Star, Repeat, Coins, Settings as SettingsIcon,
} from 'lucide-react'

const getCryptoLogo = (idOrSymbol: string, type?: string) => assetIconFor(idOrSymbol, type)

// Compact relative-time formatter for recent activity rows. Stays compact
// ("2m", "3h", "5d") for things that happened recently, but switches to an
// actual locale date once the row is more than 30 days old — a backdated
// transaction reading "338d ago" looks unprofessional next to the modern
// rows, so admins / users see e.g. "Mar 12, 2025" instead.
function relativeTimeShort(d: Date): string {
  const sec = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`
  if (sec < 86_400) return `${Math.round(sec / 3600)}h ago`
  if (sec < 86_400 * 30) return `${Math.round(sec / 86_400)}d ago`
  // Older than ~a month — show the actual date instead of a noisy
  // relative count. Includes the year only if it's not the current year.
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}

function getSparklinePath(prices: number[], width: number, height: number): string {
  // Need at least 2 points to draw a line. With 1 point, `width / 0` = Infinity
  // and the resulting SVG path is full of NaN coordinates.
  if (!prices || prices.length < 2) return ''
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const step = width / (prices.length - 1)
  return prices
    .map((p, i) => {
      const x = i * step
      const y = height - ((p - min) / range) * (height - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// Tiny child that subscribes to liveTicker for one coin so its price text
// and the tail of its sparkline visibly tick every ~2 seconds, instead of
// being frozen between the parent's 30s CoinGecko refreshes.
function LiveMarketCard({
  crypto,
  fmtMoney,
}: {
  crypto: CryptoQuote
  fmtMoney: (n: number) => string
}) {
  const baseSpark = crypto.sparkline_in_7d?.price.slice(-20) ?? []
  const [livePrice, setLivePrice] = useState<number>(crypto.current_price)
  useEffect(() => {
    setLivePrice(liveTicker.getPrice(crypto.id) ?? crypto.current_price)
    const unsub = liveTicker.subscribe(crypto.id, (p) => setLivePrice(p))
    return unsub
  }, [crypto.id, crypto.current_price])
  // Append the live price to the sparkline tail so the curve crawls forward
  // as new ticks arrive, instead of staying snapshot-still.
  const sparklinePrices = useMemo(() => {
    if (baseSpark.length === 0) return baseSpark
    const last = baseSpark[baseSpark.length - 1]
    if (Math.abs(livePrice - last) / Math.max(last, 1e-9) < 1e-6) return baseSpark
    return [...baseSpark.slice(1), livePrice]
  }, [baseSpark, livePrice])
  const isUp = crypto.price_change_percentage_24h >= 0
  return (
    <Link to={`/asset/${crypto.id}`} className="p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all min-w-0 overflow-hidden block">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {getCryptoLogo(crypto.id) ? (
            <img
              src={getCryptoLogo(crypto.id)!}
              alt={crypto.name}
              className="w-5 h-5 rounded-full object-cover shrink-0"
              onError={cryptoIconErrorFallback((crypto.symbol || crypto.id || '?').toUpperCase()[0] || '?', crypto.id)}
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44] shrink-0">{(crypto.symbol || crypto.id || '?').toUpperCase()[0]}</div>
          )}
          <span className="text-xs font-medium text-[#E5E5E5] truncate">{(crypto.symbol || crypto.id || '').toUpperCase()}</span>
        </div>
        {isUp ? <TrendingUp className="w-3 h-3 text-[#4CAF50] shrink-0" /> : <TrendingDown className="w-3 h-3 text-[#f44336] shrink-0" />}
      </div>
      <p className="text-base font-light text-[#E5E5E5] truncate tabular-nums">{fmtMoney(livePrice)}</p>
      <p className={`text-[11px] mt-0.5 truncate ${isUp ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
        {isUp ? '+' : ''}{(crypto.price_change_percentage_24h ?? 0).toFixed(2)}%
      </p>
      {sparklinePrices.length > 0 && (
        <div className="mt-2 h-7">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
            <path
              d={getSparklinePath(sparklinePrices, 100, 30)}
              fill="none"
              stroke={isUp ? '#4CAF50' : '#f44336'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />
          </svg>
        </div>
      )}
    </Link>
  )
}

export default function Dashboard() {
  const { format: fmtMoney } = useCurrency()
  const [cryptoData, setCryptoData] = useState<CryptoQuote[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [wallet, setWallet] = useState<WalletBalance[]>([])
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [chartRange, setChartRange] = useState<ChartRange>('1W')
  const [showBenchmark, setShowBenchmark] = useState(false)
  const [hiddenWidgets, setHiddenWidgets] = useState(() => dashboardLayout.hidden())
  const isAuthenticated = !!localStorage.getItem('verdexis_holdings')
  const userName = (() => {
    try {
      const auth = localStorage.getItem('verdexis_auth')
      if (auth) return (JSON.parse(auth).name as string) || 'there'
    } catch { /* ignore */ }
    return 'there'
  })()

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    const [crypto, aiInsights] = await Promise.all([
      marketData.getCryptoList(),
      aiService.getPortfolioInsights(),
    ])
    setCryptoData(crypto)
    setInsights(aiInsights)

    // Mark portfolio to market with the live quotes we just fetched so
    // value / P&L / allocation reflect actual prices, not avg-buy.
    if (crypto && crypto.length) {
      const quotes: Record<string, number> = {}
      for (const c of crypto) {
        quotes[c.id] = c.current_price
        if (c.symbol) quotes[c.symbol.toLowerCase()] = c.current_price
      }
      portfolioStore.markToMarket(quotes)
    }

    setHoldings([...portfolioStore.getHoldings()])
    setTrades(portfolioStore.getTrades().slice(0, 5))
    setWallet([...portfolioStore.getWallet()])
    setTransactions(portfolioStore.getTransactions().slice(0, 5))
    setLastUpdated(new Date())
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // Slow market data fetch (CoinGecko ratelimit-friendly)
    const marketInterval = setInterval(() => fetchData(true), 30000)
    // Fast tick: re-read local portfolio + bump 'last updated' every second.
    // Spread arrays so React sees a new reference and re-renders prices.
    const fastTick = setInterval(() => {
      setHoldings([...portfolioStore.getHoldings()])
      setWallet([...portfolioStore.getWallet()])
      setTransactions(portfolioStore.getTransactions().slice(0, 5))
      setLastUpdated(new Date())
    }, 1000)
    const refresh = () => {
      setHoldings([...portfolioStore.getHoldings()])
      setTrades(portfolioStore.getTrades().slice(0, 5))
      setWallet([...portfolioStore.getWallet()])
      setTransactions(portfolioStore.getTransactions().slice(0, 5))
    }
    window.addEventListener('verdexis:portfolio', refresh)
    return () => {
      clearInterval(marketInterval)
      clearInterval(fastTick)
      window.removeEventListener('verdexis:portfolio', refresh)
    }
  }, [])

  // Live price ticker -> mark portfolio to market on every price change so
  // the displayed totals (value, P&L, allocation) update sub-second instead
  // of being frozen between the 30s CoinGecko refreshes. We feed the price
  // back into markToMarket under BOTH the holding id (lowercase symbol) and
  // the canonical coingecko id so wallet-value cache + holdings stay in sync.
  const holdingKey = holdings.map((h) => `${h.id}|${h.symbol}`).join(',')
  useEffect(() => {
    if (!holdingKey) return
    const entries = holdingKey.split(',').map((p) => {
      const [id, symbol] = p.split('|')
      return { id, symbol }
    })
    const unsubs = entries.map(({ id, symbol }) => liveTicker.subscribe(symbol || id, (price) => {
      const quotes: Record<string, number> = {}
      if (id) quotes[id] = price
      if (symbol) {
        quotes[symbol] = price
        quotes[symbol.toLowerCase()] = price
        quotes[symbol.toUpperCase()] = price
      }
      portfolioStore.markToMarket(quotes)
    }))
    return () => unsubs.forEach((u) => u())
  }, [holdingKey])

  // Also subscribe to every non-USD wallet currency so the wallet value (and
  // therefore Total Net Worth) tracks the market in real time, not just when
  // a holding for the same asset happens to exist.
  const walletKey = wallet.map((w) => w.currency).filter((c) => c && c !== 'USD' && c !== 'USDC' && c !== 'USDT').join(',')
  useEffect(() => {
    if (!walletKey) return
    const currencies = walletKey.split(',')
    const unsubs = currencies.map((cur) => liveTicker.subscribe(cur, (price) => {
      portfolioStore.markToMarket({ [cur.toLowerCase()]: price, [cur.toUpperCase()]: price })
    }))
    return () => unsubs.forEach((u) => u())
  }, [walletKey])

  // Watch dashboard layout changes (widget show/hide)
  useEffect(() => {
    const refresh = () => setHiddenWidgets(dashboardLayout.hidden())
    window.addEventListener(DASHBOARD_LAYOUT_EVENT, refresh)
    return () => window.removeEventListener(DASHBOARD_LAYOUT_EVENT, refresh)
  }, [])

  // DCA scheduler — checks once a minute; when an active schedule is
  // overdue, simulates the buy at the current market price (using cached
  // cryptoData) so it shows up in trades + holdings just like a real one.
  useEffect(() => {
    if (!isAuthenticated) return
    const tick = () => {
      const now = Date.now()
      for (const s of dcaStore.list()) {
        if (!s.active) continue
        if (now < nextRunMs(s)) continue
        const quote = cryptoData.find((c) => c.id === s.assetId || c.symbol.toUpperCase() === s.asset)
        if (!quote || quote.current_price <= 0) continue
        const qty = s.amountUsd / quote.current_price
        // Deterministic key: same schedule + same scheduled run-slot will
        // ALWAYS produce the same idempotency key, so even if the tab
        // reloads or the timer double-fires we never DCA twice for one slot.
        const slot = nextRunMs(s)
        const dcaKey = `dca-${s.id}-${slot}`.replace(/[^A-Za-z0-9_\-:.]/g, '-').slice(0, 128)
        portfolioStore.executeTrade(s.asset, s.name, 'buy', quote.current_price, qty, 'dca', dcaKey.length >= 8 ? dcaKey : `dca-${slot}-${s.id.padStart(8, '0')}`)
        dcaStore.markRun(s.id)
        toast.success(`Auto-bought ${qty.toFixed(6)} ${s.asset} ($${s.amountUsd})`)
      }
    }
    tick()
    const t = setInterval(tick, 60_000)
    return () => clearInterval(t)
  }, [cryptoData, isAuthenticated])

  // Portfolio calculations.
  // `positionsValue` = market value of holdings only — used for chart scaling
  // and category-allocation breakdowns (where cash would skew the percentages).
  // `walletValueUsd` = wallet cash + crypto wallet balances valued at the same
  // live quotes the holdings use.
  // `totalValue` (a.k.a. Net Worth) = positions + wallet, so the dashboard's
  // headline number matches the Wallet page's Total Balance + Holdings value.
  const positionsValue = holdings.reduce((sum, h) => sum + h.value, 0)
  // Recompute every render: the wallet event listener already triggers re-renders.
  // void wallet/transactions deps to keep React happy without storing the helper output in state.
  void wallet; void transactions
  const walletValueUsd = portfolioStore.getWalletValueUsd()
  const totalValue = positionsValue + walletValueUsd
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0)
  const dayChangePercent = positionsValue > 0 ? (totalPnl / positionsValue) * 100 : 0
  const bestPerformer = holdings.length > 0
    ? holdings.reduce((best, h) => (h.pnlPercent > best.pnlPercent ? h : best), holdings[0])
    : null

  // Real net-worth history reconstructed from each holding's hourly
  // sparkline (CoinGecko sparkline_in_7d, ~168 hourly points) weighted by
  // the user's actual current quantity. The chart-range picker windows the
  // resulting series to 1D / 1W / 1M / 1Y / ALL — for ranges longer than
  // the available 7-day window, the early portion is approximated using
  // the holding's avg-buy price as a stable anchor.
  const quoteById: Record<string, CryptoQuote> = {}
  for (const c of cryptoData) {
    quoteById[c.id] = c
    if (c.symbol) quoteById[c.symbol.toLowerCase()] = c
  }
  const rangeBuckets: Record<ChartRange, number> = { '1D': 24, '1W': 168, '1M': 168, '1Y': 365, 'ALL': 365 }
  const HISTORY_POINTS = rangeBuckets[chartRange]
  const portfolioHistory: number[] = (() => {
    const series = new Array(HISTORY_POINTS).fill(0)
    let haveSparkline = false
    for (const h of holdings) {
      const q = quoteById[h.id] || quoteById[h.symbol?.toLowerCase?.() || '']
      const sp = q?.sparkline_in_7d?.price
      if (sp && sp.length >= 2) {
        haveSparkline = true
        // For 1D use last ~24 points; 1W use the full sparkline (~168 hourly).
        // 1M/1Y/ALL: no historical data beyond 7d, so anchor the start of the
        // window at the holding's avg-buy quantity-value and interpolate to
        // the most recent sparkline window.
        const window = chartRange === '1D' ? sp.slice(-24) : sp
        for (let i = 0; i < HISTORY_POINTS; i++) {
          if (chartRange === '1M' || chartRange === '1Y' || chartRange === 'ALL') {
            const recentStart = Math.floor(HISTORY_POINTS * 0.7)
            if (i < recentStart) {
              const t = recentStart > 0 ? i / recentStart : 1
              const startVal = h.quantity * h.avgBuyPrice
              const endVal = h.quantity * window[0]
              series[i] += startVal + (endVal - startVal) * t
            } else {
              const span = HISTORY_POINTS - recentStart
              const t = span > 0 ? (i - recentStart) / span : 0
              const idx = Math.min(window.length - 1, Math.round(t * (window.length - 1)))
              series[i] += h.quantity * window[idx]
            }
          } else {
            const idx = Math.min(window.length - 1, Math.round((i / (HISTORY_POINTS - 1)) * (window.length - 1)))
            series[i] += h.quantity * window[idx]
          }
        }
      } else {
        // Flat contribution (cash, stablecoin, or sparkline not yet loaded).
        const flat = h.value || h.quantity * h.currentPrice
        for (let i = 0; i < HISTORY_POINTS; i++) series[i] += flat
      }
    }
    // Fall-through for cash-only or fully-empty portfolios — show a flat
    // baseline at current net worth instead of a blank canvas.
    if (!haveSparkline && positionsValue === 0 && walletValueUsd > 0) {
      for (let i = 0; i < HISTORY_POINTS; i++) series[i] = walletValueUsd
      return series
    }
    if (!haveSparkline && totalValue > 0) {
      for (let i = 0; i < HISTORY_POINTS; i++) series[i] = totalValue
      return series
    }
    if (!haveSparkline) return []
    // Anchor the most recent point so the chart scale agrees with positions.
    const last = series[series.length - 1]
    if (last > 0 && positionsValue > 0) {
      const scale = positionsValue / last
      for (let i = 0; i < series.length; i++) series[i] *= scale
    }
    // Add wallet cash as a flat lift across the whole window.
    if (walletValueUsd > 0) {
      for (let i = 0; i < series.length; i++) series[i] += walletValueUsd
    }
    // Light moving-average smoothing (window = 5) to remove hourly noise.
    const W = 5
    const smoothed = series.map((_, i) => {
      const lo = Math.max(0, i - Math.floor(W / 2))
      const hi = Math.min(series.length - 1, i + Math.floor(W / 2))
      let sum = 0
      for (let j = lo; j <= hi; j++) sum += series[j]
      return sum / (hi - lo + 1)
    })
    smoothed[0] = series[0]
    smoothed[smoothed.length - 1] = series[series.length - 1]
    return smoothed
  })()
  const periodChange = portfolioHistory.length >= 2
    ? portfolioHistory[portfolioHistory.length - 1] - portfolioHistory[0]
    : 0
  const periodChangePercent = portfolioHistory.length >= 2 && portfolioHistory[0] > 0
    ? (periodChange / portfolioHistory[0]) * 100
    : 0

  const openLogin = () => { setAuthMode('login'); setAuthOpen(true) }
  const openSignup = () => { setAuthMode('signup'); setAuthOpen(true) }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          {/* Header — greeting + toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-2">
            <GreetingHeader name={userName} lastUpdated={lastUpdated} />
            {isAuthenticated && (
              <div className="flex flex-wrap items-center gap-2">
                <CurrencySelector />
                <ExportMenu />
                <CustomizeWidgets />
              </div>
            )}
          </div>

          {/* Inline admin tools — visible only when the server confirms admin role. */}
          <AdminQuickPanel />
          <AdminConsoleEmbed />

          {/* Total Net Worth — hero card placed directly under the greeting so it's the first thing users see after "Good afternoon". Includes the Highcharts area chart, range picker, vs-BTC benchmark toggle, and recent activity. Logged-out users see the lock CTA in the same slot. */}
          <div className="liquid-card p-8 mb-6" style={{ '--fill-color': 'rgba(12,139,68,0.12)' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-[#0C8B44]" />
                </div>
                <div>
                  <p className="text-sm text-[#A0A0A0]">{isAuthenticated ? 'Total Net Worth' : 'Portfolio Value'}</p>
                  <p className="text-xs text-[#737373]">{isAuthenticated ? 'Across all wallets' : 'Log in to view your data'}</p>
                </div>
              </div>
              {isAuthenticated && (
                <div className="text-right">
                  <p className={`text-sm flex items-center gap-1 justify-end ${periodChangePercent >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                    {periodChangePercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {periodChangePercent >= 0 ? '+' : ''}{periodChangePercent.toFixed(2)}% <span className="text-[#737373]">7d</span>
                  </p>
                  <p className={`text-xs ${periodChange >= 0 ? 'text-[#4CAF50]/80' : 'text-[#f44336]/80'}`}>
                    {fmtMoney(periodChange, { sign: true })}
                  </p>
                </div>
              )}
            </div>

            {isAuthenticated ? (
              <>
                <p className={`${headlineAmountClass(fmtMoney(totalValue))} font-light tracking-[-0.03em] text-[#E5E5E5] mb-1 whitespace-nowrap tabular-nums`}>
                  {fmtMoney(totalValue)}
                </p>
                <p className="text-xs text-[#737373] mb-4">
                  Cash {fmtMoney(walletValueUsd)} <span className="text-[#404040]">·</span> Positions {fmtMoney(positionsValue)}
                </p>

                {/* Range picker + benchmark toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <TimeRangePicker value={chartRange} onChange={setChartRange} />
                  <button
                    onClick={() => setShowBenchmark((v) => !v)}
                    className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${showBenchmark ? 'bg-[#FF9800]/15 text-[#FF9800] border-[#FF9800]/30' : 'text-[#737373] border-[#ffffff10] hover:text-[#E5E5E5]'}`}
                  >
                    vs BTC
                  </button>
                </div>

                {/* Highcharts Area Chart - real net worth from holdings sparklines */}
                <div className="w-full">
                  {portfolioHistory.length >= 2 ? (
                    <NetWorthChart
                      series={portfolioHistory}
                      benchmark={(() => {
                        if (!showBenchmark) return null
                        const btcSp = quoteById['bitcoin']?.sparkline_in_7d?.price
                        if (!btcSp || btcSp.length < 2) return null
                        const btcStart = btcSp[0]
                        const points = portfolioHistory.length
                        const baseStart = portfolioHistory[0]
                        const out: number[] = []
                        for (let i = 0; i < points; i++) {
                          const idx = Math.min(btcSp.length - 1, Math.round((i / (points - 1)) * (btcSp.length - 1)))
                          out.push((btcSp[idx] / btcStart) * baseStart)
                        }
                        return out
                      })()}
                      range={chartRange}
                      isUp={periodChangePercent >= 0}
                      height={240}
                    />
                  ) : (
                    <div className="h-48 w-full flex items-center justify-center text-xs text-[#737373]">
                      Loading market history…
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-[#737373] mt-2">
                  <span>{chartRange === '1D' ? '24h ago' : chartRange === '1W' ? '7 days ago' : chartRange === '1M' ? '30 days ago' : chartRange === '1Y' ? '1 year ago' : 'All time'}</span>
                  <span>Now</span>
                </div>

                {/* Recent Activity - moved here under Total Net Worth */}
                {transactions.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-[#ffffff08]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-[#E5E5E5]">Recent Activity</h4>
                      <Link to="/activity" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">View all</Link>
                    </div>
                    <div className="space-y-1">
                      {transactions.slice(0, 5).map((tx) => {
                        const isFiat = tx.currency === 'USD' || tx.currency === 'USDC' || tx.currency === 'USDT'
                        const fmtAmt = Math.abs(tx.amount).toLocaleString(undefined, {
                          minimumFractionDigits: isFiat ? 2 : 0,
                          maximumFractionDigits: isFiat ? 2 : 8,
                        })
                        const sign = tx.amount >= 0 ? '+' : '-'
                        const when = relativeTimeShort(new Date(tx.timestamp))
                        const isPending = tx.status === 'pending'
                        return (
                          <Link key={tx.id} to={`/activity?tx=${encodeURIComponent(tx.id)}`} className="flex items-center justify-between py-2 -mx-2 px-2 rounded-lg hover:bg-[#ffffff05] transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 ${tx.type === 'deposit' ? 'bg-[#4CAF50]/15 text-[#4CAF50]' : tx.type === 'withdraw' ? 'bg-[#f44336]/15 text-[#f44336]' : 'bg-[#FF9800]/15 text-[#FF9800]'}`}>
                                {tx.type === 'deposit' ? '↓' : tx.type === 'withdraw' ? '↑' : '↔'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-[#E5E5E5] truncate">{tx.description}</p>
                                <p className="text-[11px] text-[#737373] flex items-center gap-1.5 truncate">
                                  <span className="capitalize">{tx.type}</span>
                                  <span>·</span>
                                  <span>{when}</span>
                                  {isPending && (
                                    <>
                                      <span>·</span>
                                      <span className="text-[#FF9800]">Pending</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className={`text-sm tabular-nums ${tx.amount >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                                {sign}{fmtAmt} {tx.currency}
                              </p>
                              <p className="text-[10px] text-[#737373] uppercase tracking-[0.04em]">
                                {tx.amount >= 0 ? 'Credit' : 'Debit'}
                              </p>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mb-4">
                  <Lock className="w-7 h-7 text-[#0C8B44]" />
                </div>
                <p className="text-[#A0A0A0] mb-2">Your portfolio data is private</p>
                <p className="text-xs text-[#737373] mb-6">Log in to view your net worth, holdings, and performance</p>
                <div className="flex items-center gap-3">
                  <button onClick={openLogin} className="px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">
                    Log In
                  </button>
                  <button onClick={openSignup} className="px-5 py-2.5 text-[#A0A0A0] text-sm font-medium border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#E5E5E5] transition-colors">
                    Sign Up
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Empty-state CTA — shown when authenticated but no real holdings */}
          {isAuthenticated && holdings.filter((h) => h.id !== 'usd').length === 0 && (
            <EmptyStateCta />
          )}

          {/* Top Movers strip — public, always visible */}
          {!hiddenWidgets.has('topMovers') && cryptoData.length > 0 && (
            <TopMovers data={cryptoData} />
          )}

          {/* Top Stats Row — deduped: 'Total Net Worth' lives in the hero
              card above, so this row covers the next three KPIs only. */}
          {isAuthenticated && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Unrealized P&L', value: fmtMoney(totalPnl, { sign: true }), change: 'All-time', positive: totalPnl >= 0, icon: TrendingUp },
                { label: 'Best Performer', value: bestPerformer ? `${bestPerformer.pnlPercent >= 0 ? '+' : ''}${bestPerformer.pnlPercent.toFixed(1)}%` : 'N/A', change: bestPerformer ? bestPerformer.symbol : '', positive: (bestPerformer?.pnlPercent || 0) >= 0, icon: Gem },
                { label: 'Total Holdings', value: `${holdings.length}`, change: `${holdings.filter(h => h.id !== 'usd').length} assets`, positive: true, icon: Layers },
              ].map((stat) => (
                <div key={stat.label} className="p-5 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center shrink-0">
                      <stat.icon className="w-4 h-4 text-[#0C8B44]" />
                    </div>
                    <span className="text-xs text-[#737373] truncate">{stat.label}</span>
                  </div>
                  <p className="text-lg md:text-xl font-light text-[#E5E5E5] tracking-[-0.02em] truncate">{stat.value}</p>
                  <p className={`text-xs mt-1 truncate ${stat.positive ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{stat.change}</p>
                </div>
              ))}
            </div>
          )}

          {/* Morning Brief + Portfolio Health — the new "command center" row */}
          {isAuthenticated && (() => {
            const health = computePortfolioHealth({
              holdings,
              wallet,
              market: cryptoData,
              netWorth: totalValue,
            })
            const showBrief = !hiddenWidgets.has('morningBrief')
            const showHealth = !hiddenWidgets.has('portfolioHealth')
            if (!showBrief && !showHealth) return null
            return (
              <div className={`grid grid-cols-1 ${showBrief && showHealth ? 'lg:grid-cols-2' : ''} gap-4 mb-6`}>
                {showBrief && (
                  <MorningBriefCard
                    holdings={holdings}
                    market={cryptoData}
                    netWorth={totalValue}
                    dayChangePercent={dayChangePercent}
                    health={health}
                    fmtMoney={fmtMoney}
                    userName={userName}
                  />
                )}
                {showHealth && (
                  <PortfolioHealthCard
                    holdings={holdings}
                    wallet={wallet}
                    market={cryptoData}
                    netWorth={totalValue}
                  />
                )}
              </div>
            )
          })()}

          {/* Performance Metrics — inspired by Wealthfolio analytics */}
          {isAuthenticated && (() => {
            const allTrades = portfolioStore.getTrades()
            const buys = allTrades.filter(t => t.side === 'buy')
            const sells = allTrades.filter(t => t.side === 'sell')
            const totalInvested = buys.reduce((s, t) => s + t.total, 0)
            // Naive realized P&L using avg buy price for the same symbol at sell time
            const avgCostBySymbol = new Map<string, { qty: number; cost: number }>()
            buys.forEach(b => {
              const cur = avgCostBySymbol.get(b.symbol) || { qty: 0, cost: 0 }
              cur.qty += b.quantity; cur.cost += b.total
              avgCostBySymbol.set(b.symbol, cur)
            })
            let realizedPnl = 0
            let wins = 0
            sells.forEach(s => {
              const stats = avgCostBySymbol.get(s.symbol)
              if (!stats || stats.qty === 0) return
              const avg = stats.cost / stats.qty
              const pnl = (s.price - avg) * s.quantity
              realizedPnl += pnl
              if (pnl > 0) wins++
            })
            const winRate = sells.length > 0 ? (wins / sells.length) * 100 : 0
            const totalReturnPct = totalInvested > 0 ? ((positionsValue - totalInvested) / totalInvested) * 100 : 0
            return (
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[#E5E5E5]">Performance Metrics</h3>
                  <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">All-time</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Total Return</p>
                    <p className={`text-xl font-light ${totalReturnPct >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Realized P&L</p>
                    <p className={`text-xl font-light ${realizedPnl >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{realizedPnl >= 0 ? '+' : ''}${Math.abs(realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Win Rate</p>
                    <p className="text-xl font-light text-[#E5E5E5]">{winRate.toFixed(0)}% <span className="text-xs text-[#737373]">({wins}/{sells.length})</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#737373] mb-1">Total Trades</p>
                    <p className="text-xl font-light text-[#E5E5E5]">{allTrades.length} <span className="text-xs text-[#737373]">{buys.length} buys / {sells.length} sells</span></p>
                  </div>
                </div>
              </div>
            )
          })()}

          {isAuthenticated && (
            <div className="mb-6">
              <RiskMetricsCard />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <div className="liquid-card p-6" style={{ '--fill-color': 'rgba(0,131,143,0.15)' } as React.CSSProperties}>
              <h3 className="text-lg font-medium text-[#E5E5E5] mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Deposit', icon: ArrowDownRight, path: '/wallet?action=deposit', color: '#0C8B44', desc: 'Add funds' },
                  { label: 'Withdraw', icon: ArrowUpRight, path: '/wallet?action=withdraw', color: '#f44336', desc: 'Cash out' },
                  { label: 'Transfer', icon: ArrowRight, path: '/wallet?action=transfer', color: '#00838F', desc: 'Send funds' },
                  { label: 'Trade', icon: BarChart3, path: '/trading', color: '#FF9800', desc: 'Buy / Sell' },
                  { label: 'Convert', icon: Repeat, path: '/wallet?action=convert', color: '#26A69A', desc: 'Swap assets' },
                  { label: 'Stake', icon: Coins, path: '/wallet?action=stake', color: '#8E24AA', desc: 'Earn yield' },
                  { label: 'Activity', icon: History, path: '/activity', color: '#5C6BC0', desc: 'Transaction log' },
                  { label: 'Watchlist', icon: Star, path: '/dashboard?widget=watchlist', color: '#FFC107', desc: 'Saved assets' },
                  { label: 'AI Insights', icon: BrainCircuit, path: '/ai', color: '#6A0DAD', desc: 'Ask AI' },
                  { label: 'Set Alert', icon: AlertTriangle, path: '/alerts', color: '#F57C00', desc: 'Price alerts' },
                  { label: 'Goals', icon: Gem, path: '/goals', color: '#4CAF50', desc: 'Track goals' },
                  { label: 'News', icon: Layers, path: '/news', color: '#2196F3', desc: 'Markets' },
                  { label: 'Settings', icon: SettingsIcon, path: '/settings', color: '#757575', desc: 'Preferences' },
                ].map((action) => (
                  <Link key={action.label} to={action.path}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all group">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${action.color}15` }}>
                      <action.icon className="w-4 h-4" style={{ color: action.color }} />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#E5E5E5] truncate">{action.label}</p>
                      <p className="text-[10px] text-[#737373] truncate">{action.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* AI Insights - Public */}
            <div className="liquid-card p-6" style={{ '--fill-color': 'rgba(106,13,173,0.15)' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6A0DAD]/20 flex items-center justify-center">
                    <BrainCircuit className="w-5 h-5 text-[#9C27B0]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-[#E5E5E5]">AI Insights</h3>
                    <p className="text-xs text-[#737373]">Live analysis</p>
                  </div>
                </div>
                <Link to="/ai" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">Full Analysis</Link>
              </div>

              <div className="space-y-3">
                {insights.slice(0, 4).map((insight, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                    <div className="flex items-start gap-3">
                      {insight.type === 'recommendation' && <Sparkles className="w-4 h-4 text-[#0C8B44] mt-0.5 shrink-0" />}
                      {insight.type === 'alert' && <AlertTriangle className="w-4 h-4 text-[#F57C00] mt-0.5 shrink-0" />}
                      {insight.type === 'analysis' && <Zap className="w-4 h-4 text-[#2196F3] mt-0.5 shrink-0" />}
                      <div>
                        <p className="text-sm font-medium text-[#E5E5E5]">{insight.title}</p>
                        <p className="text-xs text-[#A0A0A0] mt-1 leading-relaxed">{insight.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#0C8B44] to-[#00E676]" style={{ width: `${insight.confidence}%` }} />
                          </div>
                          <span className="text-xs text-[#737373]">{insight.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio Breakdown - Authenticated Only */}
            <div className="lg:col-span-2 liquid-card p-6" style={{ '--fill-color': 'rgba(0,131,143,0.15)' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00838F]/20 flex items-center justify-center">
                    <PieChart className="w-5 h-5 text-[#00838F]" />
                  </div>
                  <h3 className="text-lg font-medium text-[#E5E5E5]">Portfolio Breakdown</h3>
                </div>
                <Link to="/trading" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">Rebalance</Link>
              </div>

              {isAuthenticated ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Holdings List */}
                  <div className="space-y-3">
                    {holdings.map((h) => (
                      <Link to={`/asset/${h.id}`} key={h.id} className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-[#ffffff05] transition-colors">
                        <div className="flex items-center gap-3">
                          {getCryptoLogo(h.symbol || h.id) ? (
                            <img
                              src={getCryptoLogo(h.symbol || h.id)!}
                              alt={h.name || h.symbol || h.id}
                              className="w-9 h-9 rounded-full object-cover"
                              onError={cryptoIconErrorFallback((h.symbol || h.id || '?')[0]?.toUpperCase() || '?', h.symbol || h.id)}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">
                              {(h.symbol || h.id || '?')[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-[#E5E5E5]">{h.name || h.symbol || h.id}</p>
                            <p className="text-xs text-[#737373]">
                              {h.quantity.toLocaleString()} {h.symbol}
                              {h.avgBuyPrice > 0 && (
                                <span className="ml-1.5 text-[#555]">· avg ${h.avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[#E5E5E5]">{fmtMoney(h.value)}</p>
                          <p className={`text-xs ${h.pnl >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                            {fmtMoney(h.pnl, { sign: true })} ({h.pnlPercent.toFixed(2)}%)
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Donut Chart + Allocation */}
                  <div className="flex flex-col items-center">
                    <svg viewBox="0 0 120 120" className="w-36 h-36 mb-4">
                      {(() => {
                        let offset = 0
                        const colors = ['#0C8B44', '#2196F3', '#FF9800', '#9C27B0', '#737373', '#00BCD4']
                        return holdings.map((h, i) => {
                          const dash = h.allocation * 3.6
                          const gap = 360 - dash
                          const el = (
                            <circle
                              key={h.id}
                              cx="60"
                              cy="60"
                              r="50"
                              fill="none"
                              stroke={colors[i % colors.length]}
                              strokeWidth="14"
                              strokeDasharray={`${dash} ${gap}`}
                              strokeDashoffset={-offset}
                              transform="rotate(-90 60 60)"
                              strokeLinecap="round"
                            />
                          )
                          offset += dash
                          return el
                        })
                      })()}
                      <circle cx="60" cy="60" r="32" fill="#070C0E" />
                      <text x="60" y="58" textAnchor="middle" fill="#E5E5E5" fontSize="14" fontWeight="300">{holdings.length}</text>
                      <text x="60" y="70" textAnchor="middle" fill="#737373" fontSize="8">Assets</text>
                    </svg>
                    <div className="w-full space-y-2">
                      {holdings.map((h, i) => {
                        const colors = ['#0C8B44', '#2196F3', '#FF9800', '#9C27B0', '#737373', '#00BCD4']
                        return (
                          <div key={h.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                              <span className="text-xs text-[#A0A0A0]">{h.symbol}</span>
                            </div>
                            <span className="text-xs text-[#E5E5E5]">{h.allocation}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-sm text-[#A0A0A0] mb-4">Log in to see your portfolio allocation and holdings</p>
                  <button onClick={openLogin} className="px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">
                    Log In to View Portfolio
                  </button>
                </div>
              )}

              {/* Recent Trades */}
              {isAuthenticated && trades.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#ffffff08]">
                  <h4 className="text-sm font-medium text-[#E5E5E5] mb-3">Recent Trades</h4>
                  <div className="space-y-2">
                    {trades.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${t.side === 'buy' ? 'bg-[#4CAF50]/20 text-[#4CAF50]' : 'bg-[#f44336]/20 text-[#f44336]'}`}>
                            {t.side === 'buy' ? '+' : '-'}
                          </div>
                          <span className="text-sm text-[#E5E5E5]">{t.symbol}</span>
                        </div>
                        <span className="text-xs text-[#A0A0A0]">{t.quantity.toFixed(4)} @ ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className={`text-xs ${t.side === 'buy' ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{t.side.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Wallet Balances - Authenticated */}
            {isAuthenticated && (
              <div className="liquid-card p-6" style={{ '--fill-color': 'rgba(12,139,68,0.1)' } as React.CSSProperties}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-[#0C8B44]" />
                    </div>
                    <h3 className="text-lg font-medium text-[#E5E5E5]">Wallet</h3>
                  </div>
                  <Link to="/wallet" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">Manage</Link>
                </div>
                <div className="space-y-3">
                  {wallet.map((w) => {
                    const cur = w.currency.toUpperCase()
                    const isFiat = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(cur)
                    const inner = (
                      <>
                      <div className="flex items-center gap-3">
                        {getCryptoLogo(w.currency.toLowerCase()) ? (
                          <img
                            src={getCryptoLogo(w.currency.toLowerCase())!}
                            alt={w.currency}
                            className="w-7 h-7 rounded-full object-cover"
                            onError={cryptoIconErrorFallback(w.currency[0]?.toUpperCase() || '?', w.currency.toLowerCase())}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44]">{w.currency[0]}</div>
                        )}
                        <div>
                          <p className="text-sm text-[#E5E5E5]">{w.currency}</p>
                          <p className="text-xs text-[#737373]">Available</p>
                        </div>
                      </div>
                      <span className="text-sm text-[#E5E5E5]">{w.symbol}{w.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                      </>
                    )
                    if (isFiat) {
                      return (
                        <div key={w.currency} className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a]/50">{inner}</div>
                      )
                    }
                    return (
                      <Link
                        key={w.currency}
                        to={`/asset/${w.currency.toLowerCase()}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a]/50 hover:bg-[#1a1a1a]/80 hover:border-[#0C8B44]/30 border border-transparent transition-colors"
                      >
                        {inner}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* New widget row 1 — alerts / goals / news (3-up) */}
            {isAuthenticated && (
              <>
                {!hiddenWidgets.has('alertsSummary') && <AlertsSummaryCard />}
                {!hiddenWidgets.has('goalsProgress') && <GoalsProgressCard portfolioValue={totalValue} />}
                {!hiddenWidgets.has('newsSnippet') && <NewsSnippetCard />}
              </>
            )}

            {/* New widget row 2 — connected accounts + categories (2-up wide) */}
            {isAuthenticated && (
              <>
                {/* ConnectedAccountsCard removed from homepage — banks/wallets
                    live on /wallet and /settings now to keep the dashboard
                    focused on portfolio + market signal. */}
                {!hiddenWidgets.has('categoryBreakdown') && (
                  <div className="lg:col-span-2"><CategoryBreakdownCard holdings={holdings} totalValue={positionsValue} /></div>
                )}
              </>
            )}

            {/* New widget row 3 — staking + dca + watchlist */}
            {isAuthenticated && (
              <>
                {!hiddenWidgets.has('staking') && <StakingCard />}
                {!hiddenWidgets.has('dca') && <DcaCard />}
                {!hiddenWidgets.has('watchlist') && (
                  <div id="watchlist" className="scroll-mt-24">
                    <WatchlistPanel
                      availableSymbols={cryptoData.slice(0, 10).map((c) => ({ symbol: (c.symbol || c.id || '').toUpperCase(), name: c.name || c.symbol || c.id }))}
                    />
                  </div>
                )}
              </>
            )}

            {/* Market Overview - Public */}
            <div className="lg:col-span-3 liquid-card p-6" style={{ '--fill-color': 'rgba(12,139,68,0.08)' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-[#0C8B44]" />
                  </div>
                  <h3 className="text-lg font-medium text-[#E5E5E5]">Market Overview</h3>
                </div>
                <Link to="/markets" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">
                  Full Markets <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-5 h-5 rounded-full" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-7 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {cryptoData.slice(0, 6).map((crypto) => (
                    <LiveMarketCard key={crypto.id} crypto={crypto} fmtMoney={fmtMoney} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
