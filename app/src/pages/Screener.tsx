import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal, Search } from 'lucide-react'
import Navigation from '../components/Navigation'

interface Coin {
  symbol: string
  name: string
  price: number
  change24h: number
  change7d: number
  marketCap: number
  volume: number
  rsi: number
  macd: 'bullish' | 'bearish' | 'neutral'
  category: string
}

const COINS: Coin[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 62450, change24h: 2.3, change7d: 5.1, marketCap: 1_230_000_000_000, volume: 38_000_000_000, rsi: 62, macd: 'bullish', category: 'Layer 1' },
  { symbol: 'ETH', name: 'Ethereum', price: 3280, change24h: 1.8, change7d: 3.2, marketCap: 394_000_000_000, volume: 18_000_000_000, rsi: 58, macd: 'bullish', category: 'Layer 1' },
  { symbol: 'SOL', name: 'Solana', price: 178, change24h: -0.9, change7d: 8.4, marketCap: 82_000_000_000, volume: 4_200_000_000, rsi: 71, macd: 'neutral', category: 'Layer 1' },
  { symbol: 'BNB', name: 'BNB', price: 590, change24h: 0.5, change7d: 2.1, marketCap: 85_000_000_000, volume: 1_900_000_000, rsi: 55, macd: 'neutral', category: 'Layer 1' },
  { symbol: 'XRP', name: 'XRP', price: 0.54, change24h: 3.1, change7d: -1.2, marketCap: 30_000_000_000, volume: 1_400_000_000, rsi: 48, macd: 'bearish', category: 'Payments' },
  { symbol: 'ADA', name: 'Cardano', price: 0.44, change24h: -1.2, change7d: -3.8, marketCap: 15_000_000_000, volume: 420_000_000, rsi: 34, macd: 'bearish', category: 'Layer 1' },
  { symbol: 'AVAX', name: 'Avalanche', price: 38.2, change24h: -2.1, change7d: 1.4, marketCap: 16_000_000_000, volume: 680_000_000, rsi: 42, macd: 'bearish', category: 'Layer 1' },
  { symbol: 'DOT', name: 'Polkadot', price: 7.8, change24h: 0.3, change7d: 2.9, marketCap: 11_000_000_000, volume: 340_000_000, rsi: 51, macd: 'neutral', category: 'Layer 0' },
  { symbol: 'LINK', name: 'Chainlink', price: 14.2, change24h: 4.2, change7d: 11.3, marketCap: 8_400_000_000, volume: 610_000_000, rsi: 73, macd: 'bullish', category: 'Oracle' },
  { symbol: 'UNI', name: 'Uniswap', price: 9.8, change24h: 1.1, change7d: 4.5, marketCap: 5_900_000_000, volume: 210_000_000, rsi: 59, macd: 'bullish', category: 'DeFi' },
  { symbol: 'AAVE', name: 'Aave', price: 118, change24h: -0.4, change7d: 6.2, marketCap: 1_700_000_000, volume: 180_000_000, rsi: 61, macd: 'neutral', category: 'DeFi' },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.165, change24h: 5.4, change7d: 12.1, marketCap: 24_000_000_000, volume: 2_100_000_000, rsi: 78, macd: 'bullish', category: 'Meme' },
  { symbol: 'SHIB', name: 'Shiba Inu', price: 0.0000248, change24h: 3.8, change7d: 8.7, marketCap: 14_600_000_000, volume: 870_000_000, rsi: 69, macd: 'bullish', category: 'Meme' },
  { symbol: 'MATIC', name: 'Polygon', price: 0.89, change24h: -1.8, change7d: -4.2, marketCap: 8_200_000_000, volume: 520_000_000, rsi: 38, macd: 'bearish', category: 'Layer 2' },
  { symbol: 'ARB', name: 'Arbitrum', price: 1.12, change24h: 2.7, change7d: 9.3, marketCap: 4_500_000_000, volume: 380_000_000, rsi: 65, macd: 'bullish', category: 'Layer 2' },
  { symbol: 'OP', name: 'Optimism', price: 2.34, change24h: 1.9, change7d: 7.1, marketCap: 3_100_000_000, volume: 290_000_000, rsi: 62, macd: 'bullish', category: 'Layer 2' },
  { symbol: 'FIL', name: 'Filecoin', price: 5.9, change24h: -3.1, change7d: -8.4, marketCap: 3_200_000_000, volume: 240_000_000, rsi: 29, macd: 'bearish', category: 'Storage' },
  { symbol: 'INJ', name: 'Injective', price: 28.4, change24h: 6.2, change7d: 18.5, marketCap: 2_700_000_000, volume: 430_000_000, rsi: 81, macd: 'bullish', category: 'DeFi' },
  { symbol: 'TAO', name: 'Bittensor', price: 480, change24h: 4.5, change7d: 14.2, marketCap: 3_800_000_000, volume: 210_000_000, rsi: 74, macd: 'bullish', category: 'AI' },
  { symbol: 'FET', name: 'Fetch.ai', price: 2.1, change24h: 3.3, change7d: 22.1, marketCap: 1_900_000_000, volume: 380_000_000, rsi: 82, macd: 'bullish', category: 'AI' },
]

