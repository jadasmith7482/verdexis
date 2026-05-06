import { useEffect, useState } from 'react'
import { Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, getToken } from '../lib/api'

interface Item { id: string; symbol: string; name: string; type: string }

export default function WatchlistPanel({ availableSymbols, onSelect }: { availableSymbols: { symbol: string; name: string }[]; onSelect?: (s: string) => void }) {
  const [items, setItems] = useState<Item[]>([])

  const load = async () => {
    if (!getToken()) { setItems([]); return }
    try { const r = await api.listWatchlist(); setItems(r.watchlist) } catch { /* offline */ }
  }
  useEffect(() => { void load(); window.addEventListener('verdexis:profile', load); return () => window.removeEventListener('verdexis:profile', load) }, [])

  const add = async (s: { symbol: string; name: string }) => {
    if (!getToken()) { toast.error('Sign in to use the watchlist'); return }
    try { await api.addWatch({ symbol: s.symbol.toUpperCase(), name: s.name, type: 'crypto' }); await load() }
    catch { toast.error('Could not add') }
  }
  const remove = async (symbol: string) => {
    if (!getToken()) return
    try { await api.removeWatch(symbol); await load() } catch { /* ignore */ }
  }

  const watchedSet = new Set(items.map((i) => i.symbol.toUpperCase()))

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-[#0C8B44]" />
        <h3 className="text-sm font-medium text-[#E5E5E5]">Watchlist</h3>
        <span className="ml-auto text-[10px] text-[#555]">{items.length} pinned</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[#737373] mb-4">Pin your favourite assets — they'll show here on every visit.</p>
      ) : (
        <div className="space-y-1 mb-4">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#ffffff05] group">
              <button className="text-left text-sm text-[#E5E5E5] flex-1" onClick={() => onSelect?.(i.symbol)}>
                <span className="font-medium">{i.symbol}</span>
                <span className="text-[#737373] ml-2 text-xs">{i.name}</span>
              </button>
              <button onClick={() => remove(i.symbol)} aria-label="Remove" className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-all">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {availableSymbols.length > 0 && (
        <div className="border-t border-[#ffffff08] pt-3">
          <p className="text-[10px] uppercase tracking-[0.05em] text-[#555] mb-2">Quick add</p>
          <div className="flex flex-wrap gap-1">
            {availableSymbols.slice(0, 8).map((s) => {
              const watched = watchedSet.has(s.symbol.toUpperCase())
              return (
                <button
                  key={s.symbol}
                  onClick={() => watched ? remove(s.symbol.toUpperCase()) : add(s)}
                  className={`text-[11px] px-2 py-1 rounded border transition-colors ${watched ? 'bg-[#0C8B44]/15 border-[#0C8B44]/30 text-[#0C8B44]' : 'border-[#ffffff10] text-[#A0A0A0] hover:border-[#0C8B44]/30'}`}
                >
                  {watched && <Star className="w-2.5 h-2.5 inline mr-1 fill-current" />}{s.symbol.toUpperCase()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
