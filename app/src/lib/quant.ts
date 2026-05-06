// Quant risk utilities — inspired by Fincept Terminal's QuantLib suite,
// distilled to the four metrics most useful to a retail investor.
//
// Inputs are price/return arrays. All functions are pure and dependency-free.

export function dailyReturns(prices: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) out.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  return out
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

/** Annualised volatility from daily returns (sqrt(252) scaling). */
export function annualisedVolatility(returns: number[]): number {
  return stdev(returns) * Math.sqrt(252)
}

/** Sharpe ratio assuming a risk-free rate (annualised, decimal — e.g. 0.04 = 4%). */
export function sharpeRatio(returns: number[], riskFreeAnnual = 0.04): number {
  if (returns.length === 0) return 0
  const meanDaily = mean(returns)
  const sd = stdev(returns)
  if (sd === 0) return 0
  const rfDaily = riskFreeAnnual / 252
  return ((meanDaily - rfDaily) / sd) * Math.sqrt(252)
}

/** Maximum drawdown as a positive percentage (e.g. 0.23 = -23%). */
export function maxDrawdown(prices: number[]): number {
  if (prices.length === 0) return 0
  let peak = prices[0]
  let maxDd = 0
  for (const p of prices) {
    if (p > peak) peak = p
    const dd = peak > 0 ? (peak - p) / peak : 0
    if (dd > maxDd) maxDd = dd
  }
  return maxDd
}

/** Value-at-Risk at the given confidence (historical method). */
export function valueAtRisk(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0
  const sorted = [...returns].sort((a, b) => a - b)
  const idx = Math.floor((1 - confidence) * sorted.length)
  return Math.abs(sorted[idx] || 0)
}
