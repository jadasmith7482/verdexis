// Portfolio Health Score widget. Shows the overall 0-100 score as a ring,
// the letter grade, all five sub-scores as bars, and any action items the
// scoring function flagged. Pure presentational — recomputes whenever the
// dashboard re-renders with new holdings/quotes.

import { useMemo } from 'react'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { computePortfolioHealth } from '../../lib/portfolioHealth'
import type { PortfolioHolding, WalletBalance } from '../../lib/portfolioStore'
import type { CryptoQuote } from '../../lib/marketData'

interface Props {
  holdings: PortfolioHolding[]
  wallet: WalletBalance[]
  market: CryptoQuote[]
  netWorth: number
}

export default function PortfolioHealthCard({ holdings, wallet, market, netWorth }: Props) {
  const health = useMemo(
    () => computePortfolioHealth({ holdings, wallet, market, netWorth }),
    [holdings, wallet, market, netWorth],
  )

  if (!health) {
    return (
      <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-[#0C8B44]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Portfolio Health</h3>
        </div>
        <p className="text-xs text-[#737373]">Add holdings or cash to compute your health score.</p>
      </div>
    )
  }

  // Ring math: 88px circle, stroke 8.
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const ringOffset = circumference - (health.overall / 100) * circumference

  return (
    <div className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: health.color }} />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Portfolio Health</h3>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: `${health.color}20`, color: health.color }}
        >
          {health.status}
        </span>
      </div>

      <div className="flex items-center gap-5 mb-5">
        {/* Score ring */}
        <div className="relative w-24 h-24 shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
            <circle cx="48" cy="48" r={radius} stroke="#1a1a1a" strokeWidth="8" fill="none" />
            <circle
              cx="48" cy="48" r={radius}
              stroke={health.color}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={ringOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-light text-[#E5E5E5] tabular-nums leading-none">{health.overall}</span>
            <span className="text-[10px] text-[#737373] uppercase tracking-wider mt-0.5">Score</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-4xl font-light leading-none" style={{ color: health.color }}>{health.grade}</span>
            <span className="text-xs text-[#737373]">grade</span>
          </div>
          <p className="text-xs text-[#737373] leading-relaxed">
            Based on diversification, concentration, cash buffer, stable exposure, and 7-day volatility.
          </p>
        </div>
      </div>

      {/* Sub-score bars */}
      <div className="space-y-2.5 mb-4">
        {health.subScores.map((s) => (
          <div key={s.key}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-[#A0A0A0]">{s.label}</span>
              <span className="text-[#E5E5E5] tabular-nums">{s.score}</span>
            </div>
            <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(2, s.score)}%`,
                  background: s.score >= 70 ? '#4CAF50' : s.score >= 45 ? '#FFC107' : '#f44336',
                }}
              />
            </div>
            <p className="text-[10px] text-[#737373] mt-1">{s.detail}</p>
          </div>
        ))}
      </div>

      {/* Action items */}
      {health.warnings.length > 0 && (
        <div className="pt-3 border-t border-[#ffffff08]">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3 h-3 text-[#FF9800]" />
            <span className="text-[10px] uppercase tracking-wider text-[#FF9800]">Action items</span>
          </div>
          <ul className="space-y-1.5">
            {health.warnings.map((w, i) => (
              <li key={i} className="text-[11px] text-[#A0A0A0] flex gap-2">
                <span className="text-[#FF9800] shrink-0">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
