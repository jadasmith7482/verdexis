// Asset-category breakdown. Maps each holding's symbol to a category
// (L1, DeFi, Stablecoin, Memecoin, Other) and shows allocation by category
// — useful for understanding diversification at a glance.

import type { PortfolioHolding } from '../../lib/portfolioStore'
import { Layers } from 'lucide-react'

const CATEGORY_MAP: Record<string, string> = {
  // L1s
  BTC: 'Layer 1', ETH: 'Layer 1', SOL: 'Layer 1', ADA: 'Layer 1', AVAX: 'Layer 1', DOT: 'Layer 1', NEAR: 'Layer 1', ATOM: 'Layer 1', BNB: 'Layer 1', TRX: 'Layer 1',
  // L2s
  ARB: 'Layer 2', OP: 'Layer 2', MATIC: 'Layer 2',
  // DeFi
  UNI: 'DeFi', AAVE: 'DeFi', MKR: 'DeFi', CRV: 'DeFi', LDO: 'DeFi', SNX: 'DeFi', COMP: 'DeFi', SUSHI: 'DeFi',
  // Stablecoin
  USDC: 'Stablecoin', USDT: 'Stablecoin', DAI: 'Stablecoin', BUSD: 'Stablecoin', USD: 'Stablecoin',
  // Meme
  DOGE: 'Memecoin', SHIB: 'Memecoin', PEPE: 'Memecoin', WIF: 'Memecoin', BONK: 'Memecoin',
}

const CATEGORY_COLORS: Record<string, string> = {
  'Layer 1': '#0C8B44',
  'Layer 2': '#00BCD4',
  'DeFi': '#9C27B0',
  'Stablecoin': '#737373',
  'Memecoin': '#FF9800',
  'Other': '#2196F3',
}

export default function CategoryBreakdownCard({ holdings, totalValue }: { holdings: PortfolioHolding[]; totalValue: number }) {
  if (!holdings || holdings.length === 0 || totalValue <= 0) return null

  const buckets = new Map<string, number>()
  for (const h of holdings) {
    const cat = CATEGORY_MAP[h.symbol.toUpperCase()] || 'Other'
    buckets.set(cat, (buckets.get(cat) || 0) + h.value)
  }
  const rows = Array.from(buckets.entries())
    .map(([cat, value]) => ({ cat, value, pct: (value / totalValue) * 100 }))
    .sort((a, b) => b.value - a.value)

  // Render as horizontal stacked bar
  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#00BCD4]/15 flex items-center justify-center">
          <Layers className="w-4 h-4 text-[#00BCD4]" />
        </div>
        <h3 className="text-sm font-medium text-[#E5E5E5]">Asset Categories</h3>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-[#1a1a1a] mb-4">
        {rows.map((r) => (
          <div key={r.cat} style={{ width: `${r.pct}%`, background: CATEGORY_COLORS[r.cat] || CATEGORY_COLORS.Other }} title={`${r.cat} ${r.pct.toFixed(1)}%`} />
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.cat} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[r.cat] || CATEGORY_COLORS.Other }} />
              <span className="text-[#A0A0A0]">{r.cat}</span>
            </div>
            <span className="text-[#E5E5E5]">{r.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
