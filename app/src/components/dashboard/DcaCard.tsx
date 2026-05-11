// DCA recurring buy schedules. Lists each active schedule with the
// next-buy countdown. The actual scheduler that fires the buy lives
// inside Dashboard.tsx so it can use portfolioStore.executeTrade with
// live prices already loaded.

import { useEffect, useState } from 'react'
import { CalendarClock, Pause, Play, Trash2 } from 'lucide-react'
import { dcaStore, nextRunMs, DCA_EVENT, type DcaSchedule } from '../../lib/dcaStore'

function msUntil(ms: number): number {
  return ms - Date.now()
}

export default function DcaCard() {
  const [schedules, setSchedules] = useState<DcaSchedule[]>(dcaStore.list())
  const [, setTick] = useState(0)

  useEffect(() => {
    const refresh = () => setSchedules(dcaStore.list())
    window.addEventListener(DCA_EVENT, refresh)
    const t = setInterval(() => setTick((v) => v + 1), 60_000)
    return () => { window.removeEventListener(DCA_EVENT, refresh); clearInterval(t) }
  }, [])

  const fmtCountdown = (ms: number) => {
    if (ms <= 0) return 'Now'
    const d = Math.floor(ms / 86400_000)
    const h = Math.floor((ms % 86400_000) / 3600_000)
    if (d > 0) return `${d}d ${h}h`
    const m = Math.floor((ms % 3600_000) / 60_000)
    return `${h}h ${m}m`
  }

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#FF9800]/15 flex items-center justify-center">
          <CalendarClock className="w-4 h-4 text-[#FF9800]" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-[#E5E5E5]">Recurring Buys</h3>
          <p className="text-[11px] text-[#737373]">Auto DCA schedule</p>
        </div>
      </div>
      {schedules.length === 0 ? (
        <p className="text-xs text-[#737373]">No recurring buys configured.</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => {
            const next = msUntil(nextRunMs(s))
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a]/50">
                <div className="w-9 h-9 rounded-lg bg-[#FF9800]/10 flex items-center justify-center text-[10px] font-bold text-[#FF9800] shrink-0">{s.asset}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#E5E5E5] truncate">${s.amountUsd} every {s.intervalDays}d</p>
                  <p className="text-[10px] text-[#737373]">Next: {s.active ? fmtCountdown(next) : 'Paused'}</p>
                </div>
                <button
                  onClick={() => dcaStore.toggle(s.id)}
                  aria-label={s.active ? 'Pause' : 'Resume'}
                  className="text-[#737373] hover:text-[#0C8B44] p-1"
                >
                  {s.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => dcaStore.remove(s.id)}
                  aria-label="Remove"
                  className="text-[#737373] hover:text-[#f44336] p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
