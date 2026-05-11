// Morning Brief — a deterministic, no-LLM-required summary of "what
// happened to your money since yesterday" plus a couple of forward-looking
// nudges. Designed to feel like a personal analyst greeting the user
// when they open the dashboard.
//
// We compute everything client-side from the same inputs the dashboard
// already has: holdings, market quotes, portfolio health. No extra API
// calls, no flashy "AI is thinking..." spinner. The point is to read like
// a private banker's morning email, not a chat completion.

import { useMemo } from 'react'
import { Sparkles, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PortfolioHolding } from '../../lib/portfolioStore'
import type { CryptoQuote } from '../../lib/marketData'
import type { PortfolioHealth } from '../../lib/portfolioHealth'

interface Props {
  holdings: PortfolioHolding[]
  market: CryptoQuote[]
  netWorth: number
  dayChangePercent: number
  health: PortfolioHealth | null
  fmtMoney: (n: number, opts?: { sign?: boolean }) => string
  userName?: string | null
}

function timeOfDayGreeting(): string {
  return 'Welcome'
}

interface Insight {
  kind: 'positive' | 'negative' | 'neutral' | 'action'
  text: string
}

export default function MorningBriefCard({
  holdings,
  market,
  netWorth,
  dayChangePercent,
  health,
  fmtMoney,
  userName,
}: Props) {
  const brief = useMemo(() => {
    const insights: Insight[] = []

    // Per-holding day moves, joined with market quotes for the % change.
    const quoteById = new Map(market.map((m) => [m.id, m] as const))
    const quoteBySym = new Map(market.map((m) => [(m.symbol || '').toLowerCase(), m] as const))
    const moves = holdings
      .filter((h) => (h.symbol || '').toUpperCase() !== 'USD' && h.value > 0)
      .map((h) => {
        const m = quoteById.get(h.id) ?? quoteBySym.get((h.symbol || '').toLowerCase())
        return {
          holding: h,
          changePct: m?.price_change_percentage_24h ?? 0,
          dollarMove: ((m?.price_change_percentage_24h ?? 0) / 100) * h.value,
        }
      })
      .sort((a, b) => b.dollarMove - a.dollarMove)

    // Top driver up + down.
    const winner = moves[0]
    const loser = moves[moves.length - 1]

    if (moves.length > 0 && winner && winner.changePct > 0.1) {
      insights.push({
        kind: 'positive',
        text: `${(winner.holding.symbol || 'asset').toUpperCase()} is your biggest gainer today, up ${winner.changePct.toFixed(2)}% (${fmtMoney(winner.dollarMove, { sign: true })}).`,
      })
    }
    if (moves.length > 1 && loser && loser.changePct < -0.1 && loser !== winner) {
      insights.push({
        kind: 'negative',
        text: `${(loser.holding.symbol || 'asset').toUpperCase()} is dragging, down ${Math.abs(loser.changePct).toFixed(2)}% (${fmtMoney(loser.dollarMove, { sign: true })}).`,
      })
    }

    // Wider market context — top of the market today regardless of holdings.
    if (market.length > 0) {
      const sortedMarket = [...market].sort(
        (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h,
      )
      const marketWinner = sortedMarket[0]
      if (marketWinner && marketWinner.price_change_percentage_24h > 5) {
        insights.push({
          kind: 'neutral',
          text: `Market leader today: ${(marketWinner.symbol || marketWinner.id || '').toUpperCase()} +${marketWinner.price_change_percentage_24h.toFixed(2)}%.`,
        })
      }
    }

    // Health-derived nudges (just the most important one — the card already
    // shows the full action-item list elsewhere).
    if (health && health.warnings.length > 0) {
      insights.push({ kind: 'action', text: health.warnings[0] })
    } else if (health && health.overall >= 80) {
      insights.push({
        kind: 'positive',
        text: `Portfolio health is ${health.status} (${health.overall}/100). No urgent action needed.`,
      })
    }

    // Final headline based on the day's net change.
    const headline = (() => {
      if (netWorth <= 0) return 'Your portfolio is empty — fund your account to get started.'
      if (Math.abs(dayChangePercent) < 0.1) return 'Markets are quiet for you today.'
      if (dayChangePercent > 0) {
        return `Your portfolio is up ${dayChangePercent.toFixed(2)}% today.`
      }
      return `Your portfolio is down ${Math.abs(dayChangePercent).toFixed(2)}% today.`
    })()

    return { insights, headline }
  }, [holdings, market, netWorth, dayChangePercent, health, fmtMoney])

  const dollarChange = (dayChangePercent / 100) * netWorth
  const isUp = dayChangePercent >= 0

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-[#0C8B44]/10 via-[#0f1619]/50 to-[#6A0DAD]/10 border border-[#0C8B44]/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#0C8B44]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#E5E5E5]">Morning Brief</h3>
            <p className="text-[10px] text-[#737373]">
              {timeOfDayGreeting()}{userName ? `, ${userName}` : ''}
            </p>
          </div>
        </div>
        <Link
          to="/ai"
          className="text-[11px] text-[#0C8B44] hover:underline flex items-center gap-1"
        >
          Ask AI <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      <p className="text-base text-[#E5E5E5] font-light leading-snug mb-1">{brief.headline}</p>
      {netWorth > 0 && Math.abs(dayChangePercent) >= 0.1 && (
        <p className={`text-xs mb-4 flex items-center gap-1 ${isUp ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {fmtMoney(dollarChange, { sign: true })} since yesterday
        </p>
      )}

      {brief.insights.length > 0 && (
        <ul className="space-y-2">
          {brief.insights.map((insight, i) => {
            const dot =
              insight.kind === 'positive' ? '#4CAF50'
                : insight.kind === 'negative' ? '#f44336'
                  : insight.kind === 'action' ? '#FF9800'
                    : '#737373'
            return (
              <li key={i} className="text-xs text-[#A0A0A0] flex gap-2 leading-relaxed">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: dot }}
                />
                <span>{insight.text}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
