// Top Movers — 24h biggest gainers + losers strip. Pure presentational
// widget; data is the cached cryptoData the dashboard already fetches.

import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import type { CryptoQuote } from '../../lib/marketData'
import { cryptoIconFor, cryptoIconErrorFallback } from '../../lib/cryptoIcon'
import { useCurrency } from '../../lib/currencyContext'

export default function TopMovers({ data }: { data: CryptoQuote[] }) {
  const { format } = useCurrency()
  if (!data || data.length === 0) return null

  const sorted = [...data].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
  const gainers = sorted.slice(0, 3)
  const losers = sorted.slice(-3).reverse()

  const Card = ({ c, kind }: { c: CryptoQuote; kind: 'up' | 'down' }) => {
    const icon = cryptoIconFor(c)
    const color = kind === 'up' ? '#4CAF50' : '#f44336'
    const Icon = kind === 'up' ? TrendingUp : TrendingDown
    return (
      <Link to={`/asset/${c.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all min-w-0">
        {icon ? (
          <img
            src={icon}
            alt={c.name}
            className="w-9 h-9 rounded-full object-cover shrink-0"
            onError={cryptoIconErrorFallback((c.symbol || c.id || '?')[0]?.toUpperCase() || '?', c.id)}
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#0C8B44]/15 flex items-center justify-center text-xs font-bold text-[#0C8B44] shrink-0">{(c.symbol || c.id || '?')[0]?.toUpperCase()}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#E5E5E5] truncate">{(c.symbol || c.id || '').toUpperCase()}</p>
          <p className="text-[11px] text-[#737373] truncate">{format(c.current_price, { decimals: c.current_price < 1 ? 4 : 2 })}</p>
        </div>
        <span className="flex items-center gap-1 text-xs shrink-0" style={{ color }}>
          <Icon className="w-3 h-3" />
          {(c.price_change_percentage_24h ?? 0) >= 0 ? '+' : ''}{(c.price_change_percentage_24h ?? 0).toFixed(2)}%
        </span>
      </Link>
    )
  }

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#E5E5E5]">Top Movers · 24h</h3>
        <Link to="/markets" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">
          All markets <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.05em] text-[#4CAF50] mb-2">Gainers</p>
          <div className="space-y-2">
            {gainers.map((c) => <Card key={c.id} c={c} kind="up" />)}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.05em] text-[#f44336] mb-2">Losers</p>
          <div className="space-y-2">
            {losers.map((c) => <Card key={c.id} c={c} kind="down" />)}
          </div>
        </div>
      </div>
    </div>
  )
}
