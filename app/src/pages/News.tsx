import { useCallback, useEffect, useRef, useState } from 'react'
import Navigation from '../components/Navigation'
import { marketData, type MarketNews } from '../lib/marketData'
import { Clock, ExternalLink, TrendingUp, AlertCircle, Zap, RefreshCw } from 'lucide-react'
import { Toaster } from 'sonner'

const categories = ['All', 'Crypto', 'Stocks', 'Macro', 'DeFi']

const REFRESH_MS = 60_000

export default function News() {
  const [news, setNews] = useState<MarketNews[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const inFlight = useRef(false)

  const loadNews = useCallback(async (opts: { force?: boolean; silent?: boolean } = {}) => {
    if (inFlight.current) return
    inFlight.current = true
    if (!opts.silent) (opts.force ? setRefreshing : setLoading)(true)
    try {
      const data = await marketData.getMarketNews({ category: activeCategory, force: opts.force })
      setNews(data)
      setLastUpdated(Date.now())
    } finally {
      inFlight.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeCategory])

  // Initial + on category change
  useEffect(() => { loadNews({ force: true }) }, [loadNews])

  // Background auto-refresh every REFRESH_MS while page is visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadNews({ force: true, silent: true })
    }, REFRESH_MS)
    const onVis = () => { if (document.visibilityState === 'visible') loadNews({ force: true, silent: true }) }
    document.addEventListener('visibilitychange', onVis)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [loadNews])

  // Re-render every 30s so "Updated Xm ago" stays fresh.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const filteredNews = news

  const formatTime = (timestamp: number) => {
    void tick // keep linter happy; re-renders pull fresh "now"
    const seconds = Math.floor((Date.now() / 1000) - timestamp)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const updatedLabel = lastUpdated ? formatTime(Math.floor(lastUpdated / 1000)) : '—'

  const getCategoryIcon = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'crypto': return <Zap className="w-4 h-4 text-[#F57C00]" />
      case 'stock': return <TrendingUp className="w-4 h-4 text-[#0C8B44]" />
      default: return <AlertCircle className="w-4 h-4 text-[#2196F3]" />
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Market News</h1>
              <p className="text-sm text-[#737373] mt-1 flex items-center gap-2">
                Real-time financial news and analysis
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0C8B44] animate-pulse" />
                  Updated {updatedLabel}
                </span>
              </p>
            </div>
            <button onClick={() => loadNews({ force: true })} disabled={refreshing || loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff08] text-sm text-[#A0A0A0] hover:text-[#0C8B44] transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#0C8B44] text-white'
                    : 'bg-[#1a1a1a] text-[#737373] hover:text-[#E5E5E5]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-[#0C8B44]/30 border-t-[#0C8B44] rounded-full animate-spin" />
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="liquid-card p-12 text-center">
              <Clock className="w-8 h-8 text-[#737373] mx-auto mb-3" />
              <p className="text-sm text-[#A0A0A0]">No news available right now.</p>
              <p className="text-xs text-[#737373] mt-1">Either the upstream feed is down or no API key is configured.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Featured article */}
              {filteredNews[0] && (
                <div className="lg:col-span-2 liquid-card p-8" style={{ '--fill-color': 'rgba(12,139,68,0.1)' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-4">
                    {getCategoryIcon(filteredNews[0].category)}
                    <span className="text-xs text-[#0C8B44] uppercase tracking-wider">{filteredNews[0].category}</span>
                    <span className="text-xs text-[#737373]">{formatTime(filteredNews[0].datetime)}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-light text-[#E5E5E5] mb-3">{filteredNews[0].headline}</h2>
                  <p className="text-[#A0A0A0] leading-relaxed mb-4">{filteredNews[0].summary}</p>
                  <div className="flex items-center gap-2 text-xs text-[#737373]">
                    <span>Source: {filteredNews[0].source}</span>
                    <a href={filteredNews[0].url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#0C8B44] hover:text-[#00E676] transition-colors">
                      Read more <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* News grid */}
              {filteredNews.slice(1).map((article, i) => (
                <div key={i} className="p-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/20 transition-all group">
                  <div className="flex items-center gap-3 mb-3">
                    {getCategoryIcon(article.category)}
                    <span className="text-xs text-[#737373] uppercase">{article.category}</span>
                    <span className="text-xs text-[#737373]">{formatTime(article.datetime)}</span>
                  </div>
                  <h3 className="text-lg font-medium text-[#E5E5E5] mb-2 group-hover:text-[#0C8B44] transition-colors">{article.headline}</h3>
                  <p className="text-sm text-[#A0A0A0] leading-relaxed mb-3">{article.summary}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#737373]">{article.source}</span>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors">
                      Read <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
