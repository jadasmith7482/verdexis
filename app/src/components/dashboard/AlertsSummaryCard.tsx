// Compact dashboard widget surfacing active price alerts + how many fired
// today. Falls back to a CTA when the API is offline / user not signed in.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { api, getToken } from '../../lib/api'
import { formatPrice } from '@/lib/utils'

interface Alert {
  id: string
  symbol: string
  direction: 'above' | 'below'
  target: number
  active: boolean
  triggered: boolean
  createdAt: string
}

export default function AlertsSummaryCard() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!getToken()) { setLoaded(true); return }
    let cancelled = false
    const load = async () => {
      try {
        const r = await api.listAlerts()
        if (!cancelled) setAlerts(r.alerts as Alert[])
      } catch { /* offline */ }
      if (!cancelled) setLoaded(true)
    }
    void load()
    const t = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const active = alerts.filter((a) => a.active).length
  const todayMs = Date.now() - 86400_000
  const triggeredToday = alerts.filter((a) => a.triggered && new Date(a.createdAt).getTime() > todayMs).length
  const upcoming = alerts.filter((a) => a.active && !a.triggered).slice(0, 2)

  return (
    <Link to="/alerts" className="block rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-5 hover:border-[#0C8B44]/30 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#FF9800]/15 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-[#FF9800]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#E5E5E5]">Price Alerts</p>
          <p className="text-[11px] text-[#737373]">
            {loaded ? `${active} active · ${triggeredToday} fired today` : 'Loading…'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#555] group-hover:text-[#0C8B44] transition-colors" />
      </div>
      {upcoming.length > 0 ? (
        <div className="space-y-1">
          {upcoming.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-[11px] text-[#A0A0A0]">
              <span>{(a.symbol || '').toUpperCase()}</span>
              <span>{a.direction === 'above' ? '↑' : '↓'} {formatPrice(a.target)}</span>
            </div>
          ))}
        </div>
      ) : loaded ? (
        <p className="text-[11px] text-[#737373]">No alerts set — tap to add one.</p>
      ) : null}
    </Link>
  )
}
