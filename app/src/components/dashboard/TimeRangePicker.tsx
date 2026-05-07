// Time-range picker for the net-worth chart. Pure UI; the parent picks
// which sparkline window to render.

export type ChartRange = '1D' | '1W' | '1M' | '1Y' | 'ALL'

export const CHART_RANGES: ChartRange[] = ['1D', '1W', '1M', '1Y', 'ALL']

export default function TimeRangePicker({ value, onChange }: { value: ChartRange; onChange: (r: ChartRange) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-[#1a1a1a]/80 border border-[#ffffff08] p-0.5">
      {CHART_RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded-full transition-colors ${value === r ? 'bg-[#0C8B44] text-white' : 'text-[#A0A0A0] hover:text-[#E5E5E5]'}`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
