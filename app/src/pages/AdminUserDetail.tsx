import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import VerifiedBadge from '../components/VerifiedBadge'
import {
  adminApi, type AdminUserDetailResponse, type AdminHolding,
  type AdminWalletBalance, type AdminTransaction, type AdminTrade, type AdminWalletLink,
  type AdminPriceAlert, type AdminWatchItem, type AdminNotification, type AdminAuditLog,
  DEPOSIT_REASONS, DEDUCT_REASONS, HOLD_REASONS, HOLD_TYPES,
  HOLDING_REASONS, FEE_TYPES, KYC_STATUSES, EMAIL_TEMPLATES,
} from '../lib/adminApi'
import { setToken } from '../lib/api'
import {
  ArrowLeft, ShieldCheck, Ban, KeyRound, LogOut, Trash2,
  Save, Plus, AlertTriangle, User as UserIcon, Wallet, Briefcase,
  ArrowLeftRight, BarChart3, Eye, Bell, Mail, Download,
  ArrowDownToLine, ArrowUpFromLine, Lock, Unlock, FileCheck2, Activity, UserCog, Wifi, RotateCcw, DollarSign,
  Phone, Gift,
} from 'lucide-react'
import { toCsv, downloadFile } from '../lib/csvExport'
import { userWallets, type UserWalletOverride, hydrateUserWalletsFromServer, pushUserWalletsToServer } from '../lib/userWallets'
import { feeProofs, FEE_PROOFS_EVENT, type FeeProof } from '../lib/feeProofs'

type Tab = 'profile' | 'wallet' | 'holdings' | 'transactions' | 'trades' | 'watchlist' | 'alerts' | 'notifications' | 'audit' | 'danger'

