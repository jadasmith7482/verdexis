// Greeting header — replaces "Dashboard" title with "Good evening, Phillip"
// plus a streak badge and a live status dot.

import { useEffect, useMemo, useState } from 'react'
import { Flame } from 'lucide-react'
import { recordVisit, greetingFor } from '../../lib/streak'

export default function GreetingHeader({ name, lastUpdated }: { name: string; lastUpdated: Date }) {
  const [streak, setStreak] = useState(() => recordVisit())

  useEffect(() => { setStreak(recordVisit()) }, [])

  const greeting = useMemo(() => greetingFor(name || 'there'), [name])

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">{greeting}</h1>
        <p className="text-sm text-[#737373] mt-1 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0C8B44] animate-pulse" />
          Live · Last updated {lastUpdated.toLocaleTimeString()}
        </p>
      </div>
      {streak.count > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF9800]/10 border border-[#FF9800]/20 self-start md:self-auto">
          <Flame className="w-3.5 h-3.5 text-[#FF9800]" />
          <span className="text-xs text-[#E5E5E5]">{streak.count}-day streak</span>
          {streak.best > streak.count && (
            <span className="text-[10px] text-[#737373]">· best {streak.best}</span>
          )}
        </div>
      )}
    </div>
  )
}
