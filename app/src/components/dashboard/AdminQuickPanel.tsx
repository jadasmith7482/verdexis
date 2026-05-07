import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ShieldCheck, ArrowRightLeft, ArrowDownToLine, UserPlus, Search, ExternalLink, Pencil } from 'lucide-react'
import { adminApi, type AdminUserSummary } from '../../lib/adminApi'
import { api } from '../../lib/api'

/**
 * Inline admin console embedded in the Dashboard. Visible only when the
 * server confirms `role === 'admin'`. Lets the operator quickly:
 *  - send funds from the admin treasury to any user (transfer/credit)
 *  - withdraw / deduct funds from any user
 *  - jump to the full admin console for everything else
 */
export default function AdminQuickPanel() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminId, setAdminId] = useState<string>('')
  const [treasury, setTreasury] = useState<number | null>(null)
  const [recent, setRecent] = useState<Array<{ id: string; email: string; name: string; createdAt: string; role: string; suspended: boolean }>>([])

  // Verify admin against the server (don't trust localStorage).
  useEffect(() => {
    let cancelled = false
    api.me().then(({ user }) => {
      if (cancelled) return
      if (user.role === 'admin') {
        setIsAdmin(true)
        setAdminId(user.id)
      }
    }).catch(() => { /* not signed in / network */ })
    return () => { cancelled = true }
  }, [])

  // Pull admin USD balance for the treasury display, plus recent signups.
  useEffect(() => {
    if (!isAdmin || !adminId) return
    let cancelled = false
    adminApi.getUser(adminId).then((d) => {
      if (cancelled) return
      const usd = d.walletBalances.find((b) => b.currency === 'USD')
      setTreasury(usd?.balance ?? 0)
    }).catch(() => {})
    adminApi.stats().then((s) => {
      if (cancelled) return
      setRecent(s.recentSignups || [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [isAdmin, adminId])

  if (!isAdmin) return null

  return (
    <div className="rounded-2xl border border-[#0C8B44]/30 bg-gradient-to-br from-[#0C8B44]/10 to-transparent p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-[#E5E5E5]">Admin console</h2>
            <p className="text-xs text-[#A0A0A0]">
              Treasury: <span className="text-[#0C8B44] font-medium">${treasury == null ? '—' : treasury.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/admin" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-[#0C8B44] border border-[#ffffff10] hover:border-[#0C8B44]/40 rounded-lg transition-colors">
            Full console <ExternalLink className="w-3 h-3" />
          </Link>
          <Link to="/admin/users" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-[#0C8B44] border border-[#ffffff10] hover:border-[#0C8B44]/40 rounded-lg transition-colors">
            Users
          </Link>
          <Link to="/admin/audit" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-[#0C8B44] border border-[#ffffff10] hover:border-[#0C8B44]/40 rounded-lg transition-colors">
            Audit
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <SendCreditCard adminId={adminId} onChanged={() => {
          if (!adminId) return
          adminApi.getUser(adminId).then((d) => {
            const usd = d.walletBalances.find((b) => b.currency === 'USD')
            setTreasury(usd?.balance ?? 0)
          }).catch(() => {})
        }} />
        <WithdrawCard />
      </div>

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#ffffff08]">
        <Link to="/admin/users" className="inline-flex items-center gap-2 px-3 py-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] transition-colors">
          <UserPlus className="w-3.5 h-3.5" /> Create user
        </Link>
        <Link to="/admin/transfer" className="inline-flex items-center gap-2 px-3 py-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] transition-colors">
          <ArrowRightLeft className="w-3.5 h-3.5" /> A→B transfer
        </Link>
        <Link to="/admin/broadcast" className="inline-flex items-center gap-2 px-3 py-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] transition-colors">
          Broadcast
        </Link>
      </div>

      {recent.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#ffffff08]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[#737373]">Recent signups</p>
            <Link to="/admin/users" className="text-xs text-[#A0A0A0] hover:text-[#0C8B44]">View all →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {recent.slice(0, 6).map((u) => (
              <Link
                key={u.id} to={`/admin/users/${u.id}`}
                className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0a0f11]/60 border border-[#ffffff08] rounded-lg hover:border-[#0C8B44]/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs text-[#E5E5E5] truncate">{u.name || '(no name)'}</div>
                  <div className="text-[10px] text-[#737373] truncate">{u.email}</div>
                </div>
                <Pencil className="w-3.5 h-3.5 text-[#0C8B44] shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SendCreditCard({ adminId, onChanged }: { adminId: string; onChanged: () => void }) {
  const [recipient, setRecipient] = useState<AdminUserSummary | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!recipient) { toast.error('Pick a recipient'); return }
    if (recipient.id === adminId) { toast.error("Can't send to yourself"); return }
    const amt = parseFloat(amount)
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter a positive amount'); return }
    setBusy(true)
    try {
      await adminApi.adminTransfer({
        fromUserId: adminId,
        toUserId: recipient.id,
        currency: 'USD',
        amount: amt,
        reason: 'manual_correction',
        note: note || undefined,
        notify: true,
      })
      toast.success(`Sent $${amt.toLocaleString()} to ${recipient.email}`)
      setAmount(''); setNote(''); setRecipient(null)
      onChanged()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Transfer failed')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-[#0a0f11]/60 border border-[#ffffff08] p-4">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="w-4 h-4 text-[#0C8B44]" />
        <h3 className="text-sm font-medium text-[#E5E5E5]">Send funds to user</h3>
      </div>
      <UserPicker label="Recipient" value={recipient} onChange={setRecipient} />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <input
          type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount USD"
          className="px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
        />
        <input
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
          className="px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
        />
      </div>
      <button type="submit" disabled={busy || !recipient || !amount}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">
        {busy ? 'Sending…' : 'Send funds'}
      </button>
    </form>
  )
}

function WithdrawCard() {
  const [target, setTarget] = useState<AdminUserSummary | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) { toast.error('Pick a user'); return }
    const amt = parseFloat(amount)
    if (!isFinite(amt) || amt <= 0) { toast.error('Enter a positive amount'); return }
    setBusy(true)
    try {
      await adminApi.deduct(target.id, {
        currency: 'USD',
        amount: amt,
        reason: 'admin_withdrawal',
        note: note || undefined,
        status: 'completed',
        notify: true,
      })
      toast.success(`Withdrew $${amt.toLocaleString()} from ${target.email}`)
      setAmount(''); setNote(''); setTarget(null)
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Withdrawal failed')
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-[#0a0f11]/60 border border-[#ffffff08] p-4">
      <div className="flex items-center gap-2 mb-3">
        <ArrowDownToLine className="w-4 h-4 text-[#f59e0b]" />
        <h3 className="text-sm font-medium text-[#E5E5E5]">Withdraw from user</h3>
      </div>
      <UserPicker label="User" value={target} onChange={setTarget} />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <input
          type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount USD"
          className="px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
        />
        <input
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / note"
          className="px-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
        />
      </div>
      <button type="submit" disabled={busy || !target || !amount}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#f59e0b] text-black text-sm rounded-lg hover:bg-[#d97706] disabled:opacity-50">
        {busy ? 'Processing…' : 'Withdraw'}
      </button>
    </form>
  )
}

function UserPicker({ label, value, onChange }: { label: string; value: AdminUserSummary | null; onChange: (u: AdminUserSummary | null) => void }) {
  const [q, setQ] = useState('')
  const [options, setOptions] = useState<AdminUserSummary[]>([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const display = useMemo(() => value ? `${value.name || value.email} <${value.email}>` : '', [value])

  // Load the full user list on first focus so the admin sees everyone
  // immediately. Search just filters this list.
  function loadAll() {
    if (loaded || value) return
    adminApi.listUsers({ page: 1, limit: 200 })
      .then((r) => { setOptions(r.users); setLoaded(true) })
      .catch(() => {})
  }

  useEffect(() => {
    if (!q || value) return
    const t = setTimeout(() => {
      adminApi.listUsers({ q, page: 1, limit: 50 }).then((r) => setOptions(r.users)).catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [q, value])

  if (value) {
    return (
      <div>
        <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{label}</label>
        <div className="flex items-center justify-between px-3 py-2 bg-[#070C0E] border border-[#0C8B44]/40 rounded-lg">
          <div className="text-sm text-[#E5E5E5] truncate">{display}</div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <Link to={`/admin/users/${value.id}`} className="text-xs text-[#0C8B44] hover:underline inline-flex items-center gap-1">
              Edit <ExternalLink className="w-3 h-3" />
            </Link>
            <button type="button" onClick={() => onChange(null)} className="text-xs text-[#A0A0A0] hover:text-[#f44336]">Change</button>
          </div>
        </div>
      </div>
    )
  }

  const filtered = q
    ? options
    : options
  return (
    <div className="relative">
      <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{label}</label>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => { setOpen(true); loadAll() }}
          placeholder="Click to see all users, or search by email/name/ID"
          className="w-full pl-9 pr-3 py-2 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-[#0a0f11] border border-[#ffffff10] rounded-lg max-h-64 overflow-y-auto shadow-xl">
          <div className="sticky top-0 bg-[#0a0f11] px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#737373] border-b border-[#ffffff08]">
            {filtered.length} user{filtered.length === 1 ? '' : 's'}
          </div>
          {filtered.map((u) => (
            <button
              key={u.id} type="button"
              onClick={() => { onChange(u); setOpen(false); setQ('') }}
              className="w-full text-left px-3 py-2 hover:bg-[#0C8B44]/10 text-sm text-[#E5E5E5] border-b border-[#ffffff05] last:border-0"
            >
              <div className="truncate">{u.name || '(no name)'} <span className="text-[#737373]">&lt;{u.email}&gt;</span></div>
              <div className="text-[10px] text-[#737373]">{u.role} · {u.suspended ? 'suspended' : 'active'} · {u.investmentId ?? '—'}</div>
            </button>
          ))}
        </div>
      )}
      {open && loaded && filtered.length === 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-[#0a0f11] border border-[#ffffff10] rounded-lg px-3 py-3 text-xs text-[#737373]">
          No users found.
        </div>
      )}
    </div>
  )
}
