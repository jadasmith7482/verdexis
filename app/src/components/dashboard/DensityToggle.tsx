import { useEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { getDensity, setDensity, type Density } from '../../lib/density'

/** Toolbar button that toggles between Comfortable and Compact card padding. */
export default function DensityToggle() {
  const [d, setD] = useState<Density>(() => getDensity())

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Density>).detail
      if (detail) setD(detail)
    }
    window.addEventListener('verdexis:density', handler)
    return () => window.removeEventListener('verdexis:density', handler)
  }, [])

  const next: Density = d === 'compact' ? 'comfortable' : 'compact'
  return (
    <button
      onClick={() => setDensity(next)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ffffff10] bg-[#1a1a1a]/50 text-xs text-[#A0A0A0] hover:text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors"
      title={`Switch to ${next} density`}
      aria-label={`Switch to ${next} density`}
    >
      {d === 'compact' ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline capitalize">{d}</span>
    </button>
  )
}
