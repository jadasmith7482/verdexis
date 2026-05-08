// Portfolio Health Score — distills a user's holdings + cash into a single
// 0-100 number broken into five sub-scores. Pure function, no I/O, so the
// dashboard can recompute every time holdings or quotes tick.
//
// Sub-scores (each 0-100, higher = healthier):
//
//   diversification   How spread across distinct positions you are. Single
//                     coin = bad. Many positions with reasonable weights = good.
//   concentration     Penalises one position dominating the book. Inverse of
//                     the largest weight (HHI-style).
//   cashBuffer        Rewards keeping some dry powder. 0% cash = exposed,
//                     100% cash = idle. Sweet spot around 10-30%.
//   stableExposure    Rewards holding stablecoins as a vol cushion. Distinct
//                     from cashBuffer because stables can be deployed faster
//                     into DeFi / yield without leaving the platform.
//   volatility        Estimated 7d portfolio vol from per-asset sparklines,
//                     weighted by allocation. Low vol = high score.
//
// Overall score is a weighted average. Weights tuned for a long-term
// investor, not a degen — i.e. concentration and volatility punish more
// than missing diversification.

import type { PortfolioHolding, WalletBalance } from './portfolioStore'
import type { CryptoQuote } from './marketData'

export interface HealthSubScore {
  key: 'diversification' | 'concentration' | 'cashBuffer' | 'stableExposure' | 'volatility'
  label: string
  score: number          // 0-100
  detail: string         // one-line human explanation shown under the bar
}

export interface PortfolioHealth {
  overall: number              // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  status: 'excellent' | 'healthy' | 'okay' | 'risky' | 'critical'
  color: string                // hex for the ring/bar
  subScores: HealthSubScore[]
  warnings: string[]           // surfaced as "Action items" on the card
}

const STABLE_SYMBOLS = new Set(['USD', 'USDC', 'USDT', 'DAI', 'TUSD', 'FDUSD', 'USDP'])

// Standard deviation of percent changes between consecutive sparkline samples.
// Returns 0 when we don't have enough data to estimate.
function sparklineVol(prices: number[] | undefined): number {
  if (!prices || prices.length < 4) return 0
  const returns: number[] = []
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]
    if (prev > 0) returns.push((prices[i] - prev) / prev)
  }
  if (returns.length === 0) return 0
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance)
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

