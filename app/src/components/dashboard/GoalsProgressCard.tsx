// Goals progress widget. Picks the user's nearest-deadline goal (or the
// first wealth goal) and shows a progress bar relative to current portfolio
// value, plus on-track / behind / ahead status.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Target, ChevronRight } from 'lucide-react'
import { goalsStore, progressFor, GOALS_EVENT, type Goal } from '../../lib/goalsStore'
import { useCurrency } from '../../lib/currencyContext'

export default function GoalsProgressCard({ portfolioValue }: { portfolioValue: number }) {
  const [goals, setGoals] = useState<Goal[]>(goalsStore.list())
  const { format } = useCurrency()

  useEffect(() => {
    const refresh = () => setGoals(goalsStore.list())
    window.addEventListener(GOALS_EVENT, refresh)
    return () => window.removeEventListener(GOALS_EVENT, refresh)
  }, [])

  // Nearest deadline goal first
  const sorted = [...goals].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  const goal = sorted[0]

  if (!goal) {
    return (
      <Link to="/goals" className="block rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-5 hover:border-[#0C8B44]/30 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <Target className="w-4 h-4 text-[#0C8B44]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">Set a financial goal</p>
            <p className="text-[11px] text-[#737373]">Track progress toward what you're building.</p>
          </div>
        </div>
      </Link>
    )
  }

  const p = progressFor(goal, portfolioValue)
  const remaining = goal.target - portfolioValue
  const status = p.onTrack ? 'On track' : 'Behind plan'
  const statusColor = p.onTrack ? '#4CAF50' : '#FF9800'

  return (
    <Link to="/goals" className="block rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-5 hover:border-[#0C8B44]/30 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center shrink-0">
          <Target className="w-4 h-4 text-[#0C8B44]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#E5E5E5] truncate">{goal.title}</p>
          <p className="text-[11px] text-[#737373]">
            <span style={{ color: statusColor }}>{status}</span> · {p.daysLeft}d left
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#555] group-hover:text-[#0C8B44] transition-colors" />
      </div>
      <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden mb-2">
        <div className="h-full rounded-full bg-gradient-to-r from-[#0C8B44] to-[#00E676] transition-all" style={{ width: `${p.pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#A0A0A0]">{p.pct.toFixed(1)}% complete</span>
        <span className="text-[#737373]">{remaining > 0 ? `${format(remaining, { compact: true })} to go` : 'Achieved'}</span>
      </div>
    </Link>
  )
}
