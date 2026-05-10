import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Plus, Pause, Play, Trash2, Repeat } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'

const FREQUENCIES = ['Daily', 'Weekly', 'Biweekly', 'Monthly'] as const
const ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'UNI']

interface DCASchedule {
  id: string
  asset: string
  amount: number
  frequency: typeof FREQUENCIES[number]
  nextRun: string
  paused: boolean
  totalInvested: number
  avgCost: number
  currentValue: number
  runs: number
}

const PRICES: Record<string, number> = { BTC: 62400, ETH: 3180, SOL: 142, BNB: 590, XRP: 0.52, ADA: 0.42, DOGE: 0.109, AVAX: 28.5, LINK: 13.2, UNI: 8.65 }

function nextRunDate(freq: typeof FREQUENCIES[number]): string {
  const d = new Date()
  if (freq === 'Daily') d.setDate(d.getDate() + 1)
  else if (freq === 'Weekly') d.setDate(d.getDate() + 7)
  else if (freq === 'Biweekly') d.setDate(d.getDate() + 14)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

const STORAGE_KEY = 'verdexis_dca_schedules'

function load(): DCASchedule[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? [] } catch { return [] }
}

function save(s: DCASchedule[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

export default function DCAScheduler() { return <RequireAuth><DCASchedulerInner /></RequireAuth> }

function DCASchedulerInner() {
  const [schedules, setSchedules] = useState<DCASchedule[]>(load)
  const [creating, setCreating] = useState(false)
  const [newAsset, setNewAsset] = useState(ASSETS[0])
  const [newAmount, setNewAmount] = useState('50')
  const [newFreq, setNewFreq] = useState<typeof FREQUENCIES[number]>('Weekly')

  useEffect(() => { save(schedules) }, [schedules])

  const totalInvested = schedules.reduce((s, sc) => s + sc.totalInvested, 0)
  const totalValue = schedules.reduce((s, sc) => s + sc.currentValue, 0)

  const create = () => {
    const amt = parseFloat(newAmount)
    if (!amt || amt < 5) { toast.error('Minimum $5 per purchase'); return }
    const price = PRICES[newAsset] ?? 1
    const sc: DCASchedule = {
      id: Date.now().toString(),
      asset: newAsset,
      amount: amt,
      frequency: newFreq,
      nextRun: nextRunDate(newFreq),
      paused: false,
      totalInvested: amt * 4,
      avgCost: price * 0.94,
      currentValue: (amt * 4 / (price * 0.94)) * price,
      runs: 4,
    }
    setSchedules(prev => [...prev, sc])
    setCreating(false); setNewAmount('50')
    toast.success(`DCA schedule created for ${newAsset}`)
  }

  const togglePause = (id: string) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, paused: !s.paused } : s))
  }

  const remove = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id))
    toast.success('Schedule removed')
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
                <Repeat className="w-5 h-5 text-[#0C8B44]" />
              </div>
              <div>
                <h1 className="text-2xl font-light text-[#E5E5E5]">DCA Scheduler</h1>
                <p className="text-xs text-[#737373]">Automate recurring crypto purchases to reduce market timing risk.</p>
              </div>
            </div>
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-2 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">
              <Plus className="w-3 h-3" />New Schedule
            </button>
          </div>

          {/* Summary */}
          {schedules.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">Total Invested</p>
                <p className="text-xl font-light text-[#E5E5E5]">${totalInvested.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">Current Value</p>
                <p className="text-xl font-light text-[#E5E5E5]">${totalValue.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">Total Return</p>
                <p className={`text-xl font-light ${totalValue >= totalInvested ? 'text-[#0C8B44]' : 'text-red-400'}`}>
                  {totalValue >= totalInvested ? '+' : ''}{((totalValue - totalInvested) / totalInvested * 100).toFixed(2)}%
                </p>
              </div>
            </div>
          )}

          {/* Create form */}
          {creating && (
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#0C8B44]/30 p-6 mb-6">
              <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">New DCA Schedule</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Asset</label>
                  <select aria-label="Asset" value={newAsset} onChange={e => setNewAsset(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    {ASSETS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Amount (USD)</label>
                  <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} min="5" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Frequency</label>
                  <select aria-label="Frequency" value={newFreq} onChange={e => setNewFreq(e.target.value as typeof newFreq)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCreating(false)} className="flex-1 py-2 border border-[#ffffff10] text-xs text-[#737373] rounded-lg hover:text-[#E5E5E5] transition-colors">Cancel</button>
                <button onClick={create} className="flex-1 py-2 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">Create Schedule</button>
              </div>
            </div>
          )}

          {/* Schedule list */}
          {schedules.length === 0 && !creating ? (
            <div className="text-center py-20">
              <Repeat className="w-10 h-10 text-[#737373] mx-auto mb-4" />
              <p className="text-sm text-[#737373] mb-2">No DCA schedules yet</p>
              <p className="text-xs text-[#737373]/60 mb-6">Dollar-cost averaging reduces the impact of volatility on your portfolio.</p>
              <button onClick={() => setCreating(true)} className="px-4 py-2 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">Create your first schedule</button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map(sc => {
                const pnl = sc.currentValue - sc.totalInvested
                const pnlPct = (pnl / sc.totalInvested) * 100
                const daysUntil = Math.ceil((new Date(sc.nextRun).getTime() - Date.now()) / 86400000)
                return (
                  <div key={sc.id} className={`rounded-2xl border p-5 transition-colors ${sc.paused ? 'bg-[#0f1619]/30 border-[#ffffff05]' : 'bg-[#0f1619]/50 border-[#ffffff08] hover:border-[#ffffff15]'}`}>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                          <RefreshCw className={`w-4 h-4 text-[#0C8B44] ${!sc.paused ? 'animate-spin-slow' : ''}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#E5E5E5]">{sc.asset}</p>
                            {sc.paused && <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">Paused</span>}
                          </div>
                          <p className="text-[11px] text-[#737373]">${sc.amount} / {sc.frequency} · Next run in {daysUntil}d ({sc.nextRun})</p>
                        </div>
                      </div>

                      <div className="flex gap-6 text-center">
                        <div>
                          <p className="text-xs text-[#E5E5E5]">${sc.totalInvested.toLocaleString()}</p>
                          <p className="text-[10px] text-[#737373]">Invested</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#E5E5E5]">${sc.currentValue.toFixed(2)}</p>
                          <p className="text-[10px] text-[#737373]">Value</p>
                        </div>
                        <div>
                          <p className={`text-xs ${pnl >= 0 ? 'text-[#0C8B44]' : 'text-red-400'}`}>{pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%</p>
                          <p className="text-[10px] text-[#737373]">Return</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#E5E5E5]">{sc.runs}</p>
                          <p className="text-[10px] text-[#737373]">Runs</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => togglePause(sc.id)} className="p-2 rounded-lg border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5] hover:border-[#ffffff20] transition-colors">
                          {sc.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => remove(sc.id)} className="p-2 rounded-lg border border-[#ffffff10] text-[#737373] hover:text-red-400 hover:border-red-500/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
