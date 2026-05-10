// Greeting header — replaces "Dashboard" title with "Good evening, Phillip"
// plus a live status dot.

import { useMemo } from 'react'
import { greetingFor } from '../../lib/streak'

export default function GreetingHeader({ name, lastUpdated, roleLabel, verified }: { name: string; lastUpdated: Date; roleLabel?: 'User' | 'Admin'; verified?: boolean }) {
  const greeting = useMemo(() => greetingFor(name || 'there'), [name])

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">{greeting}</h1>
          {roleLabel && (
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${roleLabel === 'Admin' ? 'text-[#0C8B44] bg-[#0C8B44]/10 border border-[#0C8B44]/30' : 'text-[#737373] bg-[#1a1a1a] border border-[#ffffff12]'}`}>
              {roleLabel}
            </span>
          )}
          {verified && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/30">
              <span className="w-3 h-3 rounded-full bg-[#3b82f6] flex items-center justify-center text-[8px] leading-none text-white">✓</span>
              Verified
            </span>
          )}
        </div>
        <p className="text-sm text-[#737373] mt-1 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0C8B44] animate-pulse" />
          Live · Last updated {lastUpdated.toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}