const CATEGORIES = ['All', 'Layer 1', 'Layer 2', 'DeFi', 'AI', 'Meme', 'Oracle', 'Payments', 'Storage', 'Layer 0']

function fmt(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

export default function Screener() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [rsiMin, setRsiMin] = useState('')
  const [rsiMax, setRsiMax] = useState('')
  const [macdFilter, setMacdFilter] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all')
  const [changeFilter, setChangeFilter] = useState<'all' | 'gaining' | 'losing'>('all')
  const [sortBy, setSortBy] = useState<keyof Coin>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sort = (col: keyof Coin) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const filtered = COINS.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.symbol.toLowerCase().includes(search.toLowerCase())) return false
    if (category !== 'All' && c.category !== category) return false
    if (rsiMin && c.rsi < parseFloat(rsiMin)) return false
    if (rsiMax && c.rsi > parseFloat(rsiMax)) return false
    if (macdFilter !== 'all' && c.macd !== macdFilter) return false
    if (changeFilter === 'gaining' && c.change24h <= 0) return false
    if (changeFilter === 'losing' && c.change24h >= 0) return false
    return true
  }).sort((a, b) => {
    const va = a[sortBy] as number
    const vb = b[sortBy] as number
    return sortDir === 'asc' ? va - vb : vb - va
  })

  const SortBtn = ({ col, label }: { col: keyof Coin; label: string }) => (
    <th className="pb-3 pr-4 font-medium cursor-pointer hover:text-[#E5E5E5] transition-colors whitespace-nowrap" onClick={() => sort(col)}>
      {label} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <Link to="/markets" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to markets
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Asset Screener</h1>
              <p className="text-xs text-[#737373]">Filter by technicals, category, momentum & more.</p>
            </div>
            <div className="ml-auto text-xs text-[#737373]">{filtered.length} results</div>
          </div>

          {/* Filters */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#737373]" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="BTC, Ethereum…" className="w-full pl-8 pr-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Category</label>
                <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">RSI Range</label>
                <div className="flex gap-2">
                  <input type="number" value={rsiMin} onChange={e => setRsiMin(e.target.value)} placeholder="Min" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                  <input type="number" value={rsiMax} onChange={e => setRsiMax(e.target.value)} placeholder="Max" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">MACD</label>
                  <select aria-label="MACD" value={macdFilter} onChange={e => setMacdFilter(e.target.value as typeof macdFilter)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    <option value="all">All</option>
                    <option value="bullish">Bullish</option>
                    <option value="bearish">Bearish</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">24h Move</label>
                  <select aria-label="24h Move" value={changeFilter} onChange={e => setChangeFilter(e.target.value as typeof changeFilter)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    <option value="all">All</option>
                    <option value="gaining">Gaining</option>
                    <option value="losing">Losing</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#737373] text-left border-b border-[#ffffff08]">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <SortBtn col="name" label="Asset" />
                  <SortBtn col="price" label="Price" />
                  <SortBtn col="change24h" label="24h %" />
                  <SortBtn col="change7d" label="7d %" />
                  <SortBtn col="marketCap" label="Market Cap" />
                  <SortBtn col="volume" label="Volume" />
                  <SortBtn col="rsi" label="RSI" />
                  <th className="pb-3 pr-4 font-medium">MACD</th>
                  <th className="pb-3 font-medium">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffffff05]">
                {filtered.map((c, i) => (
                  <tr key={c.symbol} className="hover:bg-[#ffffff04] transition-colors">
                    <td className="py-3 pr-4 text-[#737373]">{i + 1}</td>
                    <td className="py-3 pr-4">
                      <Link to={`/asset/${c.symbol.toLowerCase()}`} className="flex items-center gap-2 hover:text-[#0C8B44] transition-colors">
                        <span className="text-[#E5E5E5] font-medium">{c.symbol}</span>
                        <span className="text-[#737373]">{c.name}</span>
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[#E5E5E5]">${c.price < 1 ? c.price.toFixed(6) : c.price.toLocaleString()}</td>
                    <td className={`py-3 pr-4 ${c.change24h >= 0 ? 'text-[#0C8B44]' : 'text-red-400'}`}>{c.change24h >= 0 ? '+' : ''}{c.change24h}%</td>
                    <td className={`py-3 pr-4 ${c.change7d >= 0 ? 'text-[#0C8B44]' : 'text-red-400'}`}>{c.change7d >= 0 ? '+' : ''}{c.change7d}%</td>
                    <td className="py-3 pr-4 text-[#737373]">{fmt(c.marketCap)}</td>
                    <td className="py-3 pr-4 text-[#737373]">{fmt(c.volume)}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-medium ${c.rsi > 70 ? 'text-red-400' : c.rsi < 30 ? 'text-[#0C8B44]' : 'text-[#737373]'}`}>{c.rsi}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${c.macd === 'bullish' ? 'text-[#0C8B44] bg-[#0C8B44]/10' : c.macd === 'bearish' ? 'text-red-400 bg-red-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>{c.macd}</span>
                    </td>
                    <td className="py-3 text-[#737373]">{c.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-xs text-[#737373]">No assets match your filters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
