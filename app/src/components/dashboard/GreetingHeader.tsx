// Greeting header — replaces "Dashboard" title with "Good evening, Phillip"
// plus a live status dot.

import { useMemo } from 'react'
import { greetingFor } from '../../lib/streak'

export default function GreetingHeader({ name, lastUpdated }: { name: string; lastUpdated: Date }) {
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
    </div>
  )
}
