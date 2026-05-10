import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Webhook, Plus, Trash2, CheckCircle, Copy, Eye, EyeOff } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'

interface WebhookEntry {
  id: string
  url: string
  events: string[]
  active: boolean
  lastTriggered: string | null
  secret: string
}

interface ApiKey {
  id: string
  name: string
  key: string
  permissions: string[]
  created: string
  lastUsed: string | null
}

const EVENT_TYPES = [
  'price.alert.triggered',
  'deposit.received',
  'withdrawal.completed',
  'trade.executed',
  'goal.reached',
  'account.login',
]

const MOCK_WEBHOOKS: WebhookEntry[] = [
  { id: '1', url: 'https://hooks.slack.com/services/XXX/YYY/ZZZ', events: ['price.alert.triggered', 'deposit.received'], active: true, lastTriggered: '2026-05-09T14:22:00Z', secret: 'whsec_abc123' },
]

const MOCK_KEYS: ApiKey[] = [
  { id: '1', name: 'Trading Bot', key: 'vdx_live_sk_••••••••••••••••3f8a', permissions: ['read', 'trade'], created: '2026-03-12', lastUsed: '2026-05-10' },
]

export default function Integrations() { return <RequireAuth><IntegrationsInner /></RequireAuth> }

function IntegrationsInner() {
  const [tab, setTab] = useState<'webhooks' | 'api'>('webhooks')
  const [webhooks, setWebhooks] = useState(MOCK_WEBHOOKS)
  const [apiKeys] = useState(MOCK_KEYS)
  const [creating, setCreating] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>([])
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  const toggleEvent = (ev: string) => {
    setNewEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])
  }

  const addWebhook = () => {
    if (!newUrl.trim()) { toast.error('Enter a URL'); return }
    if (newEvents.length === 0) { toast.error('Select at least one event'); return }
    try { new URL(newUrl) } catch { toast.error('Invalid URL'); return }
    const wh: WebhookEntry = { id: Date.now().toString(), url: newUrl.trim(), events: newEvents, active: true, lastTriggered: null, secret: `whsec_${Math.random().toString(36).slice(2, 14)}` }
    setWebhooks(prev => [...prev, wh])
    setCreating(false); setNewUrl(''); setNewEvents([])
    toast.success('Webhook created')
  }

  const removeWebhook = (id: string) => { setWebhooks(prev => prev.filter(w => w.id !== id)); toast.success('Webhook removed') }
  const toggleWebhook = (id: string) => { setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w)) }

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/settings" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to settings
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Integrations</h1>
              <p className="text-xs text-[#737373]">Webhooks, API keys & third-party connections.</p>
            </div>
          </div>

          <div className="flex gap-4 border-b border-[#ffffff08] mb-6">
            {(['webhooks', 'api'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`pb-3 text-xs uppercase tracking-[0.05em] transition-colors ${tab === t ? 'text-[#0C8B44] border-b-2 border-[#0C8B44]' : 'text-[#737373] hover:text-[#E5E5E5]'}`}>
                {t === 'api' ? 'API Keys' : 'Webhooks'}
              </button>
            ))}
          </div>

          {tab === 'webhooks' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-[#737373]">Receive HTTP POST notifications when events occur in your account.</p>
                <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">
                  <Plus className="w-3 h-3" />Add Webhook
                </button>
              </div>

              {creating && (
                <div className="rounded-2xl bg-[#0f1619]/50 border border-[#0C8B44]/30 p-5 mb-4">
                  <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">New Webhook</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Endpoint URL</label>
                      <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://your-server.com/webhook" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Events to Subscribe</label>
                      <div className="flex flex-wrap gap-2">
                        {EVENT_TYPES.map(ev => (
                          <button key={ev} onClick={() => toggleEvent(ev)} className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${newEvents.includes(ev) ? 'bg-[#0C8B44]/20 text-[#0C8B44] border border-[#0C8B44]/30' : 'bg-[#0a0f11] border border-[#ffffff10] text-[#737373]'}`}>
                            {ev}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setCreating(false)} className="flex-1 py-2 border border-[#ffffff10] text-xs text-[#737373] rounded-lg hover:text-[#E5E5E5] transition-colors">Cancel</button>
                      <button onClick={addWebhook} className="flex-1 py-2 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">Create Webhook</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {webhooks.map(wh => (
                  <div key={wh.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${wh.active ? 'bg-[#0C8B44]' : 'bg-[#737373]'}`} />
                        <p className="text-xs text-[#E5E5E5] font-mono truncate">{wh.url}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleWebhook(wh.id)} className={`text-[10px] px-2 py-1 rounded transition-colors ${wh.active ? 'text-[#0C8B44] bg-[#0C8B44]/10 hover:bg-[#0C8B44]/20' : 'text-[#737373] bg-[#ffffff08] hover:bg-[#ffffff15]'}`}>
                          {wh.active ? 'Active' : 'Paused'}
                        </button>
                        <button onClick={() => removeWebhook(wh.id)} className="p-1 rounded hover:bg-red-500/10 text-[#737373] hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {wh.events.map(ev => (
                        <span key={ev} className="text-[10px] font-mono px-2 py-0.5 bg-[#0a0f11] border border-[#ffffff08] rounded text-[#737373]">{ev}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-[#737373]">
                      <span>Last triggered: {wh.lastTriggered ? new Date(wh.lastTriggered).toLocaleString() : 'Never'}</span>
                      <button onClick={() => copy(wh.secret)} className="flex items-center gap-1 hover:text-[#E5E5E5] transition-colors">
                        <Copy className="w-3 h-3" />Copy secret
                      </button>
                    </div>
                  </div>
                ))}
                {webhooks.length === 0 && !creating && (
                  <div className="text-center py-10 text-xs text-[#737373]">No webhooks yet. Create one to receive event notifications.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'api' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-[#737373]">API keys allow programmatic access for trading bots and automation.</p>
                <button onClick={() => toast.info('API key generation — coming soon')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">
                  <Plus className="w-3 h-3" />Generate Key
                </button>
              </div>

              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5 mb-4">
                <h3 className="text-xs font-medium text-[#E5E5E5] mb-2">Available Permissions</h3>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#737373]">
                  {[
                    ['read', 'View balances, history, positions'],
                    ['trade', 'Place and cancel orders'],
                    ['withdraw', 'Initiate withdrawals (careful!)'],
                    ['alerts', 'Create and manage price alerts'],
                  ].map(([perm, desc]) => (
                    <div key={perm} className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-[#0C8B44] shrink-0 mt-0.5" />
                      <span><span className="text-[#E5E5E5] font-mono">{perm}</span> — {desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {apiKeys.map(k => (
                  <div key={k.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <p className="text-xs font-medium text-[#E5E5E5]">{k.name}</p>
                        <p className="text-[10px] text-[#737373] font-mono mt-0.5">{showSecrets[k.id] ? k.key.replace(/•+/, 'sk_live_actual_key_would_be_here') : k.key}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setShowSecrets(prev => ({ ...prev, [k.id]: !prev[k.id] }))} className="p-1 rounded hover:bg-[#ffffff08] text-[#737373] hover:text-[#E5E5E5] transition-colors">
                          {showSecrets[k.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => copy(k.key)} className="p-1 rounded hover:bg-[#ffffff08] text-[#737373] hover:text-[#E5E5E5] transition-colors">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {k.permissions.map(p => (
                        <span key={p} className="text-[10px] font-mono px-2 py-0.5 bg-[#0C8B44]/10 border border-[#0C8B44]/20 rounded text-[#0C8B44]">{p}</span>
                      ))}
                    </div>
                    <div className="text-[10px] text-[#737373]">Created {k.created} · Last used {k.lastUsed ?? 'never'}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-4">
                <p className="text-xs font-medium text-[#E5E5E5] mb-2">Base URL</p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-[#737373] font-mono flex-1">https://api.verdexis.com/v1</p>
                  <button onClick={() => copy('https://api.verdexis.com/v1')} className="p-1 rounded hover:bg-[#ffffff08] text-[#737373] transition-colors"><Copy className="w-3 h-3" /></button>
                </div>
                <p className="text-[10px] text-[#737373] mt-2">Full API documentation available at <span className="text-[#0C8B44]">docs.verdexis.com</span></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