// Curated description presets shown in the "Inject transaction" form on the
// Transactions tab. Grouped by category so the dropdown is scannable. The
// admin can pick one to auto-fill the description field, then edit freely.
type PresetGroup = { label: string; items: string[] }
const DEPOSIT_PRESETS: Record<'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest', PresetGroup[]> = {
  deposit: [
    { label: 'Investment Earnings', items: [
      'Investment Earnings — Quarterly Distribution',
      'Investment Earnings — Monthly Yield Payout',
      'Investment Earnings — Managed Portfolio Gain',
      'Capital Gains Payout — Closed Position',
      'Profit Share — Strategy Performance Fee Rebate',
      'Realized Profit — Successful Trade Execution',
    ] },
    { label: 'Bonuses & Rewards', items: [
      'Welcome Bonus — New Account',
      'Loyalty Bonus — Account Anniversary',
      'Referral Reward — Invited User Funded',
      'Promotional Credit — Campaign Reward',
      'Trading Rebate — High-Volume Tier',
      'Cashback Reward — Card Spend',
    ] },
    { label: 'Lucky Win / Promotional', items: [
      'Lucky Win — Promotional Draw',
      'Jackpot Win — Featured Event',
      'Tournament Prize — Trading Contest',
      'Giveaway Winner — Community Event',
      'Daily Streak Reward',
    ] },
    { label: 'Funding', items: [
      'Wire Transfer — Bank Deposit',
      'ACH Bank Deposit',
      'Card Deposit',
      'Crypto Deposit — On-Chain Transfer',
      'Internal Transfer — Sister Account',
      'Reimbursement — Fee Credit',
    ] },
    { label: 'Other', items: [
      'Manual Adjustment By Admin',
      'Refund — Cancelled Transaction',
      'Goodwill Credit — Service Issue',
      'Audit Correction',
    ] },
  ],
  withdraw: [
    { label: 'Withdrawals', items: [
      'Wire Withdrawal — Bank',
      'ACH Withdrawal — Bank',
      'Crypto Withdrawal — On-Chain',
      'Card Withdrawal — Debit',
      'Check Withdrawal — Mailed',
    ] },
    { label: 'Fees & Deductions', items: [
      'Withdrawal Fee',
      'Network Fee — Gas',
      'Service Charge — Monthly',
      'Tax Withholding',
      'Manual Deduction By Admin',
      'Reversal Of Credit — Chargeback',
    ] },
  ],
  transfer: [
    { label: 'Transfers', items: [
      'Internal Transfer — Between Wallets',
      'Conversion — Currency Swap',
      'Sent To Another User',
      'Received From Another User',
    ] },
  ],
  dividend: [
    { label: 'Dividends', items: [
      'Stock Dividend Payout',
      'ETF Distribution',
      'REIT Distribution',
      'Special Dividend',
    ] },
  ],
  interest: [
    { label: 'Interest & Yield', items: [
      'Cash Sweep Interest',
      'Staking Reward — Daily Payout',
      'Yield Farming Reward',
      'Lending Interest Payout',
      'Savings Interest — Monthly',
    ] },
  ],
}

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
    { key: 'audit', label: 'Audit', icon: <Activity className="w-4 h-4" /> },
    { key: 'danger', label: 'Danger zone', icon: <AlertTriangle className="w-4 h-4" /> },
  ]

  async function impersonate() {
    if (!confirm(`Impersonate ${u.email}? You will be logged in as them for 15 minutes.`)) return
    try {
      const r = await adminApi.impersonate(u.id)
      setToken(r.token)
      toast.success(`Now viewing as ${r.user.email} (15 min)`)
      window.location.assign('/dashboard')
    } catch (err) { toast.error((err as { error?: string }).error || 'Impersonation failed') }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />All users
        </Link>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl font-light text-[#E5E5E5]">{u.name}</h1>
          <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${u.role === 'admin' ? 'text-[#0C8B44] bg-[#0C8B44]/10 border border-[#0C8B44]/30' : 'text-[#737373] bg-[#1a1a1a] border border-[#ffffff12]'}`}>
            <ShieldCheck className={`w-3 h-3 ${u.role === 'admin' ? '' : 'opacity-50'}`} />
            {u.role === 'admin' ? 'Admin' : 'User'}
          </span>
          {u.kycStatus === 'approved' && <VerifiedBadge />}
          {u.suspended && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#f44336] bg-[#f44336]/10 px-2 py-0.5 rounded"><Ban className="w-3 h-3" />Suspended</span>}
          {u.holdActive && <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#F57C00] bg-[#F57C00]/10 px-2 py-0.5 rounded"><Lock className="w-3 h-3" />Hold: {u.holdType}</span>}
          {u.kycStatus && u.kycStatus !== 'none' && <KycBadge status={u.kycStatus} />}
          <div className="flex-1" />
          <button onClick={impersonate} className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border border-[#ffffff10] text-xs text-[#0C8B44] rounded-lg hover:border-[#0C8B44]/40"><UserCog className="w-3.5 h-3.5" />Impersonate (15m)</button>
        </div>
        <p className="text-xs text-[#737373] mb-2">{u.email} · ID {u.id} · joined {new Date(u.createdAt).toLocaleDateString()}</p>
        {u.investmentId && (
          <p className="text-xs text-[#737373] mb-6">
            Investment ID:{' '}
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(u.investmentId!); toast.success('Investment ID copied') }}
              className="font-mono text-[#0C8B44] bg-[#0C8B44]/10 px-2 py-0.5 rounded hover:bg-[#0C8B44]/20 transition-colors"
              title="Click to copy"
            >
              {u.investmentId}
            </button>
          </p>
        )}
        {!u.investmentId && <div className="mb-6" />}

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
        {tab === 'wallet' && <WalletTab userId={u.id} userEmail={u.email} balances={data.walletBalances} walletLinks={data.walletLinks ?? []} onChange={reload} />}
        {tab === 'holdings' && <HoldingsTab userId={u.id} holdings={data.holdings} onChange={reload} />}
        {tab === 'transactions' && <TransactionsTab userId={u.id} txs={data.transactions} onChange={reload} />}
        {tab === 'trades' && <TradesTab userId={u.id} trades={data.trades} onChange={reload} />}
        {tab === 'watchlist' && <WatchlistTab items={data.watchlist} onChange={reload} />}
        {tab === 'alerts' && <AlertsTab userId={u.id} alerts={data.alerts} onChange={reload} />}
        {tab === 'notifications' && <NotificationsTab userId={u.id} notifications={data.notifications} onChange={reload} />}
        {tab === 'audit' && <AuditTab userId={u.id} />}
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
  // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
  const [createdAt, setCreatedAt] = useState(() => toLocalInput(u.createdAt))
  const securityMeta = (() => {
    const security = (u.prefs?.security && typeof u.prefs.security === 'object') ? u.prefs.security as Record<string, unknown> : null
    const last = (security?.lastLogin && typeof security.lastLogin === 'object') ? security.lastLogin as Record<string, unknown> : null
    const geo = (last?.geo && typeof last.geo === 'object') ? last.geo as Record<string, unknown> : null
    return {
      at: typeof last?.at === 'string' ? last.at : null,
      ip: typeof last?.ip === 'string' ? last.ip : null,
      userAgent: typeof last?.userAgent === 'string' ? last.userAgent : null,
      city: typeof geo?.city === 'string' ? geo.city : null,
      region: typeof geo?.region === 'string' ? geo.region : null,
      country: typeof geo?.country === 'string' ? geo.country : null,
      timezone: typeof geo?.timezone === 'string' ? geo.timezone : null,
      isp: typeof geo?.isp === 'string' ? geo.isp : null,
    }
  })()

  async function save(e: FormEvent) {
    e.preventDefault()
    let parsedPrefs: Record<string, unknown>
    try { parsedPrefs = JSON.parse(prefs || '{}') } catch { toast.error('Prefs is not valid JSON'); return }
    const patch: Parameters<typeof adminApi.patchUser>[1] = {
      name, email, role, suspended, suspendedReason: suspendedReason || null, twoFactor, prefs: parsedPrefs,
    }
    // Only include createdAt if the admin actually changed it, and validate.
    if (createdAt && createdAt !== toLocalInput(u.createdAt)) {
      const iso = new Date(createdAt).toISOString()
      if (Number.isNaN(new Date(iso).getTime())) { toast.error('Invalid date'); return }
      patch.createdAt = iso
    }
    try {
      await adminApi.patchUser(u.id, patch)
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
        <div>
          <label className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5 block">Joined (createdAt)</label>
          <input
            type="datetime-local"
            aria-label="Account created at"
            title="Account created at"
            value={createdAt}
            onChange={(e) => setCreatedAt(e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
          />
          <p className="text-[10px] text-[#737373] mt-1">Backdate or post-date when this account was opened. Editable on save below.</p>
        </div>
        <Textarea label="Preferences (JSON)" value={prefs} onChange={setPrefs} rows={6} mono />
        <button type="submit" className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Save className="w-4 h-4" />Save profile</button>
      </form>

      <div className="space-y-6">
        <HoldPanel user={u} onChange={onChange} />
        <KycPanel user={u} onChange={onChange} />
        <ContactBonusPanel user={u} onChange={onChange} />
        <LimitsPanel user={u} onChange={onChange} />
        <IpAllowlistPanel user={u} onChange={onChange} />
        <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <h2 className="text-sm font-medium text-[#E5E5E5] mb-2 flex items-center gap-2"><Wifi className="w-4 h-4 text-[#0C8B44]" />Login IP & geolocation</h2>
          <p className="text-xs text-[#A0A0A0] mb-3">Use this to spot suspicious sign-ins or impossible travel patterns.</p>
          <div className="space-y-1.5 text-xs">
            <div className="text-[#E5E5E5]">Last login: <span className="text-[#A0A0A0]">{securityMeta.at ? new Date(securityMeta.at).toLocaleString() : 'Unknown'}</span></div>
            <div className="text-[#E5E5E5]">IP: <span className="text-[#A0A0A0] font-mono">{securityMeta.ip || 'Unknown'}</span></div>
            <div className="text-[#E5E5E5]">Location: <span className="text-[#A0A0A0]">{[securityMeta.city, securityMeta.region, securityMeta.country].filter(Boolean).join(', ') || 'Unknown'}</span></div>
            {securityMeta.timezone && <div className="text-[#E5E5E5]">Timezone: <span className="text-[#A0A0A0]">{securityMeta.timezone}</span></div>}
            {securityMeta.isp && <div className="text-[#E5E5E5]">ISP: <span className="text-[#A0A0A0]">{securityMeta.isp}</span></div>}
            {securityMeta.userAgent && <div className="text-[#737373] break-all pt-1">UA: {securityMeta.userAgent}</div>}
          </div>
        </section>
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
function WalletTab({ userId, userEmail, balances, walletLinks, onChange }: { userId: string; userEmail: string; balances: AdminWalletBalance[]; walletLinks: AdminWalletLink[]; onChange: () => void }) {
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
      <FeePanel userId={userId} balances={balances} onChange={onChange} />
      <FeeProofsPanel userId={userId} userEmail={userEmail} onChange={onChange} />
      <UserLinkedWalletsPanel userId={userId} initialLinks={walletLinks} />
      <UserWalletPanel userId={userId} userEmail={userEmail} />
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
                  <td className="px-4 py-3 text-right text-[#A0A0A0]">{(b.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                  <td className="px-4 py-3 text-right text-[#A0A0A0]">{(b.available ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
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
    <div className="space-y-6">
      <AdjustHoldingPanel userId={userId} onChange={onChange} />
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
                <td className="px-4 py-3 text-right text-[#A0A0A0]">{(h.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${(h.avgPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right"><IconButton onClick={() => del(h.id)} aria-label="Delete holding"><Trash2 className="w-4 h-4" /></IconButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  // Optional backdate: yyyy-mm-dd from <input type="date">. Empty = now.
  const [whenDate, setWhenDate] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      const createdAt = whenDate ? new Date(whenDate + 'T12:00:00Z').toISOString() : undefined
      await adminApi.createTransaction(userId, { kind, currency: currency.toUpperCase(), amount: parseFloat(amount), status, reference: reference || undefined, createdAt })
      toast.success(createdAt ? `Transaction logged (dated ${whenDate})` : 'Transaction logged'); onChange()
      // Nudge any open user-side tab in this browser to refresh portfolio.
      try { window.dispatchEvent(new Event('verdexis:portfolio-refresh')) } catch { /* SSR guard */ }
      setWhenDate('')
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
  }
  async function changeStatus(id: string, status: string) {
    await adminApi.patchTransaction(id, { status }); toast.success('Status updated'); onChange()
  }
  async function changeReference(id: string, reference: string) {
    try {
      await adminApi.patchTransaction(id, { reference })
      toast.success('Description updated'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed to update description') }
  }
  async function changeDate(id: string, ymd: string) {
    if (!ymd) return
    try {
      const iso = new Date(ymd + 'T12:00:00Z').toISOString()
      await adminApi.patchTransaction(id, { createdAt: iso })
      toast.success(`Date updated to ${ymd}`); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed to update date') }
  }
  async function del(id: string) {
    if (!confirm('Delete this transaction?')) return
    await adminApi.deleteTransaction(id); toast.success('Removed'); onChange()
  }
  async function reverse(t: AdminTransaction) {
    const reason = prompt('Reason for reversal (optional)') ?? undefined
    if (reason === null) return
    try {
      await adminApi.reverseTransaction(t.id, { reason: reason || undefined, notify: true })
      toast.success('Transaction reversed'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Reverse failed') }
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
        <Select label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={[{ value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }, { value: 'failed', label: 'Failed (rejected)' }, { value: 'reversed', label: 'Reversed' }]} />
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">Description preset</span>
          <select
            value=""
            onChange={(e) => { if (e.target.value) setReference(e.target.value) }}
            className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            aria-label="Preset description"
          >
            <option value="">— Pick a preset (optional) —</option>
            {DEPOSIT_PRESETS[kind].map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="block text-[10px] text-[#737373] mt-1">Picking a preset fills the description below; you can still edit it.</span>
        </label>
        <Input label="Description" value={reference} onChange={setReference} placeholder="e.g. Investment Earnings — Q2 Distribution" />
        <label className="block">
          <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">When (optional backdate)</span>
          <input
            type="date"
            value={whenDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setWhenDate(e.target.value)}
            className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
          />
          <span className="block text-[10px] text-[#737373] mt-1">Leave blank to use today.</span>
        </label>
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
                <td className="px-4 py-3 text-[11px] text-[#737373]">
                  <input
                    type="date"
                    defaultValue={new Date(t.createdAt).toISOString().slice(0, 10)}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => changeDate(t.id, e.target.value)}
                    aria-label="Edit transaction date"
                    title={new Date(t.createdAt).toLocaleString()}
                    className="bg-[#0a0f11] border border-[#ffffff10] rounded px-2 py-1 text-[11px] text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                  />
                </td>
                <td className="px-4 py-3 text-[#E5E5E5] capitalize">{t.kind}{t.reversedFromId && <span className="ml-2 text-[9px] text-[#F57C00] uppercase">(reversal)</span>}{t.subType && <span className="ml-2 text-[9px] text-[#737373] uppercase">[{t.subType}]</span>}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">{t.amount.toLocaleString()} {t.currency}</td>
                <td className="px-4 py-3">
                  <select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value)} aria-label="Change status" className="bg-[#0a0f11] border border-[#ffffff10] rounded px-2 py-1 text-[11px] text-[#E5E5E5]">
                    <option value="pending">pending</option><option value="completed">completed</option><option value="failed">failed</option><option value="reversed">reversed</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-[11px] text-[#A0A0A0] max-w-[220px]">
                  <ReferenceEditor key={`${t.id}:${t.reference || ''}`} value={t.reference || ''} onSave={(v) => changeReference(t.id, v)} />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {t.status !== 'reversed' && t.kind !== 'reversal' && (
                    <IconButton onClick={() => reverse(t)} aria-label="Reverse transaction"><RotateCcw className="w-4 h-4" /></IconButton>
                  )}
                  <IconButton onClick={() => del(t.id)} aria-label="Delete transaction"><Trash2 className="w-4 h-4" /></IconButton>
                </td>
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
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${t.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
                <td className="px-4 py-3 text-right text-[#A0A0A0]">${a.target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
    <div className="space-y-6">
      <EmailUserPanel userId={userId} onSent={onChange} />
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

// ---------- Pending fee-payment proofs (admin verification) ----------
function FeeProofsPanel({ userId, userEmail, onChange }: { userId: string; userEmail: string; onChange: () => void }) {
  const [proofs, setProofs] = useState<FeeProof[]>(() => feeProofs.listForUser(userEmail))
  const [showResolved, setShowResolved] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setProofs(feeProofs.listForUser(userEmail))
    window.addEventListener(FEE_PROOFS_EVENT, refresh)
    return () => window.removeEventListener(FEE_PROOFS_EVENT, refresh)
  }, [userEmail])

  const visible = showResolved ? proofs : proofs.filter(p => p.status === 'pending')
  const pendingCount = proofs.filter(p => p.status === 'pending').length

  async function approve(p: FeeProof) {
    if (!confirm(`Mark fee paid?\n\nThis will credit $${p.feeUsd.toFixed(2)} USD back to ${userEmail}'s wallet balance.`)) return
    setBusyId(p.id)
    try {
      await adminApi.deposit(userId, {
        currency: 'USD',
        symbol: '$',
        amount: p.feeUsd,
        reason: 'refund',
        note: `Processing fee credit-back (${p.feePayCurrency} proof: ${p.feeProof.slice(0, 24)}${p.feeProof.length > 24 ? '…' : ''}). Withdrawal: ${p.reference}`,
        status: 'completed',
        notify: true,
      })
      feeProofs.setStatus(p.id, 'verified', 'Fee payment verified by admin')
      toast.success(`Credited $${p.feeUsd.toFixed(2)} back to ${userEmail}`)
      onChange()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Credit failed')
    } finally {
      setBusyId(null)
    }
  }

  function reject(p: FeeProof) {
    const note = prompt('Reason for rejecting this fee proof?', 'Proof not found on-chain')
    if (note === null) return
    feeProofs.setStatus(p.id, 'rejected', note || 'Rejected')
    toast.success('Proof marked as rejected')
  }

  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
            <FileCheck2 className="w-4 h-4" />Pending fee proofs
            {pendingCount > 0 && <span className="text-[10px] bg-[#F57C00]/15 text-[#F57C00] px-2 py-0.5 rounded-full">{pendingCount}</span>}
          </h2>
          <p className="text-[11px] text-[#737373] mt-1">
            User-submitted withdrawal processing-fee payments awaiting your verification. Approving will credit the fee amount back to the user's USD balance.
          </p>
        </div>
        <button onClick={() => setShowResolved(s => !s)} className="text-[11px] text-[#A0A0A0] hover:text-[#E5E5E5]">
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-[11px] text-[#737373] text-center py-6">No {showResolved ? '' : 'pending '}fee proofs.</p>
      ) : (
        <div className="space-y-2">
          {visible.map(p => (
            <div key={p.id} className="rounded-lg bg-[#1a1a1a] border border-[#ffffff05] p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-[#E5E5E5]">${p.feeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} fee</span>
                    <span className="text-[10px] text-[#737373]">·</span>
                    <span className="text-[11px] text-[#A0A0A0]">paid in {p.feePayCurrency}</span>
                    <span className="text-[10px] text-[#737373]">·</span>
                    <span className="text-[11px] text-[#A0A0A0]">{new Date(p.createdAt).toLocaleString()}</span>
                    {p.status === 'pending' && <span className="text-[10px] uppercase tracking-wider text-[#F57C00] bg-[#F57C00]/10 px-2 py-0.5 rounded">Pending</span>}
                    {p.status === 'verified' && <span className="text-[10px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-2 py-0.5 rounded">Paid</span>}
                    {p.status === 'rejected' && <span className="text-[10px] uppercase tracking-wider text-[#f44336] bg-[#f44336]/10 px-2 py-0.5 rounded">Rejected</span>}
                  </div>
                  <p className="text-[11px] text-[#A0A0A0] mt-1">For withdrawal: {p.reference}</p>
                  <p className="text-[11px] text-[#737373] mt-1">
                    Withdrawal amount: {p.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {p.currency}
                  </p>
                  <p className="text-[10px] text-[#0C8B44] font-mono mt-1 break-all">{p.feeProof}</p>
                  {p.reviewerNote && <p className="text-[10px] text-[#737373] mt-1 italic">Admin note: {p.reviewerNote}</p>}
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(p)}
                      disabled={busyId === p.id}
                      className="px-3 py-1.5 text-[11px] rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50"
                    >Reject</button>
                    <button
                      onClick={() => approve(p)}
                      disabled={busyId === p.id}
                      className="px-3 py-1.5 text-[11px] rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50"
                    >{busyId === p.id ? 'Crediting…' : 'Mark fee paid'}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------- Linked Web3 wallets (admin-managed) ----------
function UserLinkedWalletsPanel({ userId, initialLinks }: { userId: string; initialLinks: AdminWalletLink[] }) {
  const [links, setLinks] = useState<AdminWalletLink[]>(initialLinks)
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState('0x1')
  const [provider, setProvider] = useState('')
  const [label, setLabel] = useState('')
  const [setPrimary, setSetPrimary] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setLinks(initialLinks) }, [initialLinks])

  async function reload() {
    try {
      const res = await adminApi.listUserWalletLinks(userId)
      setLinks(res.links)
    } catch {
      // best-effort
    }
  }

  async function upsert() {
    const a = address.trim().toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(a)) {
      toast.error('Enter a valid 0x wallet address')
      return
    }
    if (chainId.trim() && !/^0x[a-fA-F0-9]{1,16}$/.test(chainId.trim())) {
      toast.error('chainId must be 0x-prefixed hex (e.g. 0x1)')
      return
    }
    setBusy(true)
    try {
      await adminApi.upsertUserWalletLink(userId, {
        address: a,
        chainId: chainId.trim() || undefined,
        provider: provider.trim() || undefined,
        label: label.trim() || undefined,
        setPrimary,
      })
      setAddress('')
      setLabel('')
      setProvider('')
      setSetPrimary(true)
      await reload()
      toast.success('Linked wallet saved')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to save wallet link')
    } finally {
      setBusy(false)
    }
  }

  async function makePrimary(linkId: string) {
    setBusy(true)
    try {
      await adminApi.setUserWalletLinkPrimary(userId, linkId)
      await reload()
      toast.success('Primary wallet updated')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to set primary wallet')
    } finally {
      setBusy(false)
    }
  }

  async function remove(linkId: string) {
    if (!confirm('Remove this linked wallet?')) return
    setBusy(true)
    try {
      await adminApi.deleteUserWalletLink(userId, linkId)
      await reload()
      toast.success('Wallet link removed')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to remove wallet link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2"><Wallet className="w-4 h-4" />Linked Web3 wallets
          <span className="text-[10px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-full px-2 py-0.5">Self-custody</span>
        </h2>
        <p className="text-[11px] text-[#737373] mt-1">
          Admin can manually add, remove, or change the user's primary linked wallet. The primary link is mirrored into the legacy wallet fields used across the app.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Input label="Address" value={address} onChange={setAddress} placeholder="0x..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Chain ID (hex)" value={chainId} onChange={setChainId} placeholder="0x1" />
            <Input label="Provider (optional)" value={provider} onChange={setProvider} placeholder="MetaMask" />
          </div>
          <Input label="Label (optional)" value={label} onChange={setLabel} placeholder="Cold wallet" />
          <label className="inline-flex items-center gap-2 text-xs text-[#A0A0A0]">
            <input type="checkbox" checked={setPrimary} onChange={(e) => setSetPrimary(e.target.checked)} className="accent-[#0C8B44]" />
            Set as primary wallet
          </label>
          <button
            onClick={upsert}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />{busy ? 'Saving…' : 'Save linked wallet'}
          </button>
        </div>

        <div className="space-y-2">
          {links.length === 0 && <p className="text-[11px] text-[#737373]">No linked wallets on this account yet.</p>}
          {links.map((l) => (
            <div key={l.id} className="rounded-lg bg-[#1a1a1a] border border-[#ffffff08] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#E5E5E5] font-mono truncate">{l.address}</p>
                  <p className="text-[10px] text-[#737373] mt-1">
                    {l.chainId || '—'}{l.provider ? ` · ${l.provider}` : ''}{l.label ? ` · ${l.label}` : ''}
                  </p>
                  <p className="text-[10px] text-[#737373]">Linked {new Date(l.linkedAt).toLocaleString()}</p>
                </div>
                {l.isPrimary ? (
                  <span className="text-[10px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-2 py-0.5 rounded">Primary</span>
                ) : (
                  <button onClick={() => makePrimary(l.id)} disabled={busy} className="text-[10px] text-[#0C8B44] hover:underline">Set primary</button>
                )}
              </div>
              <div className="flex justify-end mt-2">
                <button onClick={() => remove(l.id)} disabled={busy} className="text-[10px] text-[#f44336] hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------- Per-user wallet override (admin-edited) ----------
// Lets the admin assign a unique crypto address (per ticker) and a USD wire
// destination to THIS user. Surfaces in the user's Wallet page (deposit +
// processing-fee modal) instead of the global default.
function UserWalletPanel({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [override, setOverride] = useState<UserWalletOverride>(() =>
    userWallets.get(userEmail) || userWallets.get(userId) || { cryptos: {}, wire: undefined, notes: '' },
  )
  const [cryptoTicker, setCryptoTicker] = useState('BTC')
  const [cryptoNetwork, setCryptoNetwork] = useState('Bitcoin')
  const [cryptoAddress, setCryptoAddress] = useState('')
  const [cryptoMemo, setCryptoMemo] = useState('')
  const [saving, setSaving] = useState(false)

  // Hydrate from server on mount so the admin sees what was saved on any device.
  useEffect(() => {
    let cancelled = false
    void hydrateUserWalletsFromServer({ email: userEmail, userId, admin: true }).then((srv) => {
      if (cancelled) return
      if (srv) setOverride(srv)
    })
    return () => { cancelled = true }
  }, [userId, userEmail])

  async function persist(next: UserWalletOverride) {
    setOverride(next)
    userWallets.set(userEmail, next)
    userWallets.cache(userId, next)
    setSaving(true)
    const saved = await pushUserWalletsToServer(userId, next)
    setSaving(false)
    if (!saved) toast.error('Saved locally but failed to sync to server')
  }

  function addCrypto() {
    const t = cryptoTicker.trim().toUpperCase()
    const a = cryptoAddress.trim()
    if (!t || !a) { toast.error('Ticker and address are required'); return }
    persist({
      ...override,
      cryptos: {
        ...override.cryptos,
        [t]: { currency: t, network: cryptoNetwork.trim() || t, address: a, memo: cryptoMemo.trim() || undefined },
      },
    })
    setCryptoAddress(''); setCryptoMemo('')
    toast.success(`${t} address saved for ${userEmail}`)
  }

  function removeCrypto(ticker: string) {
    const next = { ...override, cryptos: { ...override.cryptos } }
    delete next.cryptos[ticker]
    persist(next)
    toast.success(`${ticker} address removed`)
  }

  function setWireField<K extends keyof NonNullable<UserWalletOverride['wire']>>(k: K, v: string) {
    const w = override.wire || { beneficiaryName: '', bankName: '', accountNumber: '' }
    persist({ ...override, wire: { ...w, [k]: v } })
  }

  function clearWire() {
    persist({ ...override, wire: undefined })
    toast.success('Wire override cleared')
  }

  async function clearAll() {
    if (!confirm(`Clear ALL personal wallet addresses for ${userEmail}?`)) return
    userWallets.remove(userEmail)
    userWallets.cache(userId, null)
    setOverride({ cryptos: {}, wire: undefined, notes: '' })
    setSaving(true)
    try {
      const { adminApi: a } = await import('../lib/adminApi')
      await a.clearUserDepositAddresses(userId)
    } catch { /* best-effort */ }
    setSaving(false)
    toast.success('Cleared')
  }

  const cryptoEntries = Object.entries(override.cryptos)
  const w = override.wire

  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2"><Wallet className="w-4 h-4" />Personal payment destinations
            <span className="text-[10px] uppercase tracking-wider text-[#2196F3] bg-[#2196F3]/10 border border-[#2196F3]/30 rounded-full px-2 py-0.5">Custodial / manual</span>
          </h2>
          <p className="text-[11px] text-[#737373] mt-1">
            Per-user crypto / wire addresses shown to this user when paying processing fees or making deposits. Falls back to the global deposit instructions if empty.
          </p>
          <p className="text-[10px] text-[#737373] mt-0.5">Saved on the server &mdash; reaches this user on any device they sign in on.{saving ? ' Syncing…' : ''}</p>
        </div>
        {(cryptoEntries.length > 0 || w) && (
          <button onClick={clearAll} className="text-[11px] text-[#f44336] hover:underline">Clear all</button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-[#A0A0A0]">Crypto addresses</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ticker" value={cryptoTicker} onChange={(v) => setCryptoTicker(v.toUpperCase())} />
            <Input label="Network" value={cryptoNetwork} onChange={setCryptoNetwork} />
          </div>
          <Input label="Address" value={cryptoAddress} onChange={setCryptoAddress} />
          <Input label="Memo / Tag (optional)" value={cryptoMemo} onChange={setCryptoMemo} />
          <button onClick={addCrypto} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]"><Plus className="w-4 h-4" />Save address</button>

          <div className="space-y-1.5 pt-2">
            {cryptoEntries.length === 0 && <p className="text-[11px] text-[#737373]">No personal crypto addresses set.</p>}
            {cryptoEntries.map(([t, c]) => (
              <div key={t} className="flex items-center justify-between gap-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff05] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-[#E5E5E5]">{t} <span className="text-[10px] text-[#737373]">· {c.network}</span></p>
                  <p className="text-[10px] text-[#A0A0A0] truncate font-mono">{c.address}</p>
                  {c.memo && <p className="text-[10px] text-[#737373]">memo: {c.memo}</p>}
                </div>
                <IconButton onClick={() => removeCrypto(t)} aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></IconButton>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-[#A0A0A0]">USD wire destination</h3>
            {w && <button onClick={clearWire} className="text-[10px] text-[#f44336] hover:underline">Clear</button>}
          </div>
          <Input label="Beneficiary name" value={w?.beneficiaryName || ''} onChange={(v) => setWireField('beneficiaryName', v)} />
          <Input label="Bank name" value={w?.bankName || ''} onChange={(v) => setWireField('bankName', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Routing / ABA" value={w?.routingNumber || ''} onChange={(v) => setWireField('routingNumber', v)} />
            <Input label="SWIFT (intl)" value={w?.swiftCode || ''} onChange={(v) => setWireField('swiftCode', v)} />
          </div>
          <Input label="Account number" value={w?.accountNumber || ''} onChange={(v) => setWireField('accountNumber', v)} />
          <Input label="Reference (optional)" value={w?.reference || ''} onChange={(v) => setWireField('reference', v)} />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-[#A0A0A0] mb-1 block">Note shown to user (optional)</label>
        <textarea
          value={override.notes || ''}
          onChange={(e) => persist({ ...override, notes: e.target.value })}
          placeholder="e.g. Use this address for fee payments only. Funds arrive within 2 confirmations."
          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] min-h-[60px]"
        />
      </div>
    </section>
  )
}

// ---------- Deposit / Deduct panel (in Wallet tab) ----------
// Tradeable assets the admin can pick when "Invest as" is on. Symbol must
// match the server's coin-id table (server/src/historicalPrice.ts).
const INVEST_ASSETS: { symbol: string; name: string; type: 'crypto' | 'stock' | 'etf' }[] = [
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' },
  { symbol: 'BNB', name: 'BNB', type: 'crypto' },
  { symbol: 'XRP', name: 'XRP', type: 'crypto' },
  { symbol: 'ADA', name: 'Cardano', type: 'crypto' },
  { symbol: 'DOGE', name: 'Dogecoin', type: 'crypto' },
  { symbol: 'MATIC', name: 'Polygon', type: 'crypto' },
  { symbol: 'AVAX', name: 'Avalanche', type: 'crypto' },
  { symbol: 'LINK', name: 'Chainlink', type: 'crypto' },
  { symbol: 'DOT', name: 'Polkadot', type: 'crypto' },
  { symbol: 'LTC', name: 'Litecoin', type: 'crypto' },
]

function todayIsoDate(): string { return new Date().toISOString().slice(0, 10) }

// Convert any date-ish value into the "YYYY-MM-DDTHH:mm" format that
// <input type="datetime-local"> expects (in the browser's local time).
function toLocalInput(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(dt.getTime())) return ''
  const tzOffset = dt.getTimezoneOffset() * 60_000
  return new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16)
}

function DepositDeductPanel({ userId, balances, onChange }: { userId: string; balances: AdminWalletBalance[]; onChange: () => void }) {
  const [mode, setMode] = useState<'deposit' | 'deduct'>('deposit')
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('manual_bank_wire')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'pending' | 'completed'>('completed')
  const [allowNegative, setAllowNegative] = useState(false)
  const [notify, setNotify] = useState(true)
  // Backdate (deposit-only). Empty string = "now".
  const [backdate, setBackdate] = useState('')
  // Invest-as (deposit-only). Empty symbol = classic cash deposit.
  const [investEnabled, setInvestEnabled] = useState(false)
  const [investSymbol, setInvestSymbol] = useState('BTC')
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
        const occurredAt = backdate ? new Date(backdate + 'T12:00:00Z').toISOString() : undefined
        const investAs = investEnabled
          ? INVEST_ASSETS.find((a) => a.symbol === investSymbol) ?? undefined
          : undefined
        const r = await adminApi.deposit(userId, {
          currency, amount: amt, reason, note: note || undefined, status, notify,
          occurredAt, investAs,
        })
        if (investAs && r.quantity && r.historicalPrice) {
          const pnlMsg = typeof r.unrealizedPnlPct === 'number'
            ? ` Current P/L: ${r.unrealizedPnlPct >= 0 ? '+' : ''}${r.unrealizedPnlPct.toFixed(2)}%`
            : ''
          toast.success(
            `Bought ${r.quantity.toFixed(6)} ${investAs.symbol} @ $${r.historicalPrice.toFixed(2)} for $${amt.toLocaleString()}.${pnlMsg}`,
            { duration: 8000 },
          )
        } else {
          toast.success(`Credited ${amt} ${currency}${occurredAt ? ` (backdated to ${backdate})` : ''}`)
        }
      } else {
        await adminApi.deduct(userId, { currency, amount: amt, reason, note: note || undefined, status, allowNegative, notify })
        toast.success(`Debited ${amt} ${currency}`)
      }
      setAmount(''); setNote(''); setBackdate(''); setInvestEnabled(false)
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
        {mode === 'deposit' && (
          <>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">Backdate to (optional)</span>
              <input
                type="date"
                value={backdate}
                max={todayIsoDate()}
                onChange={(e) => setBackdate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
              />
              <span className="block mt-1 text-[10px] text-[#737373]">Leave empty to use today. Past dates appear in transaction history with the original date.</span>
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">Invest as (optional)</span>
              <div className="flex gap-2">
                <select
                  aria-label="Invest deposit as asset"
                  value={investEnabled ? investSymbol : ''}
                  onChange={(e) => {
                    if (!e.target.value) { setInvestEnabled(false); return }
                    setInvestEnabled(true); setInvestSymbol(e.target.value)
                  }}
                  className="flex-1 px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                >
                  <option value="">— Cash deposit (credit wallet) —</option>
                  {INVEST_ASSETS.map((a) => (
                    <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>
                  ))}
                </select>
              </div>
              <span className="block mt-1 text-[10px] text-[#737373]">If set, the deposit buys this asset at the historical price for the backdate. Profit/loss till today is computed from the real market price.</span>
            </label>
          </>
        )}
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

// ---------- KYC panel (Profile tab) ----------
function KycBadge({ status }: { status: string }) {
  const meta = KYC_STATUSES.find((k) => k.value === status)
  const tone = meta?.tone === 'green' ? 'text-[#4CAF50] bg-[#4CAF50]/10' : meta?.tone === 'orange' ? 'text-[#F57C00] bg-[#F57C00]/10' : meta?.tone === 'red' ? 'text-[#f44336] bg-[#f44336]/10' : 'text-[#A0A0A0] bg-[#1a1a1a]'
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${tone}`}><FileCheck2 className="w-3 h-3" />KYC: {meta?.label ?? status}</span>
}

function KycPanel({ user, onChange }: { user: AdminUserDetailResponse['user']; onChange: () => void }) {
  const [status, setStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>(user.kycStatus)
  const [notes, setNotes] = useState(user.kycNotes ?? '')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await adminApi.setKyc(user.id, { status, notes: notes || undefined, notify })
      toast.success(`KYC set to ${status}`)
      onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-2 flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-[#0C8B44]" />KYC review</h2>
      <p className="text-xs text-[#A0A0A0] mb-3">Last reviewed: {user.kycReviewedAt ? new Date(user.kycReviewedAt).toLocaleString() : 'never'}</p>
      <Select label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={KYC_STATUSES.map((k) => ({ value: k.value, label: k.label }))} />
      <Textarea label="Reviewer notes (visible to user when notified)" value={notes} onChange={setNotes} rows={3} />
      <label className="flex items-center gap-2 text-xs text-[#A0A0A0] mt-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#0C8B44]" />Notify user</label>
      <button type="button" onClick={save} disabled={busy} className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"><Save className="w-4 h-4" />{busy ? 'Saving…' : 'Save KYC'}</button>
    </section>
  )
}

// ---------- Contact + signup-bonus lock (Profile tab) ----------
function ContactBonusPanel({ user, onChange }: { user: AdminUserDetailResponse['user']; onChange: () => void }) {
  const prefs = (user.prefs && typeof user.prefs === 'object') ? user.prefs as Record<string, unknown> : {}
  const phone = typeof prefs.phone === 'string' ? prefs.phone : ''
  const bonusLocked = prefs.bonusLocked === true
  const bonusAmount = typeof prefs.bonusLockedAmountUsd === 'number' ? prefs.bonusLockedAmountUsd : null
  const bonusLockedAt = typeof prefs.bonusLockedAt === 'string' ? prefs.bonusLockedAt : null
  const [busy, setBusy] = useState(false)
  async function unlockBonus() {
    setBusy(true)
    try {
      const nextPrefs: Record<string, unknown> = { ...prefs }
      delete nextPrefs.bonusLocked
      delete nextPrefs.bonusLockedAmountUsd
      delete nextPrefs.bonusLockedAt
      nextPrefs.bonusUnlockedAt = new Date().toISOString()
      await adminApi.patchUser(user.id, { prefs: nextPrefs })
      toast.success('Bonus withdrawal unlocked')
      onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  const waHref = phone
    ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hi from Verdexis support — about your signup bonus withdrawal.')}`
    : null
  const tgHref = phone
    ? `https://t.me/+${phone.replace(/[^0-9]/g, '')}`
    : null
  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-[#0C8B44]" />Contact & signup bonus</h2>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#A0A0A0]">Phone</span>
          {phone ? (
            <span className="text-[#E5E5E5] font-mono">{phone}</span>
          ) : (
            <span className="text-[#737373]">Not provided</span>
          )}
        </div>
        {phone && (
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={waHref!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10 transition-colors text-[11px]"
            >WhatsApp</a>
            <a
              href={tgHref!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#229ED9]/30 text-[#229ED9] hover:bg-[#229ED9]/10 transition-colors text-[11px]"
            >Telegram</a>
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors text-[11px]"
            >Call</a>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[#A0A0A0]">Signup bonus</span>
          {bonusLocked ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-[#F57C00] bg-[#F57C00]/10"><Lock className="w-3 h-3" />Locked{bonusAmount != null ? ` · $${bonusAmount}` : ''}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded text-[#4CAF50] bg-[#4CAF50]/10"><Unlock className="w-3 h-3" />Withdrawal allowed</span>
          )}
        </div>
        {bonusLockedAt && (
          <div className="text-[#737373]">Locked at {new Date(bonusLockedAt).toLocaleString()}</div>
        )}
      </div>
      {bonusLocked && (
        <>
          <p className="text-[11px] text-[#A0A0A0] mt-3">
            Until unlocked, this user cannot withdraw funds. They've been told to message support on WhatsApp or Telegram first. Once you've confirmed the conversation, clear the lock below.
          </p>
          <button
            type="button"
            onClick={unlockBonus}
            disabled={busy}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"
          >
            <Gift className="w-4 h-4" />{busy ? 'Unlocking…' : 'Unlock bonus withdrawals'}
          </button>
        </>
      )}
    </section>
  )
}

// ---------- Limits panel (Profile tab) ----------
function LimitsPanel({ user, onChange }: { user: AdminUserDetailResponse['user']; onChange: () => void }) {
  const [dw, setDw] = useState(user.dailyWithdrawLimit?.toString() ?? '')
  const [mw, setMw] = useState(user.monthlyWithdrawLimit?.toString() ?? '')
  const [dt, setDt] = useState(user.dailyTransferLimit?.toString() ?? '')
  const [mt, setMt] = useState(user.monthlyTransferLimit?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  function parse(v: string): number | null { if (!v.trim()) return null; const n = parseFloat(v); return isFinite(n) && n >= 0 ? n : null }
  async function save() {
    setBusy(true)
    try {
      await adminApi.setLimits(user.id, {
        dailyWithdrawLimit: parse(dw),
        monthlyWithdrawLimit: parse(mw),
        dailyTransferLimit: parse(dt),
        monthlyTransferLimit: parse(mt),
      })
      toast.success('Limits updated'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4 text-[#0C8B44]" />Money-movement caps (USD)</h2>
      <p className="text-xs text-[#A0A0A0] mb-3">Leave blank to apply no cap. Caps are enforced server-side at request time.</p>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Daily withdrawal" value={dw} onChange={setDw} type="number" placeholder="No cap" />
        <Input label="Monthly withdrawal" value={mw} onChange={setMw} type="number" placeholder="No cap" />
        <Input label="Daily transfer" value={dt} onChange={setDt} type="number" placeholder="No cap" />
        <Input label="Monthly transfer" value={mt} onChange={setMt} type="number" placeholder="No cap" />
      </div>
      <button type="button" onClick={save} disabled={busy} className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"><Save className="w-4 h-4" />Save limits</button>
    </section>
  )
}

// ---------- IP allowlist panel (Profile tab) ----------
function IpAllowlistPanel({ user, onChange }: { user: AdminUserDetailResponse['user']; onChange: () => void }) {
  const [ips, setIps] = useState(user.ipAllowlist ?? '')
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await adminApi.setIpAllowlist(user.id, ips.trim() || null)
      toast.success('Allowlist saved'); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-2 flex items-center gap-2"><Wifi className="w-4 h-4 text-[#0C8B44]" />IP allowlist</h2>
      <p className="text-xs text-[#A0A0A0] mb-3">Comma-separated IP addresses or prefixes (e.g. <code className="text-[#0C8B44]">203.0.113.7, 198.51.100.</code>). When set, money-movement requests from other IPs are blocked. Leave blank to disable.</p>
      <Textarea label="Allowlist" value={ips} onChange={setIps} rows={2} mono />
      <button type="button" onClick={save} disabled={busy} className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"><Save className="w-4 h-4" />Save allowlist</button>
    </section>
  )
}

// ---------- Fee panel (Wallet tab) ----------
function FeePanel({ userId, balances, onChange }: { userId: string; balances: AdminWalletBalance[]; onChange: () => void }) {
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [feeType, setFeeType] = useState('maintenance')
  const [note, setNote] = useState('')
  const [allowNegative, setAllowNegative] = useState(false)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const currencyOptions = balances.length
    ? balances.map((b) => ({ value: b.currency, label: `${b.symbol} ${b.currency}` }))
    : [{ value: 'USD', label: '$ USD' }]
  async function submit(e: FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!isFinite(amt) || amt <= 0) { toast.error('Amount must be > 0'); return }
    setBusy(true)
    try {
      await adminApi.chargeFee(userId, { currency, amount: amt, feeType, note: note || undefined, allowNegative, notify })
      toast.success(`${amt} ${currency} fee charged`); setAmount(''); setNote(''); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-2xl bg-[#F57C00]/5 border border-[#F57C00]/20 p-6">
      <h2 className="text-sm font-medium text-[#F57C00] mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" />Charge fee</h2>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select label="Currency" value={currency} onChange={setCurrency} options={currencyOptions} />
        <Input label="Amount" value={amount} onChange={setAmount} type="number" placeholder="0.00" />
        <Select label="Fee type" value={feeType} onChange={setFeeType} options={FEE_TYPES} />
        <Input label="Note (shown to user)" value={note} onChange={setNote} />
        <div className="md:col-span-2 flex flex-wrap items-center gap-4 text-xs text-[#A0A0A0]">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#F57C00]" />Notify user</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} className="accent-[#F57C00]" />Allow negative balance</label>
        </div>
        <div className="md:col-span-2"><button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#F57C00] text-white text-sm rounded-lg hover:bg-[#e36e00] disabled:opacity-50"><DollarSign className="w-4 h-4" />{busy ? 'Charging…' : 'Charge fee'}</button></div>
      </form>
    </section>
  )
}

// ---------- Adjust holdings panel (Holdings tab) ----------
function AdjustHoldingPanel({ userId, onChange }: { userId: string; onChange: () => void }) {
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [symbol, setSymbol] = useState('BTC')
  const [name, setName] = useState('')
  const [type, setType] = useState<'crypto' | 'stock' | 'etf'>('crypto')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [reason, setReason] = useState('admin_correction')
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount); const px = parseFloat(price)
    if (!isFinite(amt) || amt <= 0) { toast.error('Amount must be > 0'); return }
    if (!isFinite(px) || px < 0) { toast.error('Price must be >= 0'); return }
    setBusy(true)
    try {
      await adminApi.adjustHolding(userId, { symbol, name: name || undefined, type, side, amount: amt, price: px, reason, note: note || undefined, notify })
      toast.success(`Recorded ${side} of ${amt} ${symbol}`); setAmount(''); setNote(''); onChange()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2"><Briefcase className="w-4 h-4 text-[#0C8B44]" />Adjust holding (recorded as a trade)</h2>
        <div className="flex rounded-lg bg-[#0a0f11] border border-[#ffffff10] p-0.5 text-xs">
          <button type="button" onClick={() => setSide('buy')} className={`px-3 py-1.5 rounded ${side === 'buy' ? 'bg-[#0C8B44] text-white' : 'text-[#A0A0A0]'}`}>Buy</button>
          <button type="button" onClick={() => setSide('sell')} className={`px-3 py-1.5 rounded ${side === 'sell' ? 'bg-[#f44336] text-white' : 'text-[#A0A0A0]'}`}>Sell</button>
        </div>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input label="Symbol" value={symbol} onChange={(v) => setSymbol(v.toUpperCase())} />
        <Input label="Name (optional)" value={name} onChange={setName} />
        <Select label="Type" value={type} onChange={(v) => setType(v as typeof type)} options={[{ value: 'crypto', label: 'Crypto' }, { value: 'stock', label: 'Stock' }, { value: 'etf', label: 'ETF' }]} />
        <Input label="Amount" value={amount} onChange={setAmount} type="number" />
        <Input label="Price" value={price} onChange={setPrice} type="number" />
        <Select label="Reason" value={reason} onChange={setReason} options={HOLDING_REASONS} />
        <div className="md:col-span-3"><Input label="Note (free-form)" value={note} onChange={setNote} /></div>
        <div className="md:col-span-3 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-[#A0A0A0]"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[#0C8B44]" />Notify user</label>
          <button type="submit" disabled={busy} className={`inline-flex items-center justify-center gap-2 px-6 py-2 text-white text-sm rounded-lg disabled:opacity-50 ${side === 'buy' ? 'bg-[#0C8B44] hover:bg-[#0a7539]' : 'bg-[#f44336] hover:bg-[#d32f2f]'}`}>{busy ? 'Working…' : `Record ${side}`}</button>
        </div>
      </form>
    </section>
  )
}

// ---------- Email user (Notifications tab) ----------
function EmailUserPanel({ userId, onSent }: { userId: string; onSent: () => void }) {
  const [template, setTemplate] = useState('none')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  function applyTemplate(value: string) {
    setTemplate(value)
    const t = EMAIL_TEMPLATES.find((x) => x.value === value)
    if (t) { setSubject(t.subject); setBody(t.body) }
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) { toast.error('Subject and body required'); return }
    setBusy(true)
    try {
      await adminApi.emailUser(userId, { subject, body, template })
      toast.success('Email queued (delivered as in-app notification)')
      setSubject(''); setBody(''); setTemplate('none'); onSent()
    } catch (err) { toast.error((err as { error?: string }).error || 'Failed') }
    finally { setBusy(false) }
  }
  return (
    <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
      <h2 className="text-sm font-medium text-[#E5E5E5] mb-3 flex items-center gap-2"><Mail className="w-4 h-4 text-[#0C8B44]" />Email user</h2>
      <p className="text-xs text-[#A0A0A0] mb-3">Choose a template or compose freely. Delivered in-app today; SMTP integration is a one-line swap on the server.</p>
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select label="Template" value={template} onChange={applyTemplate} options={EMAIL_TEMPLATES.map((t) => ({ value: t.value, label: t.label }))} />
        <div className="md:col-span-2"><Input label="Subject" value={subject} onChange={setSubject} /></div>
        <div className="md:col-span-3"><Textarea label="Body" value={body} onChange={setBody} rows={8} /></div>
        <div className="md:col-span-3"><button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"><Mail className="w-4 h-4" />{busy ? 'Sending…' : 'Send email'}</button></div>
      </form>
    </section>
  )
}

// ---------- Audit tab (per-user timeline) ----------
function AuditTab({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    adminApi.userAudit(userId, 500)
      .then((r) => setLogs(r.audit))
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load audit'))
      .finally(() => setLoading(false))
  }, [userId])
  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]">
          <tr><th className="text-left px-4 py-3 font-normal">When</th><th className="text-left px-4 py-3 font-normal">Action</th><th className="text-left px-4 py-3 font-normal">Actor</th><th className="text-left px-4 py-3 font-normal">Payload</th></tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={4} className="text-center py-8 text-[#737373]">Loading…</td></tr>}
          {!loading && logs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-[#737373]">No audit entries.</td></tr>}
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-[#ffffff05] align-top">
              <td className="px-4 py-3 text-[11px] text-[#737373] whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-[#E5E5E5] whitespace-nowrap">{l.action}</td>
              <td className="px-4 py-3 text-[11px] text-[#A0A0A0] whitespace-nowrap">{l.actor?.email ?? '—'}</td>
              <td className="px-4 py-3 text-[11px] text-[#737373] font-mono whitespace-pre-wrap break-all max-w-[480px]">{l.payload || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Inline editor for transaction descriptions on the admin Transactions tab.
// Saves via PATCH /api/admin/transactions/:id when the input loses focus or
// the admin presses Enter. Empty input clears the field. Escape reverts.
function ReferenceEditor({ value, onSave }: { value: string; onSave: (v: string) => void | Promise<void> }) {
  const [v, setV] = useState(value)
  const [dirty, setDirty] = useState(false)
  return (
    <input
      value={v}
      onChange={(e) => { setV(e.target.value); setDirty(e.target.value !== value) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setV(value); setDirty(false); (e.target as HTMLInputElement).blur() }
      }}
      onBlur={() => { if (dirty) { onSave(v.trim()); setDirty(false) } }}
      placeholder="—"
      aria-label="Edit transaction description"
      className="w-full bg-transparent border border-transparent hover:border-[#ffffff10] focus:border-[#0C8B44] focus:bg-[#0a0f11] rounded px-2 py-1 text-[11px] text-[#A0A0A0] focus:text-[#E5E5E5] outline-none transition-colors"
    />
  )
}