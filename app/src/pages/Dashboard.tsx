import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import AuthModal from '../components/AuthModal'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { aiService, type AIInsight } from '../lib/aiService'
import { portfolioStore, type PortfolioHolding, type Trade, type WalletBalance, type WalletTransaction } from '../lib/portfolioStore'
import { Toaster } from 'sonner'
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  BrainCircuit, Zap, Sparkles, AlertTriangle, BarChart3,
  PieChart, Activity, ChevronRight, RefreshCw, Lock,
  ArrowRight, CircleDollarSign, Gem, Layers,
} from 'lucide-react'

const cryptoLogos: Record<string, string> = {
  bitcoin: '/assets/logo-btc.png',
  ethereum: '/assets/logo-eth.png',
  solana: '/assets/logo-sol.png',
  cardano: '/assets/logo-ada.png',
  ripple: '/assets/logo-xrp.png',
  binancecoin: '/assets/logo-bnb.png',
  dogecoin: '/assets/logo-doge.png',
  tron: '/assets/logo-trx.png',
  tether: '/assets/logo-usdt.png',
  'usd-coin': '/assets/logo-usdc.png',
  polkadot: '/assets/logo-dot.png',
  chainlink: '/assets/logo-link.png',
  avalanche: '/assets/logo-avax.png',
  // Symbol aliases
  btc: '/assets/logo-btc.png',
  eth: '/assets/logo-eth.png',
  sol: '/assets/logo-sol.png',
  ada: '/assets/logo-ada.png',
  xrp: '/assets/logo-xrp.png',
  bnb: '/assets/logo-bnb.png',
  doge: '/assets/logo-doge.png',
  trx: '/assets/logo-trx.png',
  usdt: '/assets/logo-usdt.png',
  usdc: '/assets/logo-usdc.png',
  dot: '/assets/logo-dot.png',
  link: '/assets/logo-link.png',
  avax: '/assets/logo-avax.png',
}

