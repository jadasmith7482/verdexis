import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { ArrowLeft, Bell, Trash2, Plus, TrendingUp, TrendingDown } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { api, getToken } from '../lib/api'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { formatPrice } from '@/lib/utils'

interface Alert {
  id: string
  symbol: string
  name: string
  direction: 'above' | 'below'
  target: number
  active: boolean
  triggered: boolean
  createdAt: string
}

export default function Alerts() {
  return <RequireAuth><AlertsInner /></RequireAuth>
}

function AlertsInner() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [coins, setCoins] = useState<CryptoQuote[]>([])
  const [symbol, setSymbol] = useState('BTC')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!getToken()) { setAlerts([]); setLoading(false); return }
    try {
      const r = await api.listAlerts()
      setAlerts(r.alerts)
    } catch { /* offline */ }
    setLoading(false)
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void load()
      void marketData.getCryptoList().then((c) => setCoins(c.slice(0, 30))).catch(() => {})
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(target)
    if (!num || num <= 0) { toast.error('Enter a valid target price'); return }
    const coin = coins.find((c) => (c.symbol || '').toUpperCase() === (symbol || '').toUpperCase())
    try {
      await api.addAlert({ symbol: symbol.toUpperCase(), name: coin?.name || symbol, direction, target: num })
      toast.success('Alert created')
      setTarget('')
      await load()
    } catch {
      toast.error('Could not create alert (is the API offline?)')
    }
  }

  const remove = async (id: string) => {
    try { await api.removeAlert(id); toast.success('Alert removed'); await load() }
    catch { toast.error('Could not remove') }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" richColors />
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Price Alerts</h1>
              <p className="text-xs text-[#737373]">Get notified when an asset crosses your target price.</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 h-fit">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0C8B44]" />New alert
              </h2>
              <form onSubmit={create} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Symbol</label>
                  <select aria-label="Alert symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    {coins.map((c) => (
                      <option key={c.id} value={c.symbol.toUpperCase()}>{c.name} ({c.symbol.toUpperCase()})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Direction</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setDirection('above')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'above' ? 'bg-[#0C8B44]/15 border-[#0C8B44]/40 text-[#0C8B44]' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                      <TrendingUp className="w-3 h-3 inline mr-1" />Above
                    </button>
                    <button type="button" onClick={() => setDirection('below')} className={`py-2 text-xs rounded-lg border transition-colors ${direction === 'below' ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'border-[#ffffff10] text-[#A0A0A0]'}`}>
                      <TrendingDown className="w-3 h-3 inline mr-1" />Below
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Target price (USD)</label>
                  <input type="number" step="any" min="0" value={target} onChange={(e) => setTarget(e.target.value)} required placeholder="e.g. 75000" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">Create alert</button>
              </form>
            </div>

            <div className="lg:col-span-2">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Your alerts ({alerts.length})</h2>
              {loading ? (
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-12 text-center text-xs text-[#737373]">Loading…</div>
              ) : alerts.length === 0 ? (
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-12 text-center">
                  <Bell className="w-8 h-8 mx-auto text-[#444] mb-3" />
                  <p className="text-sm text-[#A0A0A0] mb-1">No alerts yet</p>
                  <p className="text-xs text-[#737373]">Create your first alert on the left.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => (
                    <div key={a.id} className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.direction === 'above' ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : 'bg-red-500/15 text-red-400'}`}>
                          {a.direction === 'above' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm text-[#E5E5E5]">{a.name} <span className="text-[#737373]">({(a.symbol || '').toUpperCase()})</span></p>
                          <p className="text-[11px] text-[#A0A0A0]">When price goes {a.direction} <span className="text-[#E5E5E5]">{formatPrice(a.target)}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.triggered ? 'bg-[#0C8B44]/15 text-[#0C8B44]' : a.active ? 'bg-[#0C8B44]/10 text-[#0C8B44]' : 'bg-[#444]/20 text-[#737373]'}`}>
                          {a.triggered ? 'Triggered' : a.active ? 'Active' : 'Inactive'}
                        </span>
                        <button onClick={() => remove(a.id)} aria-label="Delete" className="text-[#555] hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
