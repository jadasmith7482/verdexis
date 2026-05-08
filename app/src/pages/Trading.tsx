import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import CandleChart from '../components/CandleChart'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { portfolioStore } from '../lib/portfolioStore'
import WatchlistPanel from '../components/WatchlistPanel'
import { Toaster, toast } from 'sonner'
import {
  Search, Star, BarChart3, Clock, Layers,
} from 'lucide-react'
import { cryptoIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'
import { formatPrice } from '@/lib/utils'
import { api, getToken } from '../lib/api'

const getCryptoLogo = (id: string) => cryptoIconFor(id)

type OrderType = 'market' | 'limit' | 'stop'
type OrderSide = 'buy' | 'sell'
type TimeRange = '1H' | '1D' | '1W' | '1M' | '1Y'

interface Level { price: number; size: number }
interface PublicTrade { id: number; time: string; price: number; size: number; side: 'buy' | 'sell' }

export default function Trading() {
  const [cryptoData, setCryptoData] = useState<CryptoQuote[]>([])
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoQuote | null>(null)
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [orderSide, setOrderSide] = useState<OrderSide>('buy')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [timeRange, setTimeRange] = useState<TimeRange>('1D')
  const [watchlist, setWatchlist] = useState<string[]>(['bitcoin', 'ethereum', 'solana'])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [orderBookTab, setOrderBookTab] = useState<'orderbook' | 'trades' | 'depth'>('orderbook')
  const [recentTrades, setRecentTrades] = useState<PublicTrade[]>([])
  const [bookBids, setBookBids] = useState<Level[]>([])
  const [bookAsks, setBookAsks] = useState<Level[]>([])
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [, setPortfolioTick] = useState(0)
  const isAuthenticated = !!getToken()
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep-link: /trading?symbol=bitcoin (or btc) preselects that pair as soon
  // as the market list arrives. Strips the param after applying so the URL
  // stays clean if the user clicks around.
  useEffect(() => {
    const want = searchParams.get('symbol')
    if (!want || cryptoData.length === 0) return
    const lower = want.toLowerCase()
    const found = cryptoData.find(
      (c) => c.id.toLowerCase() === lower || c.symbol.toLowerCase() === lower,
    )
    if (found) {
      setSelectedCrypto(found)
      const next = new URLSearchParams(searchParams)
      next.delete('symbol')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, cryptoData, setSearchParams])

  // Hydrate holdings/wallet on mount + whenever the profile changes (login).
  useEffect(() => {
    void portfolioStore.hydrate(true).then(() => setPortfolioTick((t) => t + 1))
    const onProfile = () => { void portfolioStore.hydrate(true).then(() => setPortfolioTick((t) => t + 1)) }
    window.addEventListener('verdexis:profile', onProfile)
    return () => window.removeEventListener('verdexis:profile', onProfile)
  }, [])

  // Subscribe to sub-second Binance ticker for the currently selected coin so
  // the header price + chart + trade preview all tick smoothly.
  useEffect(() => {
    if (!selectedCrypto) { setLivePrice(null); return }
    setLivePrice(liveTicker.getPrice(selectedCrypto.id))
    return liveTicker.subscribe(selectedCrypto.id, (p) => setLivePrice(p))
  }, [selectedCrypto?.id])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const data = await marketData.getCryptoList()
    setCryptoData(data)
    if (data && data.length) {
      const quotes: Record<string, number> = {}
      for (const c of data) {
        quotes[c.id] = c.current_price
        if (c.symbol) quotes[c.symbol.toLowerCase()] = c.current_price
      }
      portfolioStore.markToMarket(quotes)
    }
    // Re-point selectedCrypto at the fresh quote object so livePrice ticks
    // through to the chart. Otherwise it stays frozen on the first snapshot.
    if (data.length > 0) {
      setSelectedCrypto((prev) => {
        if (!prev) return data[0]
        const fresh = data.find((c) => c.id === prev.id)
        return fresh ?? prev
      })
    }
    setRecentTrades(portfolioStore.getTrades().slice(0, 10) as unknown as PublicTrade[])
    setLoading(false)
  }

  // Fetch real order book + last public trades from Coinbase via our proxy.
  useEffect(() => {
    if (!selectedCrypto) return
    let cancelled = false
    const load = async () => {
      try {
        const [book, trades] = await Promise.all([
          api.marketOrderbook(selectedCrypto.id).catch(() => null),
          api.marketRecentTrades(selectedCrypto.id).catch(() => null),
        ])
        if (cancelled) return
        if (book) {
          setBookAsks(book.asks.slice(0, 12).reverse())
          setBookBids(book.bids.slice(0, 12))
        }
        if (trades) setRecentTrades(trades.trades.slice(0, 25))
      } catch { /* ignore — keep last good snapshot */ }
    }
    load()
    const id = setInterval(load, 4000)
    return () => { cancelled = true; clearInterval(id) }
  }, [selectedCrypto?.id])

  const filteredCryptos = cryptoData.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]))
  }

  const handleTrade = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to trade')
      return
    }
    if (!selectedCrypto || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (orderType !== 'market' && (!price || parseFloat(price) <= 0)) {
      toast.error('Please enter a valid price')
      return
    }
    const qty = parseFloat(amount)
    const tradePrice = orderType === 'market'
      ? (livePrice ?? selectedCrypto.current_price)
      : parseFloat(price || '0')

    // Limit/stop orders need to wait for the market to cross the trigger.
    // For now we treat them as 'good for the next tick': if the market is
    // already past the trigger we fill at the limit price; otherwise we
    // refuse and tell the user to use a market order or wait.
    if (orderType === 'limit' || orderType === 'stop') {
      const last = livePrice ?? selectedCrypto.current_price
      const triggered = orderSide === 'buy' ? last <= tradePrice : last >= tradePrice
      if (!triggered) {
        toast.error(`${orderType} order not eligible yet`, {
          description: `Market is at $${last.toFixed(2)} · trigger $${tradePrice.toFixed(2)}. Try a market order or wait for the price.`,
        })
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await api.postTrade({
        symbol: selectedCrypto.symbol.toUpperCase(),
        name: selectedCrypto.name,
        side: orderSide,
        amount: qty,
        price: tradePrice,
        type: 'crypto',
      })
      // Use the server's filled values (Alpaca / DB-confirmed) so the toast
      // matches the actual books, not the optimistic client estimate.
      const fillQty = result.trade.amount
      const fillPrice = result.trade.price
      toast.success(
        `${orderSide === 'buy' ? 'Bought' : 'Sold'} ${fillQty} ${selectedCrypto.symbol.toUpperCase()} at $${fillPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        {
          description: `Total: $${(fillPrice * fillQty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${result.broker ? ` · ${result.broker.venue}` : ''}`,
        },
      )
      // Pull fresh holdings + balances + trades so every panel agrees with
      // what the server just persisted (no drift on hard refresh).
      await portfolioStore.hydrate(true)
      setPortfolioTick((t) => t + 1)
      setRecentTrades(portfolioStore.getTrades().slice(0, 10) as unknown as PublicTrade[])
      setAmount('')
      setPrice('')
    } catch (e) {
      const err = e as { error?: string; status?: number }
      toast.error('Trade rejected', { description: err.error || 'Server error' })
    } finally {
      setSubmitting(false)
    }
  }

  // Real Coinbase order book on top, computed depth bars below. We bucket
  // bid/ask sizes into 20 bins each side relative to the mid price.
  const orderBook = useMemo(() => {
    const asks = bookAsks
    const bids = bookBids
    const mid = asks.length && bids.length
      ? (asks[asks.length - 1].price + bids[0].price) / 2
      : (selectedCrypto?.current_price ?? 0)
    // 40 buckets across ±1% of mid for a depth-style histogram.
    const buckets = Array.from({ length: 40 }, (_, i) => ({ isAsk: i > 20, height: 0 }))
    const range = mid * 0.01
    const fill = (levels: Level[], side: 'bid' | 'ask') => {
      for (const lvl of levels) {
        const offset = (lvl.price - mid) / range // -1..+1
        const bucketIdx = Math.round(offset * 20) + 20
        if (bucketIdx < 0 || bucketIdx >= 40) continue
        if (side === 'ask' && bucketIdx <= 20) continue
        if (side === 'bid' && bucketIdx >= 20) continue
        buckets[bucketIdx].height += lvl.size * lvl.price
      }
    }
    fill(asks, 'ask')
    fill(bids, 'bid')
    const max = Math.max(1, ...buckets.map((b) => b.height))
    const depthBars = buckets.map((b) => ({ isAsk: b.isAsk, height: Math.max(2, (b.height / max) * 100) }))
    return { asks, bids, depthBars }
  }, [bookAsks, bookBids, selectedCrypto?.current_price])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-20 pb-8">
        <div className="max-w-[1440px] mx-auto px-4">
          {/* Top Bar */}
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex items-center gap-6 px-4 py-3 glass-card">
              {selectedCrypto ? (
                <>
                  <div className="flex items-center gap-3">
                    {selectedCrypto && getCryptoLogo(selectedCrypto.id) ? (
                      <img
                        src={getCryptoLogo(selectedCrypto.id)!}
                        alt={selectedCrypto.name}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={cryptoIconErrorFallback(selectedCrypto.symbol.toUpperCase()[0] || '?', selectedCrypto.id)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-sm font-bold text-[#0C8B44]">
                        {selectedCrypto?.symbol.toUpperCase()[0]}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-[#E5E5E5]">
                        {selectedCrypto.symbol.toUpperCase()}/USD
                      </p>
                      <p className="text-xs text-[#737373]">{selectedCrypto.name}</p>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-[#ffffff10]" />
                  <p className="text-xl font-light text-[#E5E5E5] tabular-nums">
                    ${(livePrice ?? selectedCrypto.current_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className={`text-sm ${selectedCrypto.price_change_percentage_24h >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                    {selectedCrypto.price_change_percentage_24h >= 0 ? '+' : ''}
                    {selectedCrypto.price_change_percentage_24h.toFixed(2)}%
                  </div>
                  <button
                    onClick={() => toggleWatchlist(selectedCrypto.id)}
                    className={`p-2 rounded-lg transition-colors ${watchlist.includes(selectedCrypto.id) ? 'text-[#F57C00]' : 'text-[#737373] hover:text-[#F57C00]'}`}>
                    <Star className="w-4 h-4" fill={watchlist.includes(selectedCrypto.id) ? '#F57C00' : 'none'} />
                  </button>
                </>
              ) : (
                <p className="text-[#737373]">Select a trading pair</p>
              )}
            </div>
            <div className="flex items-center gap-1 px-2 py-3 glass-card">
              {(['1H', '1D', '1W', '1M', '1Y'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${timeRange === range ? 'bg-[#0C8B44] text-white' : 'text-[#737373] hover:text-[#E5E5E5]'}`}>
                  {range}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#737373]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0C8B44] animate-pulse" />
              {loading ? 'Updating…' : 'Live'}
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Sidebar */}
            <div className="lg:col-span-3 glass-card overflow-hidden">
              <div className="p-4 border-b border-[#ffffff08]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search markets..."
                    className="w-full pl-9 pr-4 py-2 bg-[#1a1a1a] border border-[#ffffff08] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                </div>
              </div>
              <div className="divide-y divide-[#ffffff05] max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide">
                {filteredCryptos.map((crypto) => (
                  <div key={crypto.id} className={`w-full flex items-stretch ${selectedCrypto?.id === crypto.id ? 'bg-[#0C8B44]/10' : 'hover:bg-[#ffffff05]'} transition-colors`}>
                    <button onClick={() => setSelectedCrypto(crypto)} className="flex-1 flex items-center justify-between p-4 text-left">
                    <div className="flex items-center gap-3">
                      {getCryptoLogo(crypto.id) ? (
                        <img
                          src={getCryptoLogo(crypto.id)!}
                          alt={crypto.name}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={cryptoIconErrorFallback(crypto.symbol.toUpperCase()[0] || '?', crypto.id)}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{crypto.symbol.toUpperCase()[0]}</div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium text-[#E5E5E5]">{crypto.symbol.toUpperCase()}</p>
                        <p className="text-xs text-[#737373]">{crypto.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#E5E5E5]">{formatPrice(crypto.current_price)}</p>
                      <p className={`text-xs ${crypto.price_change_percentage_24h >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                        {crypto.price_change_percentage_24h >= 0 ? '+' : ''}{crypto.price_change_percentage_24h.toFixed(2)}%
                      </p>
                    </div>
                  </button>
                    <Link
                      to={`/asset/${crypto.id}`}
                      title={`Open ${crypto.name} detail`}
                      className="px-3 flex items-center text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10 border-l border-[#ffffff05] transition-colors"
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Center - Chart */}
            <div className="lg:col-span-6 space-y-4">
              <div className="glass-card p-4">
                {selectedCrypto ? (
                  <CandleChart
                    coinId={selectedCrypto.id}
                    symbol={selectedCrypto.symbol}
                    livePrice={livePrice ?? selectedCrypto.current_price}
                    range={timeRange}
                  />
                ) : (
                  <div className="h-80 flex items-center justify-center text-xs text-[#737373]">Select a market to view chart</div>
                )}
                <div className="flex justify-between mt-2 text-xs text-[#737373]">
                  <span>24h Low: ${selectedCrypto?.low_24h?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</span>
                  <span>24h High: ${selectedCrypto?.high_24h?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</span>
                  <span>Vol: ${selectedCrypto ? (selectedCrypto.total_volume / 1_000_000).toFixed(1) + 'M' : '—'}</span>
                </div>
              </div>

              {/* Order Book */}
              <div className="glass-card overflow-hidden">
                <div className="flex items-center gap-1 p-4 border-b border-[#ffffff08]">
                  {[{ key: 'orderbook' as const, label: 'Order Book', icon: Layers }, { key: 'trades' as const, label: 'Recent Trades', icon: Clock }, { key: 'depth' as const, label: 'Depth', icon: BarChart3 }].map((tab) => (
                    <button key={tab.key} onClick={() => setOrderBookTab(tab.key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${orderBookTab === tab.key ? 'bg-[#0C8B44]/20 text-[#0C8B44]' : 'text-[#737373] hover:text-[#E5E5E5]'}`}>
                      <tab.icon className="w-4 h-4" />{tab.label}
                    </button>
                  ))}
                </div>

                {orderBookTab === 'orderbook' && (
                  <div className="grid grid-cols-2 divide-x divide-[#ffffff08]">
                    <div className="p-4">
                      <p className="text-xs text-[#f44336] mb-2 font-medium">Asks (Sell)</p>
                      <div className="space-y-1">
                        {orderBook.asks.map((ask, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-[#f44336]">${ask.price.toFixed(2)}</span>
                            <span className="text-[#A0A0A0]">{ask.size.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-[#4CAF50] mb-2 font-medium">Bids (Buy)</p>
                      <div className="space-y-1">
                        {orderBook.bids.map((bid, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-[#4CAF50]">${bid.price.toFixed(2)}</span>
                            <span className="text-[#A0A0A0]">{bid.size.toFixed(4)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {orderBookTab === 'trades' && (
                  <div className="p-4">
                    <div className="grid grid-cols-4 text-xs text-[#737373] mb-2">
                      <span>Time</span><span>Price</span><span>Size</span><span>Side</span>
                    </div>
                    {recentTrades.length === 0 ? (
                      <p className="text-xs text-[#737373] py-6 text-center">Loading recent trades…</p>
                    ) : recentTrades.map((trade) => (
                      <div key={trade.id} className="grid grid-cols-4 text-xs py-1">
                        <span className="text-[#A0A0A0]">{new Date(trade.time).toLocaleTimeString()}</span>
                        <span className="text-[#E5E5E5] tabular-nums">${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-[#A0A0A0] tabular-nums">{trade.size.toFixed(4)}</span>
                        <span className={trade.side === 'buy' ? 'text-[#4CAF50]' : 'text-[#f44336]'}>{trade.side.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {orderBookTab === 'depth' && (
                  <div className="p-4 h-64 flex items-end gap-1">
                    {orderBook.depthBars.map((b, i) => (
                      <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${b.height}%`, background: b.isAsk ? 'rgba(244,67,54,0.4)' : 'rgba(76,175,80,0.4)' }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Order Form */}
            <div className="lg:col-span-3 glass-card p-4">
              <div className="flex gap-1 p-1 bg-[#1a1a1a] rounded-lg mb-4">
                <button onClick={() => setOrderSide('buy')} className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${orderSide === 'buy' ? 'bg-[#0C8B44] text-white' : 'text-[#737373] hover:text-[#E5E5E5]'}`}>Buy</button>
                <button onClick={() => setOrderSide('sell')} className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${orderSide === 'sell' ? 'bg-[#f44336] text-white' : 'text-[#737373] hover:text-[#E5E5E5]'}`}>Sell</button>
              </div>

              <div className="flex gap-1 mb-4">
                {(['market', 'limit', 'stop'] as OrderType[]).map((type) => (
                  <button key={type} onClick={() => setOrderType(type)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${orderType === type ? 'bg-[#0C8B44]/20 text-[#0C8B44] border border-[#0C8B44]/30' : 'text-[#737373] hover:text-[#E5E5E5] border border-transparent'}`}>
                    {type}
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className="text-xs text-[#737373] mb-1.5 block">Amount ({selectedCrypto?.symbol.toUpperCase() || 'BTC'})</label>
                <div className="relative">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                </div>
              </div>

              {(orderType === 'limit' || orderType === 'stop') && (
                <div className="mb-4">
                  <label className="text-xs text-[#737373] mb-1.5 block">Price (USD)</label>
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={selectedCrypto?.current_price.toString()}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                </div>
              )}

              <div className="flex items-center justify-between py-3 border-t border-[#ffffff08] mb-4">
                <span className="text-sm text-[#A0A0A0]">Total</span>
                <span className="text-lg font-medium text-[#E5E5E5]">
                  ${amount ? (parseFloat(amount) * (orderType === 'market' ? (selectedCrypto?.current_price || 0) : parseFloat(price || '0'))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>

              <button onClick={handleTrade} disabled={submitting}
                className={`w-full py-3.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${orderSide === 'buy' ? 'bg-[#0C8B44] text-white hover:bg-[#0a7539]' : 'bg-[#f44336] text-white hover:bg-[#d32f2f]'}`}>
                {submitting ? 'Submitting…' : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${selectedCrypto?.symbol.toUpperCase() || 'BTC'}`}
              </button>

              <Link to="/alerts" className="mt-2 block text-center text-[11px] text-[#737373] hover:text-[#0C8B44] transition-colors">
                Set price alert →
              </Link>

              {isAuthenticated ? (
                <div className="mt-4 p-4 rounded-xl bg-[#1a1a1a]/50">
                  <p className="text-xs text-[#737373] mb-1">Available Balance</p>
                  <p className="text-sm text-[#E5E5E5]">${(portfolioStore.getWallet().find(w => w.currency === 'USD')?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</p>
                  {(() => {
                    const sym = selectedCrypto?.symbol.toUpperCase() || 'BTC'
                    const held = portfolioStore.getHoldings().find((h) => h.symbol.toUpperCase() === sym)?.quantity ?? 0
                    return <p className="text-xs text-[#737373] mt-1">{sym}: {held.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}</p>
                  })()}
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#0C8B44]/20">
                  <p className="text-xs text-[#737373] mb-2">Sign in to view your balance and trade</p>
                  <button className="w-full py-2 rounded-lg bg-[#0C8B44]/20 text-[#0C8B44] text-xs font-medium hover:bg-[#0C8B44]/30 transition-colors">Log In to Trade</button>
                </div>
              )}
            </div>

            {isAuthenticated && (
              <div className="mt-6">
                <WatchlistPanel
                  availableSymbols={cryptoData.map((c) => ({ symbol: c.symbol, name: c.name }))}
                  onSelect={(s) => {
                    const found = cryptoData.find((c) => c.symbol.toUpperCase() === s.toUpperCase())
                    if (found) setSelectedCrypto(found)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
