import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { marketData, type CryptoQuote } from '../lib/marketData'

interface Item {
  label: string
  hint?: string
  to: string
  group: string
}

const STATIC_ITEMS: Item[] = [
  { label: 'Dashboard', to: '/dashboard', group: 'Pages' },
  { label: 'Markets', to: '/trading', group: 'Pages' },
  { label: 'Wallet', to: '/wallet', group: 'Pages' },
  { label: 'AI Analyst', to: '/ai', group: 'Pages' },
  { label: 'News', to: '/news', group: 'Pages' },
  { label: 'Settings', to: '/settings', group: 'Pages' },
  { label: 'Price Alerts', to: '/alerts', group: 'Pages' },
  { label: 'Help & Docs', to: '/about', group: 'Pages' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [coins, setCoins] = useState<CryptoQuote[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      void marketData.getCryptoList().then((list) => setCoins(list.slice(0, 50))).catch(() => {})
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActive(0)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const q = query.toLowerCase().trim()
    const coinItems: Item[] = coins.map((c) => ({
      label: `${c.name} (${c.symbol.toUpperCase()})`,
      hint: `$${c.current_price.toLocaleString()}`,
      to: '/trading',
      group: 'Markets',
    }))
    const all = [...STATIC_ITEMS, ...coinItems]
    if (!q) return all.slice(0, 12)
    return all.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 12)
  }, [query, coins])

  useEffect(() => { setActive(0) }, [query])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[active]
      if (item) { navigate(item.to); setOpen(false) }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-[#0f1619] border border-[#ffffff10] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#ffffff08]">
          <Search className="w-4 h-4 text-[#737373]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search markets, pages, settings…"
            className="flex-1 bg-transparent text-sm text-[#E5E5E5] placeholder:text-[#555] focus:outline-none"
          />
          <kbd className="text-[10px] text-[#555] border border-[#ffffff10] rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#737373]">No results.</div>
          ) : (
            items.map((item, idx) => (
              <button
                key={`${item.group}-${item.label}-${idx}`}
                onClick={() => { navigate(item.to); setOpen(false) }}
                onMouseEnter={() => setActive(idx)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm ${idx === active ? 'bg-[#0C8B44]/10 text-[#E5E5E5]' : 'text-[#A0A0A0] hover:bg-[#ffffff05]'}`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-[10px] uppercase text-[#555] w-16">{item.group}</span>
                  <span>{item.label}</span>
                </span>
                <span className="flex items-center gap-2 text-[#555]">
                  {item.hint && <span className="text-[11px]">{item.hint}</span>}
                  <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-[#ffffff08] flex items-center justify-between text-[10px] text-[#555]">
          <span>↑↓ navigate · ↵ select</span>
          <span><kbd className="border border-[#ffffff10] rounded px-1">⌘</kbd> + <kbd className="border border-[#ffffff10] rounded px-1">K</kbd></span>
        </div>
      </div>
    </div>
  )
}
