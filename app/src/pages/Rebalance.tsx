import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, PieChart, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'

interface Allocation {
  symbol: string
  target: number // percentage
  current: number // percentage
  value: number
}

const INITIAL: Allocation[] = [
  { symbol: 'BTC', target: 40, current: 48, value: 29_760 },
  { symbol: 'ETH', target: 30, current: 24, value: 14_880 },
  { symbol: 'SOL', target: 15, current: 18, value: 11_160 },
  { symbol: 'BNB', target: 10, current: 7, value: 4_340 },
  { symbol: 'Cash', target: 5, current: 3, value: 1_860 },
]

const COLORS = ['#0C8B44', '#38bdf8', '#a78bfa', '#f59e0b', '#94a3b8']

export default function Rebalance() { return <RequireAuth><RebalanceInner /></RequireAuth> }

function RebalanceInner() {
  const [allocations, setAllocations] = useState<Allocation[]>(INITIAL)
  const [rebalancing, setRebalancing] = useState(false)
  const totalValue = allocations.reduce((s, a) => s + a.value, 0)

  const totalTarget = allocations.reduce((s, a) => s + a.target, 0)
  const isValid = Math.abs(totalTarget - 100) < 0.01

  const updateTarget = (symbol: string, val: number) => {
    setAllocations(prev => prev.map(a => a.symbol === symbol ? { ...a, target: Math.max(0, Math.min(100, val)) } : a))
  }

  const drift = (a: Allocation) => a.current - a.target
  const absDrift = (a: Allocation) => Math.abs(drift(a))
  const needsRebalance = allocations.some(a => absDrift(a) > 2)

  const doRebalance = async () => {
    if (!isValid) { toast.error('Target allocations must add up to 100%'); return }
    setRebalancing(true)
    await new Promise(r => setTimeout(r, 1600))
    setAllocations(prev => prev.map(a => ({ ...a, current: a.target, value: totalValue * (a.target / 100) })))
    setRebalancing(false)
    toast.success('Portfolio rebalanced to target allocations')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-[#0C8B44]" />
              </div>
              <div>
                <h1 className="text-2xl font-light text-[#E5E5E5]">Auto-Rebalance</h1>
                <p className="text-xs text-[#737373]">Set target allocations and rebalance with one click.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#737373]">Portfolio value</p>
              <p className="text-lg font-light text-[#E5E5E5]">${totalValue.toLocaleString()}</p>
            </div>
          </div>

          {needsRebalance && (
            <div className="flex items-center gap-2 rounded-xl bg-yellow-400/10 border border-yellow-400/20 px-4 py-3 mb-6">
              <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-400">Your portfolio has drifted from targets. Consider rebalancing.</p>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Allocation editor */}
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Target Allocations</h2>
              <div className="space-y-3 mb-4">
                {allocations.map((a, i) => (
                  <div key={a.symbol} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-[#E5E5E5] w-12 shrink-0">{a.symbol}</span>
                    <div className="flex-1 relative">
                      <input
                        type="range" min="0" max="100" step="1"
                        value={a.target}
                        onChange={e => updateTarget(a.symbol, parseFloat(e.target.value))}
                        className="w-full accent-[#0C8B44]"
                        aria-label={`${a.symbol} target allocation`}
                      />
                    </div>
                    <div className="flex items-center gap-1 w-20 shrink-0">
                      <input
                        type="number" min="0" max="100" step="1"
                        value={a.target}
                        onChange={e => updateTarget(a.symbol, parseFloat(e.target.value))}
                        className="w-12 px-1.5 py-1 text-xs bg-[#0a0f11] border border-[#ffffff10] rounded text-[#E5E5E5] text-center"
                        aria-label={`${a.symbol} target %`}
                      />
                      <span className="text-[10px] text-[#737373]">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`flex justify-between text-xs mb-4 ${isValid ? 'text-[#0C8B44]' : 'text-red-400'}`}>
                <span>Total: {totalTarget.toFixed(1)}%</span>
                {!isValid && <span>Must equal 100%</span>}
              </div>

              <button onClick={doRebalance} disabled={rebalancing || !isValid} className="w-full py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                <RefreshCw className={`w-3 h-3 ${rebalancing ? 'animate-spin' : ''}`} />
                {rebalancing ? 'Rebalancing…' : 'Rebalance Now'}
              </button>
            </div>

            {/* Current vs Target */}
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Current vs Target</h2>
              <div className="space-y-4">
                {allocations.map((a, i) => {
                  const d = drift(a)
                  const tradeAmt = Math.abs((d / 100) * totalValue)
                  return (
                    <div key={a.symbol}>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-[#E5E5E5]">{a.symbol}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[#737373]">
                          <span>Current: <span className="text-[#E5E5E5]">{a.current}%</span></span>
                          <span>Target: <span className="text-[#E5E5E5]">{a.target}%</span></span>
                          <span className={d > 1 ? 'text-red-400' : d < -1 ? 'text-[#0C8B44]' : 'text-[#737373]'}>
                            {d > 0 ? `Sell $${tradeAmt.toFixed(0)}` : d < 0 ? `Buy $${tradeAmt.toFixed(0)}` : '✓'}
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2 bg-[#ffffff10] rounded-full overflow-hidden">
                        <div className="absolute h-full rounded-full opacity-40" style={{ width: `${a.target}%`, background: COLORS[i % COLORS.length] }} />
                        <div className="absolute h-full rounded-full" style={{ width: `${a.current}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-3">
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Rebalancing summary</p>
                {allocations.filter(a => absDrift(a) > 0.5).map(a => {
                  const d = drift(a)
                  const amt = Math.abs((d / 100) * totalValue)
                  return (
                    <div key={a.symbol} className="flex justify-between text-xs text-[#737373] py-1 border-b border-[#ffffff05]">
                      <span>{d > 0 ? 'Sell' : 'Buy'} {a.symbol}</span>
                      <span className={d > 0 ? 'text-red-400' : 'text-[#0C8B44]'}>{d > 0 ? '-' : '+'}${amt.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
