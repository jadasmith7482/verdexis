import { useEffect, useState } from 'react'
import { Activity, Shield, TrendingDown, AlertTriangle } from 'lucide-react'
import { marketData } from '../lib/marketData'
import { portfolioStore } from '../lib/portfolioStore'
import { dailyReturns, sharpeRatio, maxDrawdown, valueAtRisk, annualisedVolatility } from '../lib/quant'

// Risk Analytics card — inspired by the QuantLib suite in Fincept Terminal.
// Computes Sharpe, max drawdown, VaR(95%) and annualised vol from holdings.
export default function RiskMetricsCard() {
  const [metrics, setMetrics] = useState({ sharpe: 0, mdd: 0, var95: 0, vol: 0, n: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const list = await marketData.getCryptoList()
        const holdings = portfolioStore.getHoldings()
        // Build a portfolio-weighted price series from sparkline data.
        const series: number[] = []
        const total = holdings.reduce((s, h) => s + h.quantity * (list.find(c => c.symbol.toUpperCase() === h.symbol.toUpperCase())?.current_price ?? 0), 0) || 1
        const weighted: number[][] = []
        for (const h of holdings) {
          const c = list.find(x => x.symbol.toUpperCase() === h.symbol.toUpperCase())
          if (!c?.sparkline_in_7d?.price?.length) continue
          const w = (h.quantity * c.current_price) / total
          weighted.push(c.sparkline_in_7d.price.map(p => p * w))
        }
        if (weighted.length === 0) {
          // Fallback to BTC sparkline so the card still tells a story for empty portfolios.
          const btc = list.find(c => c.id === 'bitcoin')
          if (btc?.sparkline_in_7d?.price) series.push(...btc.sparkline_in_7d.price)
        } else {
          const len = Math.min(...weighted.map(w => w.length))
          for (let i = 0; i < len; i++) series.push(weighted.reduce((s, w) => s + w[i], 0))
        }
        const rets = dailyReturns(series)
        if (!cancelled) {
          setMetrics({
            sharpe: sharpeRatio(rets),
            mdd: maxDrawdown(series),
            var95: valueAtRisk(rets, 0.95),
            vol: annualisedVolatility(rets),
            n: series.length,
          })
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const items = [
    { label: 'Sharpe (1y)', value: metrics.sharpe.toFixed(2), icon: Activity, hint: metrics.sharpe > 1 ? 'Strong' : metrics.sharpe > 0 ? 'Acceptable' : 'Weak', color: metrics.sharpe > 1 ? '#4CAF50' : metrics.sharpe > 0 ? '#F59E0B' : '#FF5252' },
    { label: 'Max Drawdown', value: `-${(metrics.mdd * 100).toFixed(2)}%`, icon: TrendingDown, hint: metrics.mdd < 0.1 ? 'Low' : metrics.mdd < 0.25 ? 'Moderate' : 'High', color: metrics.mdd < 0.1 ? '#4CAF50' : metrics.mdd < 0.25 ? '#F59E0B' : '#FF5252' },
    { label: 'Daily VaR 95%', value: `${(metrics.var95 * 100).toFixed(2)}%`, icon: AlertTriangle, hint: 'Worst 5% day', color: '#A0A0A0' },
    { label: 'Volatility (ann.)', value: `${(metrics.vol * 100).toFixed(1)}%`, icon: Shield, hint: metrics.vol < 0.4 ? 'Calm' : metrics.vol < 0.8 ? 'Normal' : 'Hot', color: metrics.vol < 0.4 ? '#4CAF50' : metrics.vol < 0.8 ? '#F59E0B' : '#FF5252' },
  ]

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-[#737373] uppercase tracking-wider">Risk Analytics</p>
          <p className="text-sm text-[#A0A0A0] mt-0.5">QuantLib-inspired · 7d window</p>
        </div>
        <Shield className="w-5 h-5 text-[#0C8B44]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <div key={it.label} className="rounded-lg bg-[#0a0a0a] border border-[#ffffff08] p-3">
              <div className="flex items-center gap-2 text-[#737373] text-[11px] uppercase tracking-wider">
                <Icon className="w-3 h-3" />
                {it.label}
              </div>
              <p className="text-lg font-semibold mt-1.5" style={{ color: it.color }}>{loading ? '—' : it.value}</p>
              <p className="text-[11px] text-[#737373] mt-0.5">{it.hint}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
