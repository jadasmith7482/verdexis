import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminSignupBonusSettings } from '../lib/adminApi'
import { ArrowLeft, Gift, Save } from 'lucide-react'

const DEFAULT_SETTINGS: AdminSignupBonusSettings = {
  enabled: false,
  amountUsd: 0,
  note: '',
}

export default function AdminSignupBonus() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<AdminSignupBonusSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    adminApi.getSignupBonus()
      .then((data) => setForm({ ...DEFAULT_SETTINGS, ...data }))
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load signup bonus settings'))
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const next = await adminApi.setSignupBonus({
        enabled: form.enabled,
        amountUsd: Number(form.amountUsd) || 0,
        note: form.note?.trim() || '',
      })
      setForm({ ...DEFAULT_SETTINGS, ...next })
      toast.success('Signup bonus updated')
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Failed to save signup bonus')
    } finally {
      setSaving(false)
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
            <Gift className="w-6 h-6 text-[#0C8B44]" />Signup bonus
          </h1>
          <p className="text-sm text-[#737373] mt-2">Configure the automatic bonus new users receive immediately after creating an account.</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-6">
          {loading ? (
            <p className="text-sm text-[#737373]">Loading settings…</p>
          ) : (
            <>
              <label className="flex items-start gap-3 rounded-xl border border-[#ffffff08] bg-[#0a0e10] px-4 py-4">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((curr) => ({ ...curr, enabled: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-[#2a2f33] bg-[#070C0E] text-[#0C8B44] focus:ring-[#0C8B44]"
                />
                <span>
                  <span className="block text-sm text-[#E5E5E5]">Enable signup bonus</span>
                  <span className="block text-xs text-[#737373] mt-1">When enabled, every newly created account gets the configured USD credit automatically.</span>
                </span>
              </label>

              <div>
                <label htmlFor="amountUsd" className="block text-xs uppercase tracking-wider text-[#737373] mb-2">Bonus amount (USD)</label>
                <input
                  id="amountUsd"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountUsd}
                  onChange={(e) => setForm((curr) => ({ ...curr, amountUsd: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[#ffffff10] bg-[#0a0e10] px-4 py-3 text-[#E5E5E5] outline-none focus:border-[#0C8B44]"
                  placeholder="25"
                />
              </div>

              <div>
                <label htmlFor="note" className="block text-xs uppercase tracking-wider text-[#737373] mb-2">User-facing note</label>
                <textarea
                  id="note"
                  value={form.note || ''}
                  onChange={(e) => setForm((curr) => ({ ...curr, note: e.target.value }))}
                  rows={4}
                  maxLength={300}
                  className="w-full rounded-xl border border-[#ffffff10] bg-[#0a0e10] px-4 py-3 text-[#E5E5E5] outline-none focus:border-[#0C8B44]"
                  placeholder="Welcome to Verdexis — your signup bonus has been credited."
                />
                <p className="mt-2 text-xs text-[#737373]">This appears in the credited transaction reference and the in-app notification.</p>
              </div>

              <div className="rounded-xl border border-[#ffffff08] bg-[#0a0e10] px-4 py-4">
                <p className="text-xs uppercase tracking-wider text-[#737373] mb-2">Preview</p>
                <p className="text-sm text-[#E5E5E5]">{form.enabled && form.amountUsd > 0 ? `New users will receive $${form.amountUsd.toFixed(2)} on signup.` : 'Signup bonus is currently disabled.'}</p>
                {!!form.note?.trim() && <p className="text-xs text-[#A0A0A0] mt-2">“{form.note.trim()}”</p>}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0C8B44] px-4 py-2.5 text-sm text-white hover:bg-[#0a7539] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save signup bonus'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
