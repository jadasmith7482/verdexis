// Customize widgets dialog — toggles dashboard widget visibility.

import { useEffect, useRef, useState } from 'react'
import { Settings, Check } from 'lucide-react'
import { dashboardLayout, ALL_WIDGETS, DASHBOARD_LAYOUT_EVENT } from '../../lib/dashboardLayout'

export default function CustomizeWidgets() {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(() => dashboardLayout.hidden())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => setHidden(dashboardLayout.hidden())
    window.addEventListener(DASHBOARD_LAYOUT_EVENT, refresh)
    return () => window.removeEventListener(DASHBOARD_LAYOUT_EVENT, refresh)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Customize widgets"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a1a]/80 border border-[#ffffff10] text-xs text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors"
      >
        <Settings className="w-3 h-3" />
        Customize
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0f1619] border border-[#ffffff10] shadow-2xl p-3 z-30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.05em] text-[#737373]">Dashboard widgets</p>
            <button onClick={() => dashboardLayout.reset()} className="text-[10px] text-[#0C8B44] hover:text-[#00E676]">Reset</button>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {ALL_WIDGETS.map((w) => {
              const visible = !hidden.has(w.id)
              return (
                <button
                  key={w.id}
                  onClick={() => dashboardLayout.toggle(w.id)}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#ffffff05] text-left"
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${visible ? 'bg-[#0C8B44] border-[#0C8B44]' : 'border-[#ffffff20]'}`}>
                    {visible && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#E5E5E5] truncate">{w.label}</p>
                    <p className="text-[10px] text-[#737373] truncate">{w.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
