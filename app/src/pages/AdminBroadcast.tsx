import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi } from '../lib/adminApi'
import { ArrowLeft, MegaphoneIcon, Send, AlertTriangle } from 'lucide-react'

const KINDS: Array<{ value: 'system' | 'alert' | 'trade' | 'deposit'; label: string; tone: string }> = [
  { value: 'system', label: 'System', tone: 'text-[#A0A0A0] bg-[#A0A0A0]/10' },
  { value: 'alert', label: 'Alert', tone: 'text-[#F57C00] bg-[#F57C00]/10' },
  { value: 'trade', label: 'Trade', tone: 'text-[#0C8B44] bg-[#0C8B44]/10' },
  { value: 'deposit', label: 'Deposit', tone: 'text-[#4CAF50] bg-[#4CAF50]/10' },
]

export default function AdminBroadcast() {
  const [kind, setKind] = useState<'system' | 'alert' | 'trade' | 'deposit'>('system')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [lastResult, setLastResult] = useState<{ count: number; at: string } | null>(null)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!confirm) { toast.error('Tick the confirmation checkbox first'); return }
    setBusy(true)
    try {
      const r = await adminApi.broadcast({ kind, title: title.trim(), body: body.trim() || undefined })
      toast.success(`Sent to ${r.count} active users`)
      setLastResult({ count: r.count, at: new Date().toLocaleString() })
      setTitle(''); setBody(''); setConfirm(false)
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Broadcast failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[900px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to admin
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-light text-[#E5E5E5] flex items-center gap-3">
            <MegaphoneIcon className="w-6 h-6 text-[#0C8B44]" />Broadcast notification
          </h1>
          <p className="text-xs text-[#737373] mt-1">Push a notification to every non-suspended user on this instance.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={send} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Kind</label>
              <div className="grid grid-cols-4 gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={`px-2 py-2 text-[11px] uppercase tracking-wider rounded-lg border transition-colors ${kind === k.value ? `${k.tone} border-current` : 'border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="e.g. Scheduled maintenance Sunday 02:00 UTC"
                className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              />
              <span className="text-[10px] text-[#737373] mt-1 block">{title.length}/140</span>
            </label>

            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">Body (optional)</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={1000}
                placeholder="Optional details. Plain text only."
                className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44] resize-none"
              />
              <span className="text-[10px] text-[#737373] mt-1 block">{body.length}/1000</span>
            </label>

            <label className="flex items-start gap-2 text-xs text-[#A0A0A0] cursor-pointer">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 accent-[#0C8B44]" />
              <span>I understand this will create a notification record for every active user. This is recorded in the audit log.</span>
            </label>

            <button
              type="submit"
              disabled={busy || !confirm || !title.trim()}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />{busy ? 'Sending…' : 'Send to all active users'}
            </button>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-3">Preview</h2>
              <div className="rounded-xl bg-[#0a0f11] border border-[#ffffff05] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${KINDS.find((k) => k.value === kind)?.tone}`}>{kind}</span>
                  <span className="text-[10px] text-[#737373]">just now</span>
                </div>
                <p className="text-sm text-[#E5E5E5] mb-1">{title || <span className="text-[#737373] italic">Title preview</span>}</p>
                {body && <p className="text-xs text-[#A0A0A0] whitespace-pre-wrap">{body}</p>}
              </div>
            </div>

            <div className="rounded-2xl bg-[#F57C00]/5 border border-[#F57C00]/30 p-4">
              <h3 className="text-xs font-medium text-[#F57C00] mb-1 flex items-center gap-2"><AlertTriangle className="w-3 h-3" />Heads up</h3>
              <p className="text-[11px] text-[#A0A0A0]">Suspended accounts are skipped. The recipient count is logged. There is no recall — once sent, users will see it on next refresh of their notification bell.</p>
            </div>

            {lastResult && (
              <div className="rounded-2xl bg-[#0C8B44]/5 border border-[#0C8B44]/30 p-4">
                <p className="text-xs text-[#0C8B44]">Last broadcast: delivered to {lastResult.count} users at {lastResult.at}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
