// Staking & Yield tracker — sums pending rewards across positions and
// shows a per-position breakdown with APY badges + next payout countdown.

import { useEffect, useState } from 'react'
import { Sparkles, Clock } from 'lucide-react'
import { stakingStore, pendingRewardFor, STAKING_EVENT, type StakingPosition } from '../../lib/stakingStore'
import { portfolioStore } from '../../lib/portfolioStore'

// Static fallback prices for headline assets when no live quote has been
// observed yet (e.g. on a fresh page load before marketData has run).
const ASSET_USD_FALLBACK: Record<string, number> = { ETH: 3500, BTC: 67000, SOL: 175, USDC: 1, USDT: 1, DAI: 1 }

function priceFor(asset: string): number {
  // Prefer live quotes from the portfolio store so non-headline assets
  // (e.g. ADA, DOT, MATIC, custom tokens) don't silently price at $0.
  const live = portfolioStore.getQuote(asset)
  if (typeof live === 'number' && live > 0) return live
  return ASSET_USD_FALLBACK[asset.toUpperCase()] ?? 0
}

export default function StakingCard() {
  const [positions, setPositions] = useState<StakingPosition[]>(stakingStore.list())

  useEffect(() => {
    const refresh = () => setPositions(stakingStore.list())
    window.addEventListener(STAKING_EVENT, refresh)
    const t = setInterval(refresh, 30_000)
    return () => { window.removeEventListener(STAKING_EVENT, refresh); clearInterval(t) }
  }, [])

  const totalPendingUsd = positions.reduce((s, p) => {
    const r = pendingRewardFor(p)
    return s + r.rewardAsset * priceFor(p.asset)
  }, 0)
  const totalStakedUsd = positions.reduce((s, p) => s + p.principal * priceFor(p.asset), 0)
  const blendedApy = totalStakedUsd > 0
    ? positions.reduce((s, p) => s + (p.principal * priceFor(p.asset) * p.apy), 0) / totalStakedUsd
    : 0

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#0C8B44]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#E5E5E5]">Staking & Yield</h3>
            <p className="text-[11px] text-[#737373]">Blended APY {(blendedApy * 100).toFixed(2)}%</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-[#737373]">Pending</p>
          <p className="text-sm text-[#4CAF50]">+${totalPendingUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>
      {positions.length === 0 ? (
        <p className="text-xs text-[#737373]">No staking positions yet.</p>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => {
            const r = pendingRewardFor(p)
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a]/50">
                <div className="w-9 h-9 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center text-[10px] font-bold text-[#0C8B44] shrink-0">{p.asset}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#E5E5E5] truncate">{p.principal.toLocaleString()} {p.asset} · {p.protocol}</p>
                  <p className="text-[10px] text-[#737373]">APY {(p.apy * 100).toFixed(2)}%</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-[#4CAF50]">+{r.rewardAsset.toFixed(p.asset === 'USDC' ? 2 : 6)}</p>
                  <p className="text-[10px] text-[#737373] flex items-center gap-1 justify-end">
                    <Clock className="w-2.5 h-2.5" />
                    {r.nextPayoutInDays < 1 ? `${Math.floor(r.nextPayoutInDays * 24)}h` : `${Math.ceil(r.nextPayoutInDays)}d`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
