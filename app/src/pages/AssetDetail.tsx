import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import CandleChart from '../components/CandleChart'
import { marketData, type CryptoQuote, type OhlcRange } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { portfolioStore, type PortfolioHolding, type Trade } from '../lib/portfolioStore'
import { cryptoIconFor } from '../lib/cryptoIcon'
import { formatPrice } from '@/lib/utils'
import { Toaster, toast } from 'sonner'
import {
  ArrowLeft, Star, TrendingUp, TrendingDown,
  ArrowDownUp, Wallet, Activity, BarChart3,
} from 'lucide-react'

type Tab = 'buy' | 'sell' | 'swap'
const RANGES: OhlcRange[] = ['1H', '1D', '1W', '1M', '1Y']

const SWAP_TARGETS = ['USDC', 'USDT', 'BTC', 'ETH', 'SOL']

const fmtPrice = (n: number) =>
  n >= 1
    ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : n.toLocaleString('en-US', { maximumFractionDigits: 6 })

const fmtBig = (n: number) => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return formatPrice(n)
}

export default function AssetDetail() {
  const { id = 'bitcoin' } = useParams<{ id: string }>()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()

  const initialTab = (search.get('action') as Tab) || 'buy'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [range, setRange] = useState<OhlcRange>('1D')
  const [coin, setCoin] = useState<CryptoQuote | null>(null)
  const [livePrice, setLivePrice] = useState<number | null>(liveTicker.getPrice(id))
  const [amount, setAmount] = useState('')
  const [swapTo, setSwapTo] = useState('USDC')
  const [holding, setHolding] = useState<PortfolioHolding | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [watch, setWatch] = useState(false)

  // Sync URL ?action=buy|sell|swap with tab
  useEffect(() => {
    const next = new URLSearchParams(search)
    next.set('action', tab)
    setSearch(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Load coin data
  useEffect(() => {
    let alive = true
    ;(async () => {
      const list = await marketData.getCryptoPrice([id])
      if (!alive) return
      setCoin(list[0] ?? null)
    })()
    return () => { alive = false }
  }, [id])

  // Live price
  useEffect(() => {
    setLivePrice(liveTicker.getPrice(id))
    return liveTicker.subscribe(id, (p) => setLivePrice(p))
  }, [id])

  // Holding + recent trades for this asset
  useEffect(() => {
    const refresh = () => {
      const h = portfolioStore.getHoldings().find((x) => x.id === id) ?? null
      setHolding(h)
      const sym = (h?.symbol ?? coin?.symbol ?? id).toUpperCase()
      setTrades(portfolioStore.getTrades().filter((t) => t.symbol.toUpperCase() === sym).slice(0, 8))
    }
    refresh()
    const i = setInterval(refresh, 4000)
    return () => clearInterval(i)
  }, [id, coin?.symbol])

  // Watchlist toggle (localStorage)
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem('verdexis_watchlist') ?? '[]') as string[]
      setWatch(list.includes(id))
    } catch { /* ignore */ }
  }, [id])

  const toggleWatch = () => {
    try {
      const list = JSON.parse(localStorage.getItem('verdexis_watchlist') ?? '[]') as string[]
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
      localStorage.setItem('verdexis_watchlist', JSON.stringify(next))
      setWatch(next.includes(id))
      toast.success(next.includes(id) ? `Added ${coin?.symbol?.toUpperCase()} to watchlist` : `Removed from watchlist`)
    } catch { /* ignore */ }
  }

  const price = livePrice ?? coin?.current_price ?? 0
  const change = coin?.price_change_percentage_24h ?? 0
  const changePos = change >= 0
  const symbol = (coin?.symbol ?? id).toUpperCase()
  const name = coin?.name ?? id
  const logo = cryptoIconFor(id)

  const numAmount = Number(amount) || 0
  const total = numAmount * price

  const handleTrade = () => {
    if (!numAmount || numAmount <= 0) {
      toast.error('Enter an amount first')
      return
    }
    if (!coin) {
      toast.error('Market data not loaded')
      return
    }
    const isAuth = !!localStorage.getItem('verdexis_holdings') || !!localStorage.getItem('verdexis_token')
    if (!isAuth) {
      toast.error('Sign in to place real orders')
      return
    }
    if (tab === 'swap') {
      portfolioStore.executeTrade(symbol, name, 'sell', price, numAmount, 'market')
      toast.success(`Swapped ${numAmount} ${symbol} → ${swapTo} @ $${fmtPrice(price)}`)
    } else {
      portfolioStore.executeTrade(symbol, name, tab, price, numAmount, 'market')
      toast.success(`${tab === 'buy' ? 'Bought' : 'Sold'} ${numAmount} ${symbol} @ $${fmtPrice(price)}`)
    }
    setAmount('')
  }

  const setPercent = (pct: number) => {
    if (tab === 'sell' || tab === 'swap') {
      if (!holding) return
      setAmount(((holding.quantity * pct) / 100).toFixed(6))
    } else {
      // For buy, treat as % of $10k mock buying power
      const buyingPower = 10000
      setAmount(((buyingPower * pct) / 100 / (price || 1)).toFixed(6))
    }
  }

  const sideColor = useMemo(() => {
    if (tab === 'buy') return { bg: 'bg-[#4CAF50]', hover: 'hover:bg-[#3d8b40]', text: 'text-[#4CAF50]' }
    if (tab === 'sell') return { bg: 'bg-[#f44336]', hover: 'hover:bg-[#d32f2f]', text: 'text-[#f44336]' }
    return { bg: 'bg-[#2196F3]', hover: 'hover:bg-[#1976D2]', text: 'text-[#2196F3]' }
  }, [tab])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-20 pb-10 px-3 sm:px-6">
        <div className="max-w-[1280px] mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/trading'))}
              className="p-2 rounded-lg text-[#A0A0A0] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            {logo ? (
              <img src={logo} alt={symbol} className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-sm font-bold text-[#0C8B44]">
                {symbol[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-light text-[#E5E5E5] truncate">{name}</p>
              <p className="text-xs text-[#737373] uppercase tracking-wider">{symbol} · USD</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggleWatch}
                className={`p-2 rounded-lg border transition-colors ${
                  watch
                    ? 'border-[#0C8B44]/40 bg-[#0C8B44]/10 text-[#0C8B44]'
                    : 'border-[#ffffff10] text-[#737373] hover:text-[#0C8B44] hover:border-[#0C8B44]/30'
                }`}
                aria-label="Toggle watchlist"
              >
                <Star className={`w-4 h-4 ${watch ? 'fill-current' : ''}`} />
              </button>
              <Link
                to="/trading"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] border border-[#ffffff10] hover:border-[#0C8B44]/30 rounded-lg transition-colors"
              >
                <BarChart3 className="w-3 h-3" /> Pro Trading
              </Link>
            </div>
          </div>

          {/* Price strip */}
          <div className="flex items-baseline gap-3 mb-6 flex-wrap">
            <p className="text-3xl sm:text-4xl font-light text-[#E5E5E5] tabular-nums">
              ${fmtPrice(price)}
            </p>
            <p className={`text-sm font-medium flex items-center gap-1 ${changePos ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
              {changePos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {changePos ? '+' : ''}{change.toFixed(2)}%
            </p>
            <p className="text-xs text-[#737373]">24h</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart + stats column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card p-4">
                {/* Range tabs */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-1 p-1 bg-[#1a1a1a] rounded-lg">
                    {RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          range === r ? 'bg-[#0C8B44] text-white' : 'text-[#A0A0A0] hover:text-[#E5E5E5]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#737373]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
                    Live · auto-updating
                  </div>
                </div>
                <div className="h-[360px] sm:h-[440px]">
                  <CandleChart coinId={id} symbol={symbol} livePrice={livePrice ?? undefined} range={range} />
                </div>
              </div>

              {/* Stats grid */}
              <div className="glass-card p-4">
                <h3 className="text-xs uppercase tracking-wider text-[#737373] mb-3">Market Statistics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Market Cap" value={coin ? fmtBig(coin.market_cap) : '—'} />
                  <Stat label="24h Volume" value={coin ? fmtBig(coin.total_volume) : '—'} />
                  <Stat label="24h High" value={coin ? `$${fmtPrice(coin.high_24h)}` : '—'} />
                  <Stat label="24h Low" value={coin ? `$${fmtPrice(coin.low_24h)}` : '—'} />
                </div>
              </div>

              {/* Your position */}
              {holding && (
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider text-[#737373] flex items-center gap-2">
                      <Wallet className="w-3 h-3" /> Your Position
                    </h3>
                    <Link to="/wallet" className="text-xs text-[#0C8B44] hover:underline">View wallet →</Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat label="Holdings" value={`${holding.quantity.toLocaleString()} ${symbol}`} />
                    <Stat label="Value" value={`$${(holding.quantity * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                    <Stat label="Avg Buy" value={`$${fmtPrice(holding.avgBuyPrice)}`} />
                    <Stat
                      label="Unrealised P&L"
                      value={`${holding.pnl >= 0 ? '+' : ''}$${Math.abs(holding.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      tone={holding.pnl >= 0 ? 'pos' : 'neg'}
                    />
                  </div>
                </div>
              )}

              {/* Recent trades for this asset */}
              <div className="glass-card p-4">
                <h3 className="text-xs uppercase tracking-wider text-[#737373] mb-3 flex items-center gap-2">
                  <Activity className="w-3 h-3" /> Your Recent {symbol} Trades
                </h3>
                {trades.length === 0 ? (
                  <p className="text-sm text-[#737373] py-6 text-center">No {symbol} trades yet. Place your first order on the right.</p>
                ) : (
                  <div className="space-y-1">
                    {trades.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b border-[#ffffff05] last:border-0 text-sm">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${
                            t.side === 'buy' ? 'bg-[#4CAF50]/15 text-[#4CAF50]' : 'bg-[#f44336]/15 text-[#f44336]'
                          }`}>{t.side}</span>
                          <span className="text-[#E5E5E5] tabular-nums">{t.quantity} {symbol}</span>
                          <span className="text-[#737373]">@ ${fmtPrice(t.price)}</span>
                        </div>
                        <span className="text-xs text-[#737373]">
                          {new Date(t.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Buy / Sell / Swap panel */}
            <div className="lg:col-span-1">
              <div className="glass-card p-4 lg:sticky lg:top-24">
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#1a1a1a] rounded-lg mb-4">
                  {(['buy', 'sell', 'swap'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-3 py-2 text-sm font-medium rounded transition-colors capitalize ${
                        tab === t
                          ? t === 'buy' ? 'bg-[#4CAF50] text-white'
                            : t === 'sell' ? 'bg-[#f44336] text-white'
                            : 'bg-[#2196F3] text-white'
                          : 'text-[#A0A0A0] hover:text-[#E5E5E5]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <label className="block text-xs text-[#737373] mb-1.5">
                  {tab === 'buy' ? `Amount of ${symbol} to buy` : tab === 'sell' ? `Amount of ${symbol} to sell` : `Amount of ${symbol} to swap`}
                </label>
                <div className="relative mb-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 pr-16 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-[#E5E5E5] text-lg tabular-nums focus:outline-none focus:border-[#0C8B44] transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#737373] uppercase">{symbol}</span>
                </div>

                {/* Percent shortcuts */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {[25, 50, 75, 100].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPercent(p)}
                      className="py-1.5 text-[11px] text-[#A0A0A0] bg-[#1a1a1a] border border-[#ffffff08] rounded hover:border-[#0C8B44]/30 hover:text-[#0C8B44] transition-colors"
                    >
                      {p}%
                    </button>
                  ))}
                </div>

                {/* Swap target picker */}
                {tab === 'swap' && (
                  <div className="mb-3">
                    <label className="block text-xs text-[#737373] mb-1.5 flex items-center gap-1.5">
                      <ArrowDownUp className="w-3 h-3" /> Receive
                    </label>
                    <select
                      value={swapTo}
                      onChange={(e) => setSwapTo(e.target.value)}
                      title="Swap target asset"
                      aria-label="Swap target asset"
                      className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#2196F3]"
                    >
                      {SWAP_TARGETS.filter((s) => s !== symbol).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Total */}
                <div className="p-3 rounded-lg bg-[#1a1a1a]/50 mb-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Price</span>
                    <span className="text-[#E5E5E5] tabular-nums">${fmtPrice(price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">{tab === 'swap' ? 'Estimated received' : 'Total'}</span>
                    <span className="text-[#E5E5E5] tabular-nums">
                      {tab === 'swap'
                        ? `≈ ${(total).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${swapTo}`
                        : `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Network fee</span>
                    <span className="text-[#E5E5E5]">$0.00 (free)</span>
                  </div>
                </div>

                <button
                  onClick={handleTrade}
                  className={`w-full py-3 rounded-lg text-white text-sm font-medium uppercase tracking-wider transition-colors ${sideColor.bg} ${sideColor.hover}`}
                >
                  {tab === 'buy' ? `Buy ${symbol}` : tab === 'sell' ? `Sell ${symbol}` : `Swap to ${swapTo}`}
                </button>

                <p className="mt-3 text-[10px] text-[#737373] text-center">
                  Demo execution updates your portfolio locally. <Link to="/disclosures" className="underline hover:text-[#A0A0A0]">Risk disclosures</Link>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'text-[#4CAF50]' : tone === 'neg' ? 'text-[#f44336]' : 'text-[#E5E5E5]'
  return (
    <div>
      <p className="text-[11px] text-[#737373] uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium tabular-nums mt-1 ${color}`}>{value}</p>
    </div>
  )
}
