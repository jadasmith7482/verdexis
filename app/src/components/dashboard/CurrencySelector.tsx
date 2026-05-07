// Currency selector dropdown — pill UI, opens a small menu.

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useCurrency, CURRENCY_OPTIONS, type DisplayCurrency } from '../../lib/currencyContext'

export default function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = CURRENCY_OPTIONS.find((o) => o.code === currency) || CURRENCY_OPTIONS[0]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a1a1a]/80 border border-[#ffffff10] text-xs text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors"
      >
        <span className="font-medium">{current.symbol}</span>
        <span className="text-[#A0A0A0]">{current.code}</span>
        <ChevronDown className="w-3 h-3 text-[#737373]" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-[#0f1619] border border-[#ffffff10] shadow-2xl py-1 z-30">
          {CURRENCY_OPTIONS.map((o) => {
            const selected = o.code === currency
            return (
              <button
                key={o.code}
                onClick={() => { setCurrency(o.code as DisplayCurrency); setOpen(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#E5E5E5] hover:bg-[#ffffff05] text-left"
              >
                <span className="w-5 text-center font-medium">{o.symbol}</span>
                <span className="flex-1">{o.label}</span>
                {selected && <Check className="w-3 h-3 text-[#0C8B44]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
