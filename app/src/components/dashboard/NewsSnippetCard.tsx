// Compact news strip — top 3 headlines from marketData.getMarketNews().
// Background-refreshes every 5 minutes.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Newspaper, ExternalLink, ArrowRight } from 'lucide-react'
import { marketData, type MarketNews } from '../../lib/marketData'

export default function NewsSnippetCard() {
  const [news, setNews] = useState<MarketNews[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const items = await marketData.getMarketNews()
        if (!cancelled) setNews(items.slice(0, 3))
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    void load()
    const t = setInterval(load, 5 * 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const fmtAge = (epoch: number) => {
    const ms = epoch < 1e12 ? epoch * 1000 : epoch
    const diff = Date.now() - ms
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return `${Math.floor(diff / 86400_000)}d ago`
  }

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2196F3]/15 flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-[#2196F3]" />
          </div>
          <h3 className="text-sm font-medium text-[#E5E5E5]">Market News</h3>
        </div>
        <Link to="/news" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">
          All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {loading ? (
        <p className="text-xs text-[#737373]">Loading headlines…</p>
      ) : news.length === 0 ? (
        <p className="text-xs text-[#737373]">No headlines available right now.</p>
      ) : (
        <div className="space-y-3">
          {news.map((n, i) => (
            <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block group">
              <p className="text-sm text-[#E5E5E5] leading-snug group-hover:text-[#0C8B44] transition-colors line-clamp-2">{n.headline}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[#737373]">
                <span>{n.source}</span><span>·</span><span>{fmtAge(n.datetime)}</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
