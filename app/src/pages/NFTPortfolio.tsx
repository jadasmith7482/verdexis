import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Image, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'

interface NFT {
  id: string
  name: string
  collection: string
  category: 'Art' | 'Gaming' | 'PFP' | 'Utility'
  image: string // emoji placeholder
  floorPrice: number
  floorChange24h: number
  purchasePrice: number
  quantity: number
  chain: string
  openseaUrl: string
}

const NFTS: NFT[] = [
  { id: '1', name: 'Bored Ape #4821', collection: 'Bored Ape Yacht Club', category: 'PFP', image: '🐵', floorPrice: 38.2, floorChange24h: 2.4, purchasePrice: 65.0, quantity: 1, chain: 'ETH', openseaUrl: 'https://opensea.io/collection/boredapeyachtclub' },
  { id: '2', name: 'Pudgy #1102', collection: 'Pudgy Penguins', category: 'PFP', image: '🐧', floorPrice: 11.5, floorChange24h: -1.8, purchasePrice: 8.2, quantity: 1, chain: 'ETH', openseaUrl: 'https://opensea.io/collection/pudgypenguins' },
  { id: '3', name: 'Axie Mystic', collection: 'Axie Infinity', category: 'Gaming', image: '🦎', floorPrice: 0.42, floorChange24h: 5.1, purchasePrice: 0.28, quantity: 3, chain: 'RON', openseaUrl: 'https://marketplace.axieinfinity.com/' },
  { id: '4', name: 'Pak Mass #44', collection: 'Pak Open Edition', category: 'Art', image: '🎨', floorPrice: 2.1, floorChange24h: 0.0, purchasePrice: 1.5, quantity: 2, chain: 'ETH', openseaUrl: 'https://opensea.io/' },
  { id: '5', name: 'ENS: verdexis.eth', collection: 'ENS Domains', category: 'Utility', image: '🔑', floorPrice: 0.05, floorChange24h: 1.2, purchasePrice: 0.04, quantity: 1, chain: 'ETH', openseaUrl: 'https://app.ens.domains/' },
]

const CATEGORY_COLORS: Record<string, string> = { Art: '#f59e0b', Gaming: '#38bdf8', PFP: '#a78bfa', Utility: '#0C8B44' }
const ETH_PRICE = 3_180

export default function NFTPortfolio() { return <RequireAuth><NFTPortfolioInner /></RequireAuth> }

function NFTPortfolioInner() {
  const [filter, setFilter] = useState<'All' | 'Art' | 'Gaming' | 'PFP' | 'Utility'>('All')
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'change'>('value')

  const filtered = NFTS
    .filter(n => filter === 'All' || n.category === filter)
    .sort((a, b) => {
      if (sortBy === 'value') return (b.floorPrice * b.quantity) - (a.floorPrice * a.quantity)
      if (sortBy === 'pnl') return ((b.floorPrice - b.purchasePrice) * b.quantity) - ((a.floorPrice - a.purchasePrice) * a.quantity)
      return b.floorChange24h - a.floorChange24h
    })

  const totalValueEth = NFTS.reduce((s, n) => s + n.floorPrice * n.quantity, 0)
  const totalCostEth = NFTS.reduce((s, n) => s + n.purchasePrice * n.quantity, 0)
  const totalPnlEth = totalValueEth - totalCostEth
  const totalPnlPct = (totalPnlEth / totalCostEth) * 100

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Image className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">NFT Portfolio</h1>
              <p className="text-xs text-[#737373]">Track your NFT holdings, floor prices & estimated value.</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Value', value: `${totalValueEth.toFixed(2)} ETH`, sub: `~$${(totalValueEth * ETH_PRICE).toLocaleString()}` },
              { label: 'Total Cost', value: `${totalCostEth.toFixed(2)} ETH`, sub: `~$${(totalCostEth * ETH_PRICE).toLocaleString()}` },
              { label: 'Unrealized P&L', value: `${totalPnlEth >= 0 ? '+' : ''}${totalPnlEth.toFixed(2)} ETH`, sub: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%`, color: totalPnlEth >= 0 ? '#0C8B44' : '#ef4444' },
              { label: 'Items', value: `${NFTS.reduce((s, n) => s + n.quantity, 0)}`, sub: `${NFTS.length} collections` },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{s.label}</p>
                <p className="text-lg font-light" style={{ color: s.color ?? '#E5E5E5' }}>{s.value}</p>
                <p className="text-[11px] text-[#737373]">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 mb-6">
            <div className="flex gap-3 flex-wrap">
              {(['All', 'PFP', 'Art', 'Gaming', 'Utility'] as const).map(c => {
                const count = c === 'All' ? NFTS.length : NFTS.filter(n => n.category === c).length
                return (
                  <button key={c} onClick={() => setFilter(c)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === c ? 'bg-[#0C8B44]/20 text-[#0C8B44] border border-[#0C8B44]/30' : 'border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
                    {c !== 'All' && <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />}
                    {c} ({count})
                  </button>
                )
              })}
              <select aria-label="Sort by" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="ml-auto px-2 py-1.5 text-xs bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#737373]">
                <option value="value">Sort: Value</option>
                <option value="pnl">Sort: P&L</option>
                <option value="change">Sort: 24h Change</option>
              </select>
            </div>
          </div>

          {/* NFT grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(nft => {
              const pnlEth = (nft.floorPrice - nft.purchasePrice) * nft.quantity
              const pnlPct = ((nft.floorPrice - nft.purchasePrice) / nft.purchasePrice) * 100
              return (
                <div key={nft.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5 hover:border-[#ffffff15] transition-colors">
                  {/* Image */}
                  <div className="w-full aspect-square rounded-xl bg-[#0a0f11] border border-[#ffffff08] flex items-center justify-center text-4xl mb-4">
                    {nft.image}
                  </div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-[#E5E5E5]">{nft.name}</p>
                      <p className="text-[10px] text-[#737373]">{nft.collection}</p>
                    </div>
                    <a href={nft.openseaUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-[#ffffff08] text-[#737373] hover:text-[#E5E5E5] transition-colors">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: `${CATEGORY_COLORS[nft.category]}20`, color: CATEGORY_COLORS[nft.category] }}>{nft.category}</span>
                    <span className="text-[10px] text-[#737373] border border-[#ffffff08] px-1.5 py-0.5 rounded">{nft.chain}</span>
                    {nft.quantity > 1 && <span className="text-[10px] text-[#737373]">×{nft.quantity}</span>}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#737373]">Floor price</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#E5E5E5]">{nft.floorPrice} ETH</span>
                        <span className={`text-[10px] flex items-center gap-0.5 ${nft.floorChange24h >= 0 ? 'text-[#0C8B44]' : 'text-red-400'}`}>
                          {nft.floorChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(nft.floorChange24h)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#737373]">Value</span>
                      <span className="text-[#E5E5E5]">{(nft.floorPrice * nft.quantity).toFixed(2)} ETH</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#737373]">P&L</span>
                      <span className={pnlEth >= 0 ? 'text-[#0C8B44]' : 'text-red-400'}>
                        {pnlEth >= 0 ? '+' : ''}{pnlEth.toFixed(2)} ETH ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
