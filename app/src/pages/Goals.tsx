import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { ArrowLeft, Target, Plus, Trash2, TrendingUp, Calendar, CheckCircle, AlertTriangle } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { goalsStore, progressFor, GOALS_EVENT, type Goal } from '../lib/goalsStore'
import { portfolioStore } from '../lib/portfolioStore'

export default function Goals() { return <RequireAuth><GoalsInner /></RequireAuth> }

function GoalsInner() {
  const [goals, setGoals] = useState<Goal[]>(goalsStore.list())
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10))
  const [category, setCategory] = useState<Goal['category']>('wealth')
  const [portfolioValue, setPortfolioValue] = useState(0)

  useEffect(() => {
    const refresh = () => setGoals(goalsStore.list())
    window.addEventListener(GOALS_EVENT, refresh)
    return () => window.removeEventListener(GOALS_EVENT, refresh)
  }, [])

  useEffect(() => {
    const compute = () => {
      const holdings = portfolioStore.getHoldings()
      const wallet = portfolioStore.getWallet()
      const usdRates: Record<string, number> = { USD: 1, BTC: 67432, ETH: 3521, SOL: 178.45, ADA: 0.52 }
      const cash = wallet.reduce((s, w) => s + (w.balance * (usdRates[w.currency] ?? 1)), 0)
      const positions = holdings.reduce((s, h) => s + h.value, 0)
      setPortfolioValue(cash + positions)
    }
    compute()
    window.addEventListener('verdexis:portfolio', compute)
    return () => window.removeEventListener('verdexis:portfolio', compute)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(target)
    if (!title.trim()) { toast.error('Give your goal a name'); return }
    if (!num || num <= 0) { toast.error('Enter a valid target'); return }
    if (!deadline) { toast.error('Pick a deadline'); return }
    goalsStore.add({ title: title.trim(), target: num, currency: 'USD', deadline: new Date(deadline).toISOString(), category })
    toast.success('Goal added')
    setTitle(''); setTarget('')
  }

  const remove = (id: string) => { goalsStore.remove(id); toast.success('Goal removed') }

  const sorted = useMemo(() => [...goals].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()), [goals])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" richColors />
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Target className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Financial Goals</h1>
              <p className="text-xs text-[#737373]">Set targets, track progress, stay on plan.</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Portfolio value</p>
              <p className="text-lg font-light text-[#E5E5E5]">${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 h-fit">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0C8B44]" />New goal
              </h2>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Down payment" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Target (USD)</label>
                  <input type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="50000" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as Goal['category'])} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    <option value="wealth">Net worth</option>
                    <option value="crypto">Crypto</option>
                    <option value="retirement">Retirement</option>
                    <option value="home">Home</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">Add goal</button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-3">
              {sorted.length === 0 ? (
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-12 text-center">
                  <Target className="w-8 h-8 mx-auto text-[#444] mb-3" />
                  <p className="text-sm text-[#A0A0A0]">No goals yet — add one on the left.</p>
                </div>
              ) : sorted.map((g) => {
                const p = progressFor(g, portfolioValue)
                return (
                  <div key={g.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#E5E5E5]">{g.title}</p>
                        <p className="text-[11px] text-[#737373] mt-0.5 inline-flex items-center gap-2">
                          <Calendar className="w-3 h-3" />{new Date(g.deadline).toLocaleDateString()} · {p.daysLeft} days left · <span className="capitalize">{g.category}</span>
                        </p>
                      </div>
                      <button onClick={() => remove(g.id)} aria-label="Remove" className="text-[#555] hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-baseline gap-3 mb-2">
                      <p className="text-2xl font-light text-[#E5E5E5]">${Math.round(portfolioValue).toLocaleString()}</p>
                      <p className="text-xs text-[#737373]">/ ${g.target.toLocaleString()}</p>
                      <span className={`ml-auto text-[11px] inline-flex items-center gap-1 ${p.onTrack ? 'text-[#0C8B44]' : 'text-amber-400'}`}>
                        {p.onTrack ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {p.onTrack ? 'On track' : 'Behind pace'}
                      </span>
                    </div>
                    <div className="relative w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-[#0C8B44]" style={{ width: `${p.pct}%` }} />
                      <div className="absolute inset-y-0 w-px bg-[#ffffff40]" style={{ left: `${p.timeElapsedPct}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-[#737373]">
                      <span><TrendingUp className="w-2.5 h-2.5 inline mr-1" />{p.pct.toFixed(1)}% complete</span>
                      <span>${p.remaining.toLocaleString()} to go</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
