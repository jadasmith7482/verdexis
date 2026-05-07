import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import {
  adminApi, type AdminUserDetailResponse, type AdminHolding,
  type AdminWalletBalance, type AdminTransaction, type AdminTrade,
  type AdminPriceAlert, type AdminWatchItem, type AdminNotification,
  DEPOSIT_REASONS, DEDUCT_REASONS, HOLD_REASONS, HOLD_TYPES,
} from '../lib/adminApi'
import {
  ArrowLeft, ShieldCheck, Ban, KeyRound, LogOut, Trash2,
  Save, Plus, AlertTriangle, User as UserIcon, Wallet, Briefcase,
  ArrowLeftRight, BarChart3, Eye, Bell, Mail, Download,
  ArrowDownToLine, ArrowUpFromLine, Lock, Unlock,
} from 'lucide-react'
import { toCsv, downloadFile } from '../lib/csvExport'

type Tab = 'profile' | 'wallet' | 'holdings' | 'transactions' | 'trades' | 'watchlist' | 'alerts' | 'notifications' | 'danger'

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<AdminUserDetailResponse | null>(null)
  const [tab, setTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(true)

  function reload() {
    if (!id) return
    setLoading(true)
    adminApi.getUser(id)
      .then(setData)
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load user'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="max-w-[1200px] mx-auto px-6 py-12 text-center text-[#737373] text-sm">Loading…</div>
      </div>
    )
  }

  const u = data.user
  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode; count?: number }> = [
    { key: 'profile', label: 'Profile', icon: <UserIcon className="w-4 h-4" /> },
    { key: 'wallet', label: 'Wallet', icon: <Wallet className="w-4 h-4" />, count: data.walletBalances.length },
    { key: 'holdings', label: 'Holdings', icon: <Briefcase className="w-4 h-4" />, count: data.holdings.length },
    { key: 'transactions', label: 'Transactions', icon: <ArrowLeftRight className="w-4 h-4" />, count: data.transactions.length },
    { key: 'trades', label: 'Trades', icon: <BarChart3 className="w-4 h-4" />, count: data.trades.length },
    { key: 'watchlist', label: 'Watchlist', icon: <Eye className="w-4 h-4" />, count: data.watchlist.length },
    { key: 'alerts', label: 'Alerts', icon: <Bell className="w-4 h-4" />, count: data.alerts.length },
    { key: 'notifications', label: 'Notifications', icon: <Mail className="w-4 h-4" />, count: data.notifications.length },
    { key: 'danger', label: 'Danger zone', icon: <AlertTriangle className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />All users
        </Link>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl font-light text-[#E5E5E5]">{u.name}</h1>
          {u.role === 'admin' && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-2 py-0.5 rounded"><ShieldCheck className="w-3 h-3" />Admin</span>}
          {u.suspended && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#f44336] bg-[#f44336]/10 px-2 py-0.5 rounded"><Ban className="w-3 h-3" />Suspended</span>}
          {u.holdActive && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#F57C00] bg-[#F57C00]/10 px-2 py-0.5 rounded"><Lock className="w-3 h-3" />Hold: {u.holdType}</span>}
        </div>
        <p className="text-xs text-[#737373] mb-6">{u.email} · ID {u.id} · joined {new Date(u.createdAt).toLocaleDateString()}</p>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-6 border-b border-[#ffffff05] pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-3 py-2 text-xs rounded-t-lg border-b-2 transition-colors ${tab === t.key ? 'border-[#0C8B44] text-[#0C8B44] bg-[#0C8B44]/5' : 'border-transparent text-[#A0A0A0] hover:text-[#E5E5E5]'}`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== undefined && <span className="text-[10px] text-[#737373]">({t.count})</span>}
            </button>
          ))}
        </div>

        {tab === 'profile' && <ProfileTab data={data} onChange={reload} />}
        {tab === 'wallet' && <WalletTab userId={u.id} balances={data.walletBalances} onChange={reload} />}
        {tab === 'holdings' && <HoldingsTab userId={u.id} holdings={data.holdings} onChange={reload} />}
        {tab === 'transactions' && <TransactionsTab userId={u.id} txs={data.transactions} onChange={reload} />}
        {tab === 'trades' && <TradesTab userId={u.id} trades={data.trades} onChange={reload} />}
        {tab === 'watchlist' && <WatchlistTab items={data.watchlist} onChange={reload} />}
        {tab === 'alerts' && <AlertsTab userId={u.id} alerts={data.alerts} onChange={reload} />}
        {tab === 'notifications' && <NotificationsTab userId={u.id} notifications={data.notifications} onChange={reload} />}
        {tab === 'danger' && <DangerTab userId={u.id} onDeleted={() => navigate('/admin/users')} />}
      </div>
    </div>
  )
}

// ---------- Profile ----------
function ProfileTab({ data, onChange }: { data: AdminUserDetailResponse; onChange: () => void }) {
  const u = data.user
  const [name, setName] = useState(u.name)
  const [email, setEmail] = useState(u.email)
  const [role, setRole] = useState<'user' | 'admin'>(u.role)
  const [suspended, setSuspended] = useState(u.suspended)
  const [suspendedReason, setSuspendedReason] = useState(u.suspendedReason ?? '')
  const [twoFactor, setTwoFactor] = useState(u.twoFactor)
  const [prefs, setPrefs] = useState(JSON.stringify(u.prefs, null, 2))
  const [newPassword, setNewPassword] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    let parsedPrefs: Record<string, unknown>
    try { parsedPrefs = JSON.parse(prefs || '{}') } catch { toast.error('Prefs is not valid JSON'); return }
    try {
      await adminApi.patchUser(u.id, { name, email, role, suspended, suspendedReason: suspendedReason || null, twoFactor, prefs: parsedPrefs })
      toast.success('Profile updated')
      onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Update failed') }
  }

  async function setPwd() {
    if (newPassword.length < 8) { toast.error('Password must be 8+ chars'); return }
    try {
      await adminApi.setPassword(u.id, newPassword, true)
      setNewPassword('')
      toast.success('Password reset and sessions revoked')
    } catch (err) { toast.error((err as { error?: string }).error || 'Reset failed') }
  }

  async function revoke() {
    try {
      await adminApi.revokeSessions(u.id)
      toast.success('All sessions revoked')
      onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={save} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-3">
        <h2 className="text-sm font-medium text-[#E5E5E5] mb-2">Profile</h2>
        <Input label="Name" value={name} onChange={setName} />
        <Input label="Email" value={email} onChange={setEmail} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" value={role} onChange={(v) => setRole(v as 'user' | 'admin')} options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]} />
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">2FA</label>
            <button type="button" onClick={() => setTwoFactor(!twoFactor)} className={`px-3 py-2 rounded-lg border text-sm ${twoFactor ? 'border-[#0C8B44] bg-[#0C8B44]/10 text-[#0C8B44]' : 'border-[#ffffff10] bg-[#0a0f11] text-[#A0A0A0]'}`}>{twoFactor ? 'Enabled' : 'Disabled'}</button>
          </div>
        </div>
        <div>
          <button type="button" onClick={() => setSuspended(!suspended)} className={`w-full px-3 py-2 rounded-lg border text-sm ${suspended ? 'border-[#f44336] bg-[#f44336]/10 text-[#f44336]' : 'border-[#ffffff10] bg-[#0a0f11] text-[#A0A0A0]'}`}>
            {suspended ? '⛔ Suspended — login blocked' : 'Account active — click to suspend'}
          </button>
          {suspended && <Input className="mt-2" label="Suspension reason (shown internally)" value={suspendedReason} onChange={setSuspendedReason} />}
        </div>
        <Textarea label="Preferences (JSON)" value={prefs} onChange={setPrefs} rows={6} mono />
        <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Save className="w-4 h-4" />Save profile</button>
      </form>

      <div className="space-y-6">
        <HoldPanel user={u} onChange={onChange} />
        <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2"><KeyRound className="w-4 h-4 text-[#0C8B44]" />Reset password</h2>
          <p className="text-xs text-[#A0A0A0] mb-3">Set a new password for this user. All existing sessions will be revoked.</p>
          <div className="flex gap-2">
            <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (8+ chars)" className="flex-1 px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
            <button type="button" onClick={setPwd} className="px-4 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]">Reset</button>
          </div>
        </section>
        <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2"><LogOut className="w-4 h-4 text-[#F57C00]" />Revoke sessions</h2>
          <p className="text-xs text-[#A0A0A0] mb-3">Force log-out by invalidating all outstanding JWTs (current tokenVersion: {u.tokenVersion}).</p>
          <button type="button" onClick={revoke} className="px-4 py-2 bg-[#1a1a1a] border border-[#ffffff10] text-sm text-[#F57C00] rounded-lg hover:border-[#F57C00]/40">Revoke all</button>
        </section>
      </div>
    </div>
  )
}

// ---------- Wallet ----------
function WalletTab({ userId, balances, onChange }: { userId: string; balances: AdminWalletBalance[]; onChange: () => void }) {
  const [currency, setCurrency] = useState('USD')
  const [symbol, setSymbol] = useState('$')
  const [balance, setBalance] = useState('0')
  const [available, setAvailable] = useState('0')

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await adminApi.setWallet(userId, { currency, symbol, balance: parseFloat(balance) || 0, available: parseFloat(available) || 0 })
      toast.success(`${currency} balance saved`); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  async function del(id: string) {
    if (!confirm('Delete this balance row?')) return
    await adminApi.deleteWallet(id); toast.success('Removed'); onChange()
  }
  return (
    <div className="space-y-6">
      <DepositDeductPanel userId={userId} balances={balances} onChange={onChange} />
      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={add} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-3">
          <h2 className="text-sm font-medium text-[#E5E5E5]">Set / upsert balance (raw)</h2>
          <p className="text-[11px] text-[#737373] -mt-2">Overwrites the row directly. Doesn't create a transaction record — use Deposit/Deduct above for an audited change.</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Currency" value={currency} onChange={(v) => setCurrency(v.toUpperCase())} />
            <Input label="Symbol" value={symbol} onChange={setSymbol} />
          </div>
          <Input label="Balance" value={balance} onChange={setBalance} type="number" />
          <Input label="Available" value={available} onChange={setAvailable} type="number" />
          <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Plus className="w-4 h-4" />Save balance</button>
        </form>
        <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]">
              <tr><th className="text-left px-4 py-3 font-normal">Currency</th><th className="text-right px-4 py-3 font-normal">Balance</th><th className="text-right px-4 py-3 font-normal">Available</th><th className="text-right px-4 py-3 font-normal">Updated</th><th /></tr>
            </thead>
            <tbody>
              {balances.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-[#737373]">No balances</td></tr>}
              {balances.map((b) => (
                <tr key={b.id} className="border-t border-[#ffffff05]">
                  <td className="px-4 py-3 text-[#E5E5E5]">{b.symbol} {b.currency}</td>
                  <td className="px-4 py-3 text-right text-[#A0A0A0]">{b.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                  <td className="px-4 py-3 text-right text-[#A0A0A0]">{b.available.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                  <td className="px-4 py-3 text-right text-[11px] text-[#737373]">{new Date(b.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right"><IconButton onClick={() => del(b.id)} aria-label="Delete balance"><Trash2 className="w-4 h-4" /></IconButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------- Holdings ----------
function HoldingsTab({ userId, holdings, onChange }: { userId: string; holdings: AdminHolding[]; onChange: () => void }) {
  const [symbol, setSymbol] = useState('BTC')
  const [name, setName] = useState('Bitcoin')
  const [amount, setAmount] = useState('0')
  const [avgPrice, setAvgPrice] = useState('0')
  const [type, setType] = useState<'crypto' | 'stock' | 'etf'>('crypto')

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await adminApi.upsertHolding(userId, { symbol, name, amount: parseFloat(amount) || 0, avgPrice: parseFloat(avgPrice) || 0, type })
      toast.success('Saved'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  async function del(id: string) {
    if (!confirm('Delete this holding?')) return
    await adminApi.deleteHolding(id); toast.success('Removed'); onChange()
  }
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={add} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-3">
        <h2 className="text-sm font-medium text-[#E5E5E5]">Add / upsert holding</h2>
        <Input label="Symbol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} />
        <Input label="Name" value={name} onChange={setName} />
        <Input label="Amount" value={amount} onChange={setAmount} type="number" />
        <Input label="Avg price" value={avgPrice} onChange={setAvgPrice} type="number" />
        <Select label="Type" value={type} onChange={(v) => setType(v as 'crypto' | 'stock' | 'etf')} options={[{ value: 'crypto', label: 'Crypto' }, { value: 'stock', label: 'Stock' }, { value: 'etf', label: 'ETF' }]} />
        <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Plus className="w-4 h-4" />Save holding</button>
      </form>
      <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]">
            <tr><th className="text-left px-4 py-3 font-normal">Symbol</th><th className="text-left px-4 py-3 font-normal">Type</th><th className="text-right px-4 py-3 font-normal">Amount</th><th className="text-right px-4 py-3 font-normal">Avg price</th><th /></tr>
          </thead>
          <tbody>
            {holdings.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-[#737373]">No holdings</td></tr>}
            {holdings.map((h) => (
              <tr key={h.id} className="border-t border-[#ffffff05]">
                <td className="px-4 py-3"><p className="text-[#E5E5E5]">{h.symbol}</p><p className="text-[11px] text-[#737373]">{h.name}</p></td>
                <td className="px-4 py-3 text-[11px] text-[#A0A0A0] capitalize">{h.type}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">{h.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${h.avgPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right"><IconButton onClick={() => del(h.id)} aria-label="Delete holding"><Trash2 className="w-4 h-4" /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Transactions ----------
function TransactionsTab({ userId, txs, onChange }: { userId: string; txs: AdminTransaction[]; onChange: () => void }) {
  const [kind, setKind] = useState<'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest'>('deposit')
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('0')
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed' | 'reversed'>('completed')
  const [reference, setReference] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await adminApi.createTransaction(userId, { kind, currency: currency.toUpperCase(), amount: parseFloat(amount), status, reference: reference || undefined })
      toast.success('Transaction logged'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  async function changeStatus(id: string, status: string) {
    await adminApi.patchTransaction(id, { status }); toast.success('Status updated'); onChange()
  }
  async function del(id: string) {
    if (!confirm('Delete this transaction?')) return
    await adminApi.deleteTransaction(id); toast.success('Removed'); onChange()
  }
  function exportCsv() {
    if (!txs.length) { toast.error('Nothing to export'); return }
    const rows = txs.map((t) => ({ id: t.id, createdAt: t.createdAt, kind: t.kind, currency: t.currency, amount: t.amount, status: t.status, reference: t.reference || '' }))
    downloadFile(`transactions-${userId}.csv`, toCsv(rows))
  }
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={add} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#E5E5E5]">Inject transaction</h2>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]"><Download className="w-3 h-3" />CSV</button>
        </div>
        <Select label="Kind" value={kind} onChange={(v) => setKind(v as typeof kind)} options={[{ value: 'deposit', label: 'Deposit' }, { value: 'withdraw', label: 'Withdraw' }, { value: 'transfer', label: 'Transfer' }, { value: 'dividend', label: 'Dividend' }, { value: 'interest', label: 'Interest' }]} />
        <Input label="Currency" value={currency} onChange={(v) => setCurrency(v.toUpperCase())} />
        <Input label="Amount" value={amount} onChange={setAmount} type="number" />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={[{ value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }, { value: 'failed', label: 'Failed' }, { value: 'reversed', label: 'Reversed' }]} />
        <Input label="Reference" value={reference} onChange={setReference} />
        <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Plus className="w-4 h-4" />Add transaction</button>
      </form>
      <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]">
            <tr><th className="text-left px-4 py-3 font-normal">When</th><th className="text-left px-4 py-3 font-normal">Kind</th><th className="text-right px-4 py-3 font-normal">Amount</th><th className="text-left px-4 py-3 font-normal">Status</th><th className="text-left px-4 py-3 font-normal">Ref</th><th /></tr>
          </thead>
          <tbody>
            {txs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-[#737373]">No transactions</td></tr>}
            {txs.map((t) => (
              <tr key={t.id} className="border-t border-[#ffffff05]">
                <td className="px-4 py-3 text-[11px] text-[#737373]">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-[#E5E5E5] capitalize">{t.kind}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">{t.amount.toLocaleString()} {t.currency}</td>
                <td className="px-4 py-3">
                  <select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value)} aria-label="Change status" className="bg-[#0a0f11] border border-[#ffffff10] rounded px-2 py-1 text-[11px] text-[#E5E5E5]">
                    <option value="pending">pending</option><option value="completed">completed</option><option value="failed">failed</option><option value="reversed">reversed</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#A0A0A0] truncate max-w-[160px]">{t.reference || '—'}</td>
                <td className="px-4 py-3 text-right"><IconButton onClick={() => del(t.id)} aria-label="Delete transaction"><Trash2 className="w-4 h-4" /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Trades ----------
function TradesTab({ userId, trades, onChange }: { userId: string; trades: AdminTrade[]; onChange: () => void }) {
  const [symbol, setSymbol] = useState('BTC')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('0')
  const [price, setPrice] = useState('0')
  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await adminApi.createTrade(userId, { symbol, side, amount: parseFloat(amount), price: parseFloat(price) })
      toast.success('Trade logged'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  async function del(id: string) {
    if (!confirm('Delete this trade?')) return
    await adminApi.deleteTrade(id); toast.success('Removed'); onChange()
  }
  function exportCsv() {
    if (!trades.length) { toast.error('Nothing to export'); return }
    const rows = trades.map((t) => ({ id: t.id, createdAt: t.createdAt, symbol: t.symbol, side: t.side, amount: t.amount, price: t.price, total: t.total }))
    downloadFile(`trades-${userId}.csv`, toCsv(rows))
  }
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={add} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#E5E5E5]">Inject trade</h2>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]"><Download className="w-3 h-3" />CSV</button>
        </div>
        <Input label="Symbol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} />
        <Select label="Side" value={side} onChange={(v) => setSide(v as 'buy' | 'sell')} options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]} />
        <Input label="Amount" value={amount} onChange={setAmount} type="number" />
        <Input label="Price" value={price} onChange={setPrice} type="number" />
        <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Plus className="w-4 h-4" />Add trade</button>
      </form>
      <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]">
            <tr><th className="text-left px-4 py-3 font-normal">When</th><th className="text-left px-4 py-3 font-normal">Symbol</th><th className="text-left px-4 py-3 font-normal">Side</th><th className="text-right px-4 py-3 font-normal">Amount</th><th className="text-right px-4 py-3 font-normal">Price</th><th className="text-right px-4 py-3 font-normal">Total</th><th /></tr>
          </thead>
          <tbody>
            {trades.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-[#737373]">No trades</td></tr>}
            {trades.map((t) => (
              <tr key={t.id} className="border-t border-[#ffffff05]">
                <td className="px-4 py-3 text-[11px] text-[#737373]">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-[#E5E5E5]">{t.symbol}</td>
                <td className={`px-4 py-3 capitalize ${t.side === 'buy' ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{t.side}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">{t.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${t.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right"><IconButton onClick={() => del(t.id)} aria-label="Delete trade"><Trash2 className="w-4 h-4" /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Watchlist ----------
function WatchlistTab({ items, onChange }: { items: AdminWatchItem[]; onChange: () => void }) {
  async function del(id: string) {
    if (!confirm('Remove from watchlist?')) return
    await adminApi.deleteWatch(id); toast.success('Removed'); onChange()
  }
  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]"><tr><th className="text-left px-4 py-3 font-normal">Symbol</th><th className="text-left px-4 py-3 font-normal">Type</th><th className="text-right px-4 py-3 font-normal">Added</th><th /></tr></thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-[#737373]">Empty</td></tr>}
          {items.map((w) => (
            <tr key={w.id} className="border-t border-[#ffffff05]">
              <td className="px-4 py-3"><p className="text-[#E5E5E5]">{w.symbol}</p><p className="text-[11px] text-[#737373]">{w.name}</p></td>
              <td className="px-4 py-3 text-[11px] text-[#A0A0A0] capitalize">{w.type}</td>
              <td className="px-4 py-3 text-right text-[11px] text-[#737373]">{new Date(w.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-right"><IconButton onClick={() => del(w.id)} aria-label="Remove watch"><Trash2 className="w-4 h-4" /></IconButton></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Alerts ----------
function AlertsTab({ userId, alerts, onChange }: { userId: string; alerts: AdminPriceAlert[]; onChange: () => void }) {
  const [symbol, setSymbol] = useState('BTC')
  const [name, setName] = useState('Bitcoin')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [target, setTarget] = useState('0')
  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await adminApi.createAlert(userId, { symbol, name, direction, target: parseFloat(target) })
      toast.success('Alert created'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  async function del(id: string) {
    if (!confirm('Delete this alert?')) return
    await adminApi.deleteAlert(id); toast.success('Removed'); onChange()
  }
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={add} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-3">
        <h2 className="text-sm font-medium text-[#E5E5E5]">Create alert</h2>
        <Input label="Symbol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} />
        <Input label="Name" value={name} onChange={setName} />
        <Select label="Direction" value={direction} onChange={(v) => setDirection(v as 'above' | 'below')} options={[{ value: 'above', label: 'Above' }, { value: 'below', label: 'Below' }]} />
        <Input label="Target price" value={target} onChange={setTarget} type="number" />
        <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Plus className="w-4 h-4" />Create</button>
      </form>
      <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]"><tr><th className="text-left px-4 py-3 font-normal">Symbol</th><th className="text-left px-4 py-3 font-normal">Direction</th><th className="text-right px-4 py-3 font-normal">Target</th><th className="text-left px-4 py-3 font-normal">State</th><th /></tr></thead>
          <tbody>
            {alerts.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-[#737373]">No alerts</td></tr>}
            {alerts.map((a) => (
              <tr key={a.id} className="border-t border-[#ffffff05]">
                <td className="px-4 py-3"><p className="text-[#E5E5E5]">{a.symbol}</p><p className="text-[11px] text-[#737373]">{a.name}</p></td>
                <td className="px-4 py-3 capitalize text-[#A0A0A0]">{a.direction}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${a.target.toLocaleString()}</td>
                <td className="px-4 py-3 text-[11px]">{a.triggered ? <span className="text-[#F57C00]">triggered</span> : a.active ? <span className="text-[#4CAF50]">active</span> : <span className="text-[#737373]">inactive</span>}</td>
                <td className="px-4 py-3 text-right"><IconButton onClick={() => del(a.id)} aria-label="Delete alert"><Trash2 className="w-4 h-4" /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Notifications ----------
function NotificationsTab({ userId, notifications, onChange }: { userId: string; notifications: AdminNotification[]; onChange: () => void }) {
  const [kind, setKind] = useState<'alert' | 'trade' | 'deposit' | 'system'>('system')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Title required'); return }
    try {
      await adminApi.createNotification(userId, { kind, title, body: body || undefined })
      setTitle(''); setBody(''); toast.success('Notification sent'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  async function del(id: string) {
    if (!confirm('Delete this notification?')) return
    await adminApi.deleteNotification(id); toast.success('Removed'); onChange()
  }
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={add} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-3">
        <h2 className="text-sm font-medium text-[#E5E5E5]">Push notification</h2>
        <Select label="Kind" value={kind} onChange={(v) => setKind(v as typeof kind)} options={[{ value: 'system', label: 'System' }, { value: 'alert', label: 'Alert' }, { value: 'trade', label: 'Trade' }, { value: 'deposit', label: 'Deposit' }]} />
        <Input label="Title" value={title} onChange={setTitle} />
        <Textarea label="Body" value={body} onChange={setBody} rows={4} />
        <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Mail className="w-4 h-4" />Send</button>
      </form>
      <div className="lg:col-span-2 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]"><tr><th className="text-left px-4 py-3 font-normal">When</th><th className="text-left px-4 py-3 font-normal">Kind</th><th className="text-left px-4 py-3 font-normal">Message</th><th className="text-left px-4 py-3 font-normal">Read</th><th /></tr></thead>
          <tbody>
            {notifications.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-[#737373]">None</td></tr>}
            {notifications.map((n) => (
              <tr key={n.id} className="border-t border-[#ffffff05]">
                <td className="px-4 py-3 text-[11px] text-[#737373]">{new Date(n.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-[11px] text-[#A0A0A0] capitalize">{n.kind}</td>
                <td className="px-4 py-3"><p className="text-[#E5E5E5]">{n.title}</p>{n.body && <p className="text-[11px] text-[#737373] line-clamp-1">{n.body}</p>}</td>
                <td className="px-4 py-3 text-[11px]">{n.read ? <span className="text-[#A0A0A0]">read</span> : <span className="text-[#0C8B44]">unread</span>}</td>
                <td className="px-4 py-3 text-right"><IconButton onClick={() => del(n.id)} aria-label="Delete notification"><Trash2 className="w-4 h-4" /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------- Danger ----------
function DangerTab({ userId, onDeleted }: { userId: string; onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState('')
  async function del() {
    if (confirmText !== 'DELETE') { toast.error('Type DELETE to confirm'); return }
    try {
      await adminApi.deleteUser(userId)
      toast.success('Account deleted')
      onDeleted()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  return (
    <div className="rounded-2xl bg-[#f44336]/5 border border-[#f44336]/30 p-6">
      <h2 className="text-sm font-medium text-[#f44336] mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Permanently delete account</h2>
      <p className="text-xs text-[#A0A0A0] mb-4">This deletes the user and all related holdings, trades, balances, transactions, alerts, watchlist entries, and notifications. This action cannot be undone.</p>
      <div className="flex gap-2 max-w-md">
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder='Type "DELETE" to confirm' className="flex-1 px-3 py-2 bg-[#0a0f11] border border-[#f44336]/30 rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#f44336]" />
        <button type="button" onClick={del} className="inline-flex items-center gap-2 px-4 py-2 bg-[#f44336] text-white text-sm rounded-lg hover:bg-[#d32f2f]"><Trash2 className="w-4 h-4" />Delete account</button>
      </div>
    </div>
  )
}

// ---------- Hold panel (in Profile tab) ----------
function HoldPanel({ user, onChange }: { user: AdminUserDetailResponse['user']; onChange: () => void }) {
  const [holdType, setHoldType] = useState<'all' | 'withdraw' | 'transfer'>(user.holdType ?? 'all')
  const [reason, setReason] = useState(user.holdReason ?? 'compliance_review')
  const [note, setNote] = useState(user.holdNote ?? '')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  async function place() {
    setBusy(true)
    try {
      await adminApi.placeHold(user.id, { holdType, reason, note: note || undefined, notify })
      toast.success('Hold placed')
      onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  async function release() {
    if (!confirm('Release the hold on this account?')) return
    setBusy(true)
    try {
      await adminApi.releaseHold(user.id)
      toast.success('Hold released')
      onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-2 flex items-center gap-2">
        {user.holdActive ? <Lock className="w-4 h-4 text-[#F57C00]" /> : <Unlock className="w-4 h-4 text-[#0C8B44]" />}
        Account hold
      </h2>
      <p className="text-xs text-[#A0A0A0] mb-4">Holds block money-movement (withdrawals/transfers) without blocking sign-in. Use a hold for AML / KYC review, suspected fraud, court orders, etc.</p>
      {user.holdActive && (
        <div className="mb-4 p-3 rounded-lg bg-[#F57C00]/10 border border-[#F57C00]/20 text-xs text-[#F57C00]">
          <div className="font-medium">Active hold — scope: {user.holdType}</div>
          <div className="text-[#E5E5E5]/80 mt-1">Reason: {HOLD_REASONS.find((r) => r.value === user.holdReason)?.label ?? user.holdReason}</div>
          {user.holdNote && <div className="text-[#A0A0A0] mt-1">Note: {user.holdNote}</div>}
          {user.holdAt && <div className="text-[#737373] mt-1">Since {new Date(user.holdAt).toLocaleString()}</div>}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Scope" value={holdType} onChange={(v) => setHoldType(v as typeof holdType)} options={HOLD_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Select label="Reason" value={reason} onChange={setReason} options={HOLD_REASONS} />
      </div>
      <Textarea label="Internal note (optional)" value={note} onChange={setNote} rows={2} />
      <label className="flex items-center gap-2 text-xs text-[#A0A0A0] mt-2 cursor-pointer">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#0C8B44]" />
        Notify the user in-app
      </label>
      <div className="flex gap-2 mt-4">
        <button type="button" disabled={busy} onClick={place} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#F57C00] text-white text-sm rounded-lg hover:bg-[#e36e00] disabled:opacity-50"><Lock className="w-4 h-4" />{user.holdActive ? 'Update hold' : 'Place hold'}</button>
        {user.holdActive && (
          <button type="button" disabled={busy} onClick={release} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#ffffff10] text-sm text-[#0C8B44] rounded-lg hover:border-[#0C8B44]/40 disabled:opacity-50"><Unlock className="w-4 h-4" />Release hold</button>
        )}
      </div>
    </section>
  )
}

// ---------- Deposit / Deduct panel (in Wallet tab) ----------
function DepositDeductPanel({ userId, balances, onChange }: { userId: string; balances: AdminWalletBalance[]; onChange: () => void }) {
  const [mode, setMode] = useState<'deposit' | 'deduct'>('deposit')
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('manual_bank_wire')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'pending' | 'completed'>('completed')
  const [allowNegative, setAllowNegative] = useState(false)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  const reasonOptions = mode === 'deposit' ? DEPOSIT_REASONS : DEDUCT_REASONS
  const currencyOptions = balances.length
    ? balances.map((b) => ({ value: b.currency, label: `${b.symbol} ${b.currency} (${b.available.toLocaleString(undefined, { maximumFractionDigits: 4 })} available)` }))
    : [{ value: 'USD', label: '$ USD' }]

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!isFinite(amt) || amt <= 0) { toast.error('Amount must be greater than 0'); return }
    setBusy(true)
    try {
      if (mode === 'deposit') {
        await adminApi.deposit(userId, { currency, amount: amt, reason, note: note || undefined, status, notify })
        toast.success(`Credited ${amt} ${currency}`)
      } else {
        await adminApi.deduct(userId, { currency, amount: amt, reason, note: note || undefined, status, allowNegative, notify })
        toast.success(`Debited ${amt} ${currency}`)
      }
      setAmount(''); setNote('')
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2"><ArrowDownToLine className="w-4 h-4 text-[#0C8B44]" />Move money</h2>
        <div className="flex rounded-lg bg-[#0a0f11] border border-[#ffffff10] p-0.5 text-xs">
          <button type="button" onClick={() => { setMode('deposit'); setReason('manual_bank_wire') }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded ${mode === 'deposit' ? 'bg-[#0C8B44] text-white' : 'text-[#A0A0A0]'}`}><ArrowDownToLine className="w-3.5 h-3.5" />Deposit</button>
          <button type="button" onClick={() => { setMode('deduct'); setReason('fee') }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded ${mode === 'deduct' ? 'bg-[#f44336] text-white' : 'text-[#A0A0A0]'}`}><ArrowUpFromLine className="w-3.5 h-3.5" />Deduct</button>
        </div>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select label="Currency" value={currency} onChange={setCurrency} options={currencyOptions} />
        <Input label="Amount" value={amount} onChange={setAmount} type="number" placeholder="0.00" />
        <Select label="Reason" value={reason} onChange={setReason} options={reasonOptions} />
        <Select label="Status" value={status} onChange={(v) => setStatus(v as 'pending' | 'completed')} options={[{ value: 'completed', label: 'Completed (apply now)' }, { value: 'pending', label: 'Pending (record only)' }]} />
        <div className="md:col-span-2">
          <Textarea label="Note (free-form, shown in transaction reference)" value={note} onChange={setNote} rows={2} />
        </div>
        <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-xs text-[#A0A0A0]">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#0C8B44]" />
            Notify the user
          </label>
          {mode === 'deduct' && (
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} className="accent-[#f44336]" />
              Allow negative balance
            </label>
          )}
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={busy} className={`w-full inline-flex items-center justify-center gap-2 py-2.5 text-white text-sm rounded-lg disabled:opacity-50 ${mode === 'deposit' ? 'bg-[#0C8B44] hover:bg-[#0a7539]' : 'bg-[#f44336] hover:bg-[#d32f2f]'}`}>
            {mode === 'deposit' ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
            {busy ? 'Working…' : mode === 'deposit' ? 'Deposit funds' : 'Deduct funds'}
          </button>
        </div>
      </form>
    </section>
  )
}

// ---------- Shared form atoms ----------
function Input({ label, value, onChange, placeholder, type = 'text', className = '' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
    </label>
  )
}

function Textarea({ label, value, onChange, rows = 3, mono }: { label: string; value: string; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={`w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44] resize-none ${mono ? 'font-mono text-xs' : ''}`} />
    </label>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

function IconButton({ children, onClick, ...rest }: { children: React.ReactNode; onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" onClick={onClick} className="p-1.5 rounded text-[#737373] hover:text-[#f44336] hover:bg-[#f44336]/10 transition-colors" {...rest}>{children}</button>
  )
}