function gradeFor(score: number): PortfolioHealth['grade'] {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function statusFor(score: number): { status: PortfolioHealth['status']; color: string } {
  if (score >= 85) return { status: 'excellent', color: '#00E676' }
  if (score >= 70) return { status: 'healthy', color: '#4CAF50' }
  if (score >= 55) return { status: 'okay', color: '#FFC107' }
  if (score >= 40) return { status: 'risky', color: '#FF9800' }
  return { status: 'critical', color: '#f44336' }
}

export function computePortfolioHealth(input: {
  holdings: PortfolioHolding[]
  wallet: WalletBalance[]
  market: CryptoQuote[]
  netWorth: number
}): PortfolioHealth | null {
  const { holdings, wallet, market, netWorth } = input
  if (netWorth <= 0) return null

  // ---- 1. Diversification ------------------------------------------------
  // Count distinct non-stable, non-USD positions. 1 = bad, 8+ = great.
  const realPositions = holdings.filter(
    (h) => !STABLE_SYMBOLS.has(h.symbol.toUpperCase()) && h.value > 0,
  )
  const positionCount = realPositions.length
  let diversification = 0
  if (positionCount === 0) diversification = 100      // all-cash is "diverse" in the safe sense
  else if (positionCount === 1) diversification = 25
  else if (positionCount === 2) diversification = 45
  else if (positionCount === 3) diversification = 60
  else if (positionCount === 4) diversification = 72
  else if (positionCount <= 6) diversification = 85
  else if (positionCount <= 10) diversification = 95
  else diversification = 100

  // ---- 2. Concentration --------------------------------------------------
  // Inverse of the largest weight. >50% in one coin tanks the score.
  const positionsValue = realPositions.reduce((s, h) => s + h.value, 0)
  const largestWeight = positionsValue > 0
    ? Math.max(...realPositions.map((h) => h.value)) / netWorth
    : 0
  let concentration: number
  if (positionsValue === 0) concentration = 100
  else if (largestWeight >= 0.8) concentration = 10
  else if (largestWeight >= 0.6) concentration = 30
  else if (largestWeight >= 0.45) concentration = 55
  else if (largestWeight >= 0.30) concentration = 75
  else if (largestWeight >= 0.20) concentration = 90
  else concentration = 100

  // ---- 3. Cash buffer ----------------------------------------------------
  // USD-only (not stables). Sweet spot 10-30% of net worth.
  const usdCash = wallet
    .filter((w) => (w.currency || '').toUpperCase() === 'USD')
    .reduce((s, w) => s + (w.balance || 0), 0)
  const cashPct = usdCash / netWorth
  let cashBuffer: number
  if (cashPct >= 0.10 && cashPct <= 0.30) cashBuffer = 100
  else if (cashPct < 0.10) cashBuffer = clamp(40 + cashPct * 600)        // 0% -> 40, 10% -> 100
  else cashBuffer = clamp(100 - (cashPct - 0.30) * 120)                  // 30% -> 100, 100% -> 16

  // ---- 4. Stable exposure ------------------------------------------------
  // Stablecoins (excluding USD) as a percent of net worth. ~5-20% is ideal.
  const stableValue = wallet
    .filter((w) => STABLE_SYMBOLS.has((w.currency || '').toUpperCase()) && (w.currency || '').toUpperCase() !== 'USD')
    .reduce((s, w) => s + (w.balance || 0), 0)
  const stablePct = stableValue / netWorth
  let stableExposure: number
  if (stablePct >= 0.05 && stablePct <= 0.20) stableExposure = 100
  else if (stablePct < 0.05) stableExposure = clamp(60 + stablePct * 800)
  else stableExposure = clamp(100 - (stablePct - 0.20) * 100)

  // ---- 5. Volatility -----------------------------------------------------
  // Allocation-weighted 7d sparkline vol. Stables/cash contribute 0 vol.
  const quoteById = new Map(market.map((m) => [m.id, m] as const))
  const quoteBySym = new Map(market.map((m) => [(m.symbol || '').toLowerCase(), m] as const))
  let weightedVol = 0
  for (const h of holdings) {
    if (STABLE_SYMBOLS.has((h.symbol || '').toUpperCase())) continue
    const m = quoteById.get(h.id) ?? quoteBySym.get((h.symbol || '').toLowerCase())
    const v = sparklineVol(m?.sparkline_in_7d?.price)
    const w = h.value / netWorth
    weightedVol += v * w
  }
  // weightedVol is roughly stddev of hourly-ish returns. 0.005 = calm,
  // 0.05 = wild. Map linearly into a 0-100 score.
  const volPct = weightedVol * 100
  let volatility: number
  if (volPct <= 0.5) volatility = 100
  else if (volPct >= 5) volatility = 10
  else volatility = clamp(100 - ((volPct - 0.5) / 4.5) * 90)

  const subScores: HealthSubScore[] = [
    {
      key: 'diversification',
      label: 'Diversification',
      score: Math.round(diversification),
      detail: positionCount === 0
        ? 'No risk assets — fully in cash/stables.'
        : positionCount === 1
          ? 'Only 1 risk asset. Add 2-3 more to spread risk.'
          : `${positionCount} positions across the book.`,
    },
    {
      key: 'concentration',
      label: 'Concentration',
      score: Math.round(concentration),
      detail: positionsValue === 0
        ? 'No single-asset concentration.'
        : `Largest holding is ${(largestWeight * 100).toFixed(0)}% of net worth.`,
    },
    {
      key: 'cashBuffer',
      label: 'Cash Buffer',
      score: Math.round(cashBuffer),
      detail: `${(cashPct * 100).toFixed(0)}% USD cash. Target 10-30%.`,
    },
    {
      key: 'stableExposure',
      label: 'Stable Exposure',
      score: Math.round(stableExposure),
      detail: stableValue > 0
        ? `${(stablePct * 100).toFixed(0)}% in stablecoins.`
        : 'No stablecoin cushion.',
    },
    {
      key: 'volatility',
      label: 'Volatility',
      score: Math.round(volatility),
      detail: weightedVol > 0
        ? `~${volPct.toFixed(2)}% per-bar swing (7d).`
        : 'Insufficient market data to estimate.',
    },
  ]

  // Weighted overall (sums to 1.00).
  const overall = Math.round(
    diversification * 0.18 +
    concentration * 0.28 +
    cashBuffer * 0.14 +
    stableExposure * 0.12 +
    volatility * 0.28,
  )

  // Action items the user should actually do something about.
  const warnings: string[] = []
  if (largestWeight >= 0.5 && positionsValue > 0) {
    const top = realPositions.reduce((a, b) => (a.value > b.value ? a : b))
    warnings.push(`${top.symbol.toUpperCase()} is ${(largestWeight * 100).toFixed(0)}% of your portfolio — consider trimming.`)
  }
  if (positionCount === 1) {
    warnings.push('Only one risk asset. Add 2-3 holdings to reduce single-asset risk.')
  }
  if (cashPct < 0.05 && netWorth > 0) {
    warnings.push('Cash buffer below 5%. You may have no dry powder for opportunities or drawdowns.')
  }
  if (cashPct > 0.5) {
    warnings.push(`${(cashPct * 100).toFixed(0)}% sitting in cash. You could be missing market upside.`)
  }
  if (volPct >= 4) {
    warnings.push('Portfolio volatility is elevated. Consider adding stables or lower-beta assets.')
  }

  const { status, color } = statusFor(overall)
  return {
    overall,
    grade: gradeFor(overall),
    status,
    color,
    subScores,
    warnings,
  }
}