const getCryptoLogo = (id: string) => cryptoLogos[id] || null

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

  const fetchData = async () => {
    setLoading(true)
    const [crypto, aiInsights] = await Promise.all([
      marketData.getCryptoList(),
      aiService.getPortfolioInsights(),
    ])
    setCryptoData(crypto)
    setInsights(aiInsights)
    setHoldings(portfolioStore.getHoldings())
    setTrades(portfolioStore.getTrades().slice(0, 5))
    setWallet(portfolioStore.getWallet())
    setTransactions(portfolioStore.getTransactions().slice(0, 5))
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  // Portfolio calculations
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0)
  const dayChangePercent = totalValue > 0 ? (totalPnl / totalValue) * 100 : 0
  const bestPerformer = holdings.length > 0
    ? holdings.reduce((best, h) => (h.pnlPercent > best.pnlPercent ? h : best), holdings[0])
    : null

  // Generate portfolio area chart data (simulated 30 days)
  const portfolioHistory = Array.from({ length: 30 }, (_, i) => {
    const base = totalValue * 0.85
    const growth = (totalValue - base) * (i / 29)
    const noise = Math.sin(i * 0.5) * totalValue * 0.03
    return base + growth + noise
  })
  const chartMax = Math.max(...portfolioHistory)
  const chartMin = Math.min(...portfolioHistory)
  const chartRange = chartMax - chartMin || 1
  const chartPath = portfolioHistory
    .map((v, i) => {
      const x = (i / 29) * 100
      const y = 100 - ((v - chartMin) / chartRange) * 90 - 5
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const areaPath = chartPath + ` L100,100 L0,100 Z`

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
              <p className="text-sm text-[#737373] mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
            </div>
            <button onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff08] text-sm text-[#A0A0A0] hover:text-[#0C8B44] hover:border-[#0C8B44]/30 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {/* Top Stats Row */}
          {isAuthenticated && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Net Worth', value: `$${totalValue.toLocaleString()}`, change: `${dayChangePercent >= 0 ? '+' : ''}${dayChangePercent.toFixed(2)}%`, positive: dayChangePercent >= 0, icon: CircleDollarSign },
                { label: 'Unrealized P&L', value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString()}`, change: 'All-time across holdings', positive: totalPnl >= 0, icon: TrendingUp },
                { label: 'Best Performer', value: bestPerformer ? `${bestPerformer.pnlPercent >= 0 ? '+' : ''}${bestPerformer.pnlPercent.toFixed(1)}%` : 'N/A', change: bestPerformer ? bestPerformer.symbol : '', positive: (bestPerformer?.pnlPercent || 0) >= 0, icon: Gem },
                { label: 'Total Holdings', value: `${holdings.length}`, change: `${holdings.filter(h => h.id !== 'usd').length} assets`, positive: true, icon: Layers },
              ].map((stat) => (
                <div key={stat.label} className="p-5 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center">
                      <stat.icon className="w-4 h-4 text-[#0C8B44]" />
                    </div>
                    <span className="text-xs text-[#737373]">{stat.label}</span>
                  </div>
                  <p className="text-xl font-light text-[#E5E5E5] tracking-[-0.02em]">{stat.value}</p>
                  <p className={`text-xs mt-1 ${stat.positive ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{stat.change}</p>
                </div>
              ))}
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
                    <p className={`text-sm flex items-center gap-1 ${dayChangePercent >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                      {dayChangePercent >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {dayChangePercent >= 0 ? '+' : ''}{dayChangePercent.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>

              {isAuthenticated ? (
                <>
                  <p className="text-5xl md:text-6xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">
                    ${totalValue.toLocaleString()}
                  </p>
                  {/* SVG Area Chart */}
                  <div className="h-48 w-full">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0C8B44" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#0C8B44" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={areaPath} fill="url(#areaGradient)" />
                      <path d={chartPath} fill="none" stroke="#0C8B44" strokeWidth="0.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#737373] mt-2">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
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
                      <div key={h.id} className="flex items-center justify-between py-2">
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
                          <p className="text-sm text-[#E5E5E5]">${h.value.toLocaleString()}</p>
                          <p className={`text-xs ${h.pnl >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                            {h.pnl >= 0 ? '+' : ''}${h.pnl.toLocaleString()} ({h.pnlPercent.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
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
                      <span className="text-sm text-[#E5E5E5]">{w.symbol}{w.balance.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {transactions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#ffffff08]">
                    <h4 className="text-xs font-medium text-[#737373] mb-2">Recent Activity</h4>
                    {transactions.slice(0, 3).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] ${tx.type === 'deposit' ? 'bg-[#4CAF50]/20 text-[#4CAF50]' : tx.type === 'withdraw' ? 'bg-[#f44336]/20 text-[#f44336]' : 'bg-[#FF9800]/20 text-[#FF9800]'}`}>
                            {tx.type === 'deposit' ? '↓' : tx.type === 'withdraw' ? '↑' : '↔'}
                          </div>
                          <span className="text-xs text-[#A0A0A0]">{tx.description}</span>
                        </div>
                        <span className={`text-xs ${tx.amount >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} {tx.currency}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {cryptoData.slice(0, 6).map((crypto) => {
                    const sparklinePrices = crypto.sparkline_in_7d?.price.slice(-20) || []
                    const isUp = crypto.price_change_percentage_24h >= 0
                    return (
                      <div key={crypto.id} className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getCryptoLogo(crypto.id) ? (
                              <img src={getCryptoLogo(crypto.id)!} alt={crypto.name} className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-[10px] font-bold text-[#0C8B44]">{crypto.symbol.toUpperCase()[0]}</div>
                            )}
                            <span className="text-sm font-medium text-[#E5E5E5]">{crypto.symbol.toUpperCase()}</span>
                          </div>
                          {isUp ? <TrendingUp className="w-3.5 h-3.5 text-[#4CAF50]" /> : <TrendingDown className="w-3.5 h-3.5 text-[#f44336]" />}
                        </div>
                        <p className="text-lg font-light text-[#E5E5E5]">${crypto.current_price.toLocaleString()}</p>
                        <p className={`text-xs mt-0.5 ${isUp ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                          {isUp ? '+' : ''}{crypto.price_change_percentage_24h.toFixed(2)}%
                        </p>
                        {/* SVG Sparkline */}
                        {sparklinePrices.length > 0 && (
                          <div className="mt-2 h-8">
                            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full overflow-visible">
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
    </div>
  )
}
