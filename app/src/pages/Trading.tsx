import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import CandleChart from '../components/CandleChart'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { portfolioStore } from '../lib/portfolioStore'
import WatchlistPanel from '../components/WatchlistPanel'
import { Toaster, toast } from 'sonner'
import {
  Search, Star, RefreshCw, BarChart3, Clock, Layers,
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

type OrderType = 'market' | 'limit' | 'stop'
type OrderSide = 'buy' | 'sell'
type TimeRange = '1H' | '1D' | '1W' | '1M' | '1Y'

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
  const [recentTrades, setRecentTrades] = useState(portfolioStore.getTrades().slice(0, 10))
  const isAuthenticated = !!localStorage.getItem('verdexis_holdings')

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
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
    setRecentTrades(portfolioStore.getTrades().slice(0, 10))
    setLoading(false)
  }

  const filteredCryptos = cryptoData.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleWatchlist = (id: string) => {
    setWatchlist((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]))
  }

  const handleTrade = () => {
    if (!isAuthenticated) {
      toast.error('Please log in to trade')
      return
    }
    if (!selectedCrypto || !amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const qty = parseFloat(amount)
    const tradePrice = orderType === 'market' ? selectedCrypto.current_price : parseFloat(price || '0')

    if (orderType !== 'market' && (!price || parseFloat(price) <= 0)) {
      toast.error('Please enter a valid price')
      return
    }

    portfolioStore.executeTrade(
      selectedCrypto.symbol.toUpperCase(),
      selectedCrypto.name,
      orderSide,
      tradePrice,
      qty,
      orderType
    )

    toast.success(
      `${orderSide === 'buy' ? 'Bought' : 'Sold'} ${qty} ${selectedCrypto.symbol.toUpperCase()} at $${tradePrice.toLocaleString()}`,
      { description: `Total: $${(tradePrice * qty).toLocaleString()}` }
    )

    setAmount('')
    setPrice('')
    setRecentTrades(portfolioStore.getTrades().slice(0, 10))
  }

  // Deterministic order book derived from the current symbol+price so it doesn't
  // re-roll on every render. Re-derives only when the price ticks.
  const orderBook = useMemo(() => {
    const currentPrice = selectedCrypto?.current_price || 50000
    const seedSrc = `${selectedCrypto?.id ?? 'x'}_${currentPrice.toFixed(2)}`
    let rng = [...seedSrc].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 11) || 1
    const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 0xffffffff }
    const asks = Array.from({ length: 10 }, (_, i) => ({
      price: currentPrice + (10 - i) * (currentPrice * 0.0005),
      size: rand() * 10 + 0.1,
    })).reverse()
    const bids = Array.from({ length: 10 }, (_, i) => ({
      price: currentPrice - (i + 1) * (currentPrice * 0.0005),
      size: rand() * 10 + 0.1,
    }))
    return { asks, bids }
  }, [selectedCrypto?.id, selectedCrypto?.current_price])

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
                      <img src={getCryptoLogo(selectedCrypto.id)!} alt={selectedCrypto.name} className="w-10 h-10 rounded-full object-cover" />
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
                  <p className="text-xl font-light text-[#E5E5E5]">
                    ${selectedCrypto.current_price.toLocaleString()}
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
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-3 glass-card text-sm text-[#A0A0A0] hover:text-[#0C8B44] transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
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
                  <button key={crypto.id} onClick={() => setSelectedCrypto(crypto)}
                    className={`w-full flex items-center justify-between p-4 hover:bg-[#ffffff05] transition-colors ${selectedCrypto?.id === crypto.id ? 'bg-[#0C8B44]/10' : ''}`}>
                    <div className="flex items-center gap-3">
                      {getCryptoLogo(crypto.id) ? (
                        <img src={getCryptoLogo(crypto.id)!} alt={crypto.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{crypto.symbol.toUpperCase()[0]}</div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-medium text-[#E5E5E5]">{crypto.symbol.toUpperCase()}</p>
                        <p className="text-xs text-[#737373]">{crypto.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#E5E5E5]">${crypto.current_price.toLocaleString()}</p>
                      <p className={`text-xs ${crypto.price_change_percentage_24h >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                        {crypto.price_change_percentage_24h >= 0 ? '+' : ''}{crypto.price_change_percentage_24h.toFixed(2)}%
                      </p>
                    </div>
                  </button>
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
                    livePrice={selectedCrypto.current_price}
                    range={timeRange}
                  />
                ) : (
                  <div className="h-80 flex items-center justify-center text-xs text-[#737373]">Select a market to view chart</div>
                )}
                <div className="flex justify-between mt-2 text-xs text-[#737373]">
                  <span>24h Low: ${selectedCrypto?.low_24h?.toLocaleString() ?? '—'}</span>
                  <span>24h High: ${selectedCrypto?.high_24h?.toLocaleString() ?? '—'}</span>
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
                      <span>Time</span><span>Symbol</span><span>Amount</span><span>Side</span>
                    </div>
                    {recentTrades.map((trade) => (
                      <div key={trade.id} className="grid grid-cols-4 text-xs py-1">
                        <span className="text-[#A0A0A0]">{new Date(trade.timestamp).toLocaleTimeString()}</span>
                        <span className="text-[#E5E5E5]">{trade.symbol}</span>
                        <span className="text-[#A0A0A0]">{trade.quantity.toFixed(4)}</span>
                        <span className={trade.side === 'buy' ? 'text-[#4CAF50]' : 'text-[#f44336]'}>{trade.side.toUpperCase()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {orderBookTab === 'depth' && (
                  <div className="p-4 h-64 flex items-end gap-1">
                    {Array.from({ length: 40 }, (_, i) => {
                      const isAsk = i > 20
                      const height = isAsk ? Math.random() * 80 * ((i - 20) / 20) : Math.random() * 80 * ((20 - i) / 20)
                      return <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(5, height)}%`, background: isAsk ? 'rgba(244,67,54,0.4)' : 'rgba(76,175,80,0.4)' }} />
                    })}
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
                  ${amount ? (parseFloat(amount) * (orderType === 'market' ? (selectedCrypto?.current_price || 0) : parseFloat(price || '0'))).toLocaleString() : '0.00'}
                </span>
              </div>

              <button onClick={handleTrade}
                className={`w-full py-3.5 rounded-xl text-sm font-medium transition-colors ${orderSide === 'buy' ? 'bg-[#0C8B44] text-white hover:bg-[#0a7539]' : 'bg-[#f44336] text-white hover:bg-[#d32f2f]'}`}>
                {orderSide === 'buy' ? 'Buy' : 'Sell'} {selectedCrypto?.symbol.toUpperCase() || 'BTC'}
              </button>

              <Link to="/alerts" className="mt-2 block text-center text-[11px] text-[#737373] hover:text-[#0C8B44] transition-colors">
                Set price alert →
              </Link>

              {isAuthenticated ? (
                <div className="mt-4 p-4 rounded-xl bg-[#1a1a1a]/50">
                  <p className="text-xs text-[#737373] mb-1">Available Balance</p>
                  <p className="text-sm text-[#E5E5E5]">${portfolioStore.getWallet().find(w => w.currency === 'USD')?.balance.toLocaleString() || '0.00'} USD</p>
                  <p className="text-xs text-[#737373] mt-1">{selectedCrypto?.symbol.toUpperCase() || 'BTC'}: {portfolioStore.getWallet().find(w => w.currency === selectedCrypto?.symbol.toUpperCase())?.balance.toFixed(4) || '0.0000'}</p>
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
