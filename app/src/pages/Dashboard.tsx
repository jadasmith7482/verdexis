import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import AuthModal from '../components/AuthModal'
import Footer from '../components/Footer'
import RiskMetricsCard from '../components/RiskMetricsCard'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { aiService, type AIInsight } from '../lib/aiService'
import { portfolioStore, type PortfolioHolding, type Trade, type WalletBalance, type WalletTransaction } from '../lib/portfolioStore'
import { cryptoIconFor } from '../lib/cryptoIcon'
import { Toaster } from 'sonner'
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  BrainCircuit, Zap, Sparkles, AlertTriangle, BarChart3,
  PieChart, Activity, ChevronRight, Lock,
  ArrowRight, CircleDollarSign, Gem, Layers,
} from 'lucide-react'

const getCryptoLogo = (id: string) => cryptoIconFor(id)

const fmtMoney = (n: number, opts: { compact?: boolean; sign?: boolean } = {}) => {
  const abs = Math.abs(n)
  const useCompact = opts.compact && abs >= 100_000
  const formatted = useCompact
    ? abs.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 })
    : abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const prefix = opts.sign ? (n >= 0 ? '+$' : '-$') : '$'
  return `${prefix}${formatted}`
}

function getSparklinePath(prices: number[], width: number, height: number): string {
  if (!prices || prices.length === 0) return ''
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

export default function Dashboard() {
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
  const isAuthenticated = !!localStorage.getItem('verdexis_holdings')

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

    setHoldings(portfolioStore.getHoldings())
    setTrades(portfolioStore.getTrades().slice(0, 5))
    setWallet(portfolioStore.getWallet())
    setTransactions(portfolioStore.getTransactions().slice(0, 5))
    setLastUpdated(new Date())
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // Slow market data fetch (CoinGecko ratelimit-friendly)
    const marketInterval = setInterval(() => fetchData(true), 30000)
    // Fast tick: re-read local portfolio + bump 'last updated' every second
    const fastTick = setInterval(() => {
      setHoldings(portfolioStore.getHoldings())
      setWallet(portfolioStore.getWallet())
      setTransactions(portfolioStore.getTransactions().slice(0, 5))
      setLastUpdated(new Date())
    }, 1000)
    const refresh = () => {
      setHoldings(portfolioStore.getHoldings())
      setTrades(portfolioStore.getTrades().slice(0, 5))
      setWallet(portfolioStore.getWallet())
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
  // of being frozen between the 30s CoinGecko refreshes.
  const holdingIds = holdings.map((h) => h.id).filter(Boolean).join(',')
  useEffect(() => {
    const ids = holdingIds ? holdingIds.split(',') : []
    if (ids.length === 0) return
    const unsubs = ids.map((id) => liveTicker.subscribe(id, (price) => {
      portfolioStore.markToMarket({ [id]: price })
    }))
    return () => unsubs.forEach((u) => u())
  }, [holdingIds])

  // Portfolio calculations
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0)
  const dayChangePercent = totalValue > 0 ? (totalPnl / totalValue) * 100 : 0
  const bestPerformer = holdings.length > 0
    ? holdings.reduce((best, h) => (h.pnlPercent > best.pnlPercent ? h : best), holdings[0])
    : null

  // Real 7-day net-worth history reconstructed from each holding's hourly
  // sparkline (CoinGecko sparkline_in_7d, ~168 hourly points) weighted by
  // the user's actual current quantity. Stable-coins / cash holdings without
  // a sparkline contribute a flat (quantity * currentPrice) line.
  const quoteById: Record<string, CryptoQuote> = {}
  for (const c of cryptoData) {
    quoteById[c.id] = c
    if (c.symbol) quoteById[c.symbol.toLowerCase()] = c
  }
  const HISTORY_POINTS = 168
  const portfolioHistory: number[] = (() => {
    if (!holdings.length) return []
    const series = new Array(HISTORY_POINTS).fill(0)
    let haveAny = false
    for (const h of holdings) {
      const q = quoteById[h.id] || quoteById[h.symbol?.toLowerCase?.() || '']
      const sp = q?.sparkline_in_7d?.price
      if (sp && sp.length >= 2) {
        haveAny = true
        // Resample sparkline into HISTORY_POINTS buckets
        for (let i = 0; i < HISTORY_POINTS; i++) {
          const idx = Math.min(sp.length - 1, Math.round((i / (HISTORY_POINTS - 1)) * (sp.length - 1)))
          series[i] += h.quantity * sp[idx]
        }
      } else {
        // Flat contribution (cash, stablecoin, or missing sparkline)
        const flat = h.value || h.quantity * h.currentPrice
        for (let i = 0; i < HISTORY_POINTS; i++) series[i] += flat
      }
    }
    if (!haveAny) return []
    // Anchor the most recent point to the current totalValue so the chart
    // visually agrees with the big number above it.
    const last = series[series.length - 1]
    if (last > 0 && totalValue > 0) {
      const scale = totalValue / last
      for (let i = 0; i < series.length; i++) series[i] *= scale
    }
    // Light moving-average smoothing (window = 5) to remove hourly noise
    // while preserving real shape & endpoints.
    const W = 5
    const smoothed = series.map((_, i) => {
      const lo = Math.max(0, i - Math.floor(W / 2))
      const hi = Math.min(series.length - 1, i + Math.floor(W / 2))
      let sum = 0
      for (let j = lo; j <= hi; j++) sum += series[j]
      return sum / (hi - lo + 1)
    })
    // Preserve exact start and end so % change stays accurate
    smoothed[0] = series[0]
    smoothed[smoothed.length - 1] = series[series.length - 1]
    return smoothed
  })()
  const chartMax = portfolioHistory.length ? Math.max(...portfolioHistory) : 0
  const chartMin = portfolioHistory.length ? Math.min(...portfolioHistory) : 0
  const chartRange = chartMax - chartMin || 1
  const chartPath = portfolioHistory
    .map((v, i) => {
      const x = (i / (portfolioHistory.length - 1 || 1)) * 100
      const y = 100 - ((v - chartMin) / chartRange) * 90 - 5
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const areaPath = portfolioHistory.length ? chartPath + ` L100,100 L0,100 Z` : ''
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
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Dashboard</h1>
              <p className="text-sm text-[#737373] mt-1 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0C8B44] animate-pulse" />
                Live · Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Top Stats Row */}
          {isAuthenticated && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Net Worth', value: fmtMoney(totalValue, { compact: true }), change: `${dayChangePercent >= 0 ? '+' : ''}${dayChangePercent.toFixed(2)}%`, positive: dayChangePercent >= 0, icon: CircleDollarSign },
                { label: 'Unrealized P&L', value: fmtMoney(totalPnl, { sign: true, compact: true }), change: 'All-time', positive: totalPnl >= 0, icon: TrendingUp },
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
            const totalReturnPct = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0
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
                    <p className={`text-xl font-light ${realizedPnl >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{realizedPnl >= 0 ? '+' : ''}${Math.abs(realizedPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Portfolio Value Chart - Authenticated Only */}
            <div className="lg:col-span-2 liquid-card p-8" style={{ '--fill-color': 'rgba(12,139,68,0.12)' } as React.CSSProperties}>
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
                  <p className="text-3xl sm:text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6 truncate">
                    {fmtMoney(totalValue)}
                  </p>
                  {/* SVG Area Chart - real 7-day net worth from holdings sparklines */}
                  <div className="h-48 w-full">
                    {portfolioHistory.length >= 2 ? (
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={periodChangePercent >= 0 ? '#0C8B44' : '#f44336'} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={periodChangePercent >= 0 ? '#0C8B44' : '#f44336'} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={areaPath} fill="url(#areaGradient)" />
                        <path d={chartPath} fill="none" stroke={periodChangePercent >= 0 ? '#0C8B44' : '#f44336'} strokeWidth="0.5" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-[#737373]">
                        Loading market history…
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#737373] mt-2">
                    <span>7 days ago</span>
                    <span>Now</span>
                  </div>

                  {/* Recent Activity - moved here under Total Net Worth */}
                  {transactions.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-[#ffffff08]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-[#E5E5E5]">Recent Activity</h4>
                        <Link to="/wallet" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">View all</Link>
                      </div>
                      <div className="space-y-1">
                        {transactions.slice(0, 5).map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] shrink-0 ${tx.type === 'deposit' ? 'bg-[#4CAF50]/15 text-[#4CAF50]' : tx.type === 'withdraw' ? 'bg-[#f44336]/15 text-[#f44336]' : 'bg-[#FF9800]/15 text-[#FF9800]'}`}>
                                {tx.type === 'deposit' ? '↓' : tx.type === 'withdraw' ? '↑' : '↔'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-[#E5E5E5] truncate">{tx.description}</p>
                                <p className="text-[11px] text-[#737373] capitalize">{tx.type}</p>
                              </div>
                            </div>
                            <span className={`text-sm shrink-0 ml-3 ${tx.amount >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                              {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} {tx.currency}
                            </span>
                          </div>
                        ))}
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

            {/* Quick Actions */}
            <div className="liquid-card p-6" style={{ '--fill-color': 'rgba(0,131,143,0.15)' } as React.CSSProperties}>
              <h3 className="text-lg font-medium text-[#E5E5E5] mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {[
                  { label: 'Deposit', icon: ArrowDownRight, path: '/wallet?action=deposit', color: '#0C8B44', desc: 'Add funds' },
                  { label: 'Withdraw', icon: ArrowUpRight, path: '/wallet?action=withdraw', color: '#f44336', desc: 'Cash out' },
                  { label: 'Trade', icon: BarChart3, path: '/trading', color: '#FF9800', desc: 'Buy/Sell' },
                  { label: 'AI Insights', icon: BrainCircuit, path: '/ai', color: '#6A0DAD', desc: 'Ask AI' },
                ].map((action) => (
                  <Link key={action.label} to={action.path}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all group">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${action.color}15` }}>
                      <action.icon className="w-5 h-5" style={{ color: action.color }} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-[#E5E5E5]">{action.label}</p>
                      <p className="text-xs text-[#737373]">{action.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0C8B44] transition-colors" />
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
                          {getCryptoLogo(h.id) ? (
                            <img src={getCryptoLogo(h.id)!} alt={h.name} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">
                              {h.symbol[0]}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-[#E5E5E5]">{h.name}</p>
                            <p className="text-xs text-[#737373]">{h.quantity.toLocaleString()} {h.symbol}</p>
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
                        <span className="text-xs text-[#A0A0A0]">{t.quantity.toFixed(4)} @ ${t.price.toLocaleString()}</span>
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
                  {wallet.map((w) => (
                    <div key={w.currency} className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a]/50">
                      <div className="flex items-center gap-3">
                        {getCryptoLogo(w.currency.toLowerCase()) ? (
                          <img src={getCryptoLogo(w.currency.toLowerCase())!} alt={w.currency} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44]">{w.currency[0]}</div>
                        )}
                        <div>
                          <p className="text-sm text-[#E5E5E5]">{w.currency}</p>
                          <p className="text-xs text-[#737373]">Available</p>
                        </div>
                      </div>
                      <span className="text-sm text-[#E5E5E5]">{w.symbol}{w.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                    </div>
                  ))}
                </div>
              </div>
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
                <Link to="/trading" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">
                  Full Markets <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-8 h-8 border-2 border-[#0C8B44]/30 border-t-[#0C8B44] rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  {cryptoData.slice(0, 6).map((crypto) => {
                    const sparklinePrices = crypto.sparkline_in_7d?.price.slice(-20) || []
                    const isUp = crypto.price_change_percentage_24h >= 0
                    return (
                      <div key={crypto.id} className="p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {getCryptoLogo(crypto.id) ? (
                              <img src={getCryptoLogo(crypto.id)!} alt={crypto.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44] shrink-0">{crypto.symbol.toUpperCase()[0]}</div>
                            )}
                            <span className="text-xs font-medium text-[#E5E5E5] truncate">{crypto.symbol.toUpperCase()}</span>
                          </div>
                          {isUp ? <TrendingUp className="w-3 h-3 text-[#4CAF50] shrink-0" /> : <TrendingDown className="w-3 h-3 text-[#f44336] shrink-0" />}
                        </div>
                        <p className="text-base font-light text-[#E5E5E5] truncate">${crypto.current_price.toLocaleString()}</p>
                        <p className={`text-[11px] mt-0.5 truncate ${isUp ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                          {isUp ? '+' : ''}{crypto.price_change_percentage_24h.toFixed(2)}%
                        </p>
                        {/* SVG Sparkline */}
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
                      </div>
                    )
                  })}
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
