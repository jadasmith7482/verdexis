import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminStats } from '../lib/adminApi'
import {
  Users, ShieldCheck, Ban, Briefcase, ArrowLeftRight, Bell,
  Banknote, UserPlus, MegaphoneIcon, Settings as Cog, Activity, FileCheck2, Lock, ArrowDownToLine, Clock,
  Link2 as LinkIcon, ExternalLink,
} from 'lucide-react'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <AdminConsoleContent />
      </div>
    </div>
  )
}

// Inner content extracted so it can be embedded inside the regular Dashboard.
// Renders no Navigation / page chrome — just the operator console body.
export function AdminConsoleContent({ onPendingDepositsLoaded }: { onPendingDepositsLoaded?: (n: number) => void } = {}) {
  const [data, setData] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingDeposits, setPendingDeposits] = useState<Awaited<ReturnType<typeof adminApi.listPendingDeposits>>['deposits']>([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [busyTx, setBusyTx] = useState<string | null>(null)
  const [onchain, setOnchain] = useState<Awaited<ReturnType<typeof adminApi.listOnchainDeposits>>['pendingDeposits']>([])
  const [onchainLoading, setOnchainLoading] = useState(true)
  const [busyOnchain, setBusyOnchain] = useState<string | null>(null)

  useEffect(() => {
    adminApi.stats()
      .then((d) => setData(d))
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load admin stats'))
      .finally(() => setLoading(false))
  }, [])

  const refreshPending = () => {
    setPendingLoading(true)
    adminApi.listPendingDeposits()
      .then((r) => { setPendingDeposits(r.deposits); onPendingDepositsLoaded?.(r.deposits.length) })
      .catch(() => { /* surfaced when admin acts */ })
      .finally(() => setPendingLoading(false))
  }
  const refreshOnchain = () => {
    setOnchainLoading(true)
    adminApi.listOnchainDeposits('pending')
      .then((r) => setOnchain(r.pendingDeposits))
      .catch(() => { /* surfaced when admin acts */ })
      .finally(() => setOnchainLoading(false))
  }
  useEffect(() => {
    refreshPending()
    refreshOnchain()
    const t = setInterval(() => { refreshPending(); refreshOnchain() }, 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleApprove(id: string) {
    setBusyTx(id)
    try {
      await adminApi.approveDeposit(id)
      toast.success('Deposit approved — funds credited to user')
      refreshPending()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally { setBusyTx(null) }
  }
  async function handleReject(id: string) {
    const reason = window.prompt('Reason for rejection (shown to user)?', '') || ''
    setBusyTx(id)
    try {
      await adminApi.rejectDeposit(id, reason)
      toast.success('Deposit rejected')
      refreshPending()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Rejection failed')
    } finally { setBusyTx(null) }
  }

  async function handleApproveOnchain(d: typeof onchain[number]) {
    // Admin can override the credited currency / amount via prompts. Default
    // to the asset+amount the user submitted, which is usually correct.
    const currencyInput = window.prompt(
      `Credit user as which currency?\n(Default: ${d.asset}. Type USD to credit cash equivalent instead.)`,
      d.asset,
    )
    if (currencyInput === null) return
    const amountInput = window.prompt(
      `Credit how much ${currencyInput}?\n(Default: ${d.amount} — the on-chain amount.)`,
      String(d.amount),
    )
    if (amountInput === null) return
    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Invalid amount'); return }
    const note = window.prompt('Optional note for the audit log / user notification:', '') || undefined
    setBusyOnchain(d.id)
    try {
      await adminApi.approveOnchainDeposit(d.id, { currency: currencyInput.trim().toUpperCase(), amount, note })
      toast.success(`Credited ${amount} ${currencyInput} to ${d.user.email}`)
      refreshOnchain()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Approval failed')
    } finally { setBusyOnchain(null) }
  }
  async function handleRejectOnchain(d: typeof onchain[number]) {
    const note = window.prompt('Reason for rejection (shown to user)?', '') || ''
    setBusyOnchain(d.id)
    try {
      await adminApi.rejectOnchainDeposit(d.id, note)
      toast.success('On-chain deposit rejected')
      refreshOnchain()
    } catch (e) {
      toast.error((e as { error?: string }).error || 'Rejection failed')
    } finally { setBusyOnchain(null) }
  }

  return (
    <>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5]">Admin console</h1>
            <p className="text-xs text-[#737373]">Full operator control over every account on this instance.</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <QuickLink to="/admin/users" icon={<Users className="w-5 h-5" />} label="Users" />
          <QuickLink to="/admin/transfer" icon={<ArrowLeftRight className="w-5 h-5" />} label="A→B transfer" />
          <QuickLink to="/admin/deposits" icon={<Banknote className="w-5 h-5" />} label="Deposit settings" />
          <QuickLink to="/admin/broadcast" icon={<MegaphoneIcon className="w-5 h-5" />} label="Broadcast" />
          <QuickLink to="/admin/audit" icon={<Activity className="w-5 h-5" />} label="Audit log" />
        </div>

        {/* Stats */}
        {loading ? (
          <div className="text-center py-12 text-[#737373] text-sm">Loading…</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Stat icon={<Users className="w-4 h-4" />} label="Total users" value={data.stats.users} to="/admin/users" />
              <Stat icon={<ShieldCheck className="w-4 h-4" />} label="Admins" value={data.stats.admins} to="/admin/users?role=admin" />
              <Stat icon={<Ban className="w-4 h-4" />} label="Suspended" value={data.stats.suspended} accent="red" to="/admin/users?suspended=true" />
              <Stat icon={<UserPlus className="w-4 h-4" />} label="Signups (24h)" value={data.stats.signups24h} accent="green" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <Stat icon={<Briefcase className="w-4 h-4" />} label="Holdings" value={data.stats.holdings} />
              <Stat icon={<ArrowLeftRight className="w-4 h-4" />} label="Trades" value={data.stats.trades} />
              <Stat icon={<Bell className="w-4 h-4" />} label="Active alerts" value={data.stats.alerts} />
              <Stat icon={<Banknote className="w-4 h-4" />} label="Deposits (24h)" value={data.stats.deposits24h} accent="green" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Stat icon={<FileCheck2 className="w-4 h-4" />} label="KYC pending" value={data.stats.kycPending} accent="orange" to="/admin/users?kyc=pending" />
              <Stat icon={<Lock className="w-4 h-4" />} label="Accounts on hold" value={data.stats.holds} accent="orange" to="/admin/users?hold=true" />
              <Stat icon={<ArrowDownToLine className="w-4 h-4" />} label="Withdrawals (24h)" value={data.stats.withdraws24h} />
              <BroadcastCard last={data.lastBroadcast} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#0C8B44]" /> Recent signups</h2>
                <div className="space-y-2">
                  {data.recentSignups.length === 0 && <p className="text-xs text-[#737373]">None yet.</p>}
                  {data.recentSignups.map((u) => (
                    <Link key={u.id} to={`/admin/users/${u.id}`} className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm text-[#E5E5E5] truncate">{u.name}</p>
                        <p className="text-[11px] text-[#737373] truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {u.role === 'admin' && <span className="text-[9px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-1.5 py-0.5 rounded">Admin</span>}
                        {u.suspended && <span className="text-[9px] uppercase tracking-wider text-[#f44336] bg-[#f44336]/10 px-1.5 py-0.5 rounded">Susp</span>}
                        <span className="text-[10px] text-[#737373]">{relTime(u.createdAt)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
                <h2 className="text-sm font-medium text-[#E5E5E5] mb-4 flex items-center gap-2"><Banknote className="w-4 h-4 text-[#0C8B44]" /> Recent transactions</h2>
                <div className="space-y-2">
                  {data.recentTx.length === 0 && <p className="text-xs text-[#737373]">No activity yet.</p>}
                  {data.recentTx.map((t) => (
                    <Link key={t.id} to={`/admin/users/${t.user.id}`} className="flex items-center justify-between p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm text-[#E5E5E5] capitalize">{t.kind} · {(t.amount ?? 0).toLocaleString()} {t.currency}</p>
                        <p className="text-[11px] text-[#737373] truncate">{t.user.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${statusColor(t.status)}`}>{t.status}</span>
                        <span className="text-[10px] text-[#737373]">{relTime(t.createdAt)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-[#737373] text-sm flex items-center justify-center gap-2">
            <Cog className="w-4 h-4" /> Stats unavailable
          </div>
        )}

        {/* Pending deposit approvals */}
        <section className="mt-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
              <Banknote className="w-4 h-4 text-[#F57C00]" /> Pending deposit approvals
              {pendingDeposits.length > 0 && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F57C00]/15 text-[#F57C00]">{pendingDeposits.length}</span>
              )}
            </h2>
            <button type="button" onClick={refreshPending} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">Refresh</button>
          </div>
          {pendingLoading ? (
            <p className="text-xs text-[#737373]">Loading…</p>
          ) : pendingDeposits.length === 0 ? (
            <p className="text-xs text-[#737373]">No pending deposit requests. New user deposits will appear here for approval before they affect balances.</p>
          ) : (
            <div className="space-y-2">
              {pendingDeposits.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[#E5E5E5]">{d.user.name} <span className="text-[#737373]">·</span> <span className="text-[11px] text-[#737373]">{d.user.email}</span></p>
                      {d.user.suspended && <span className="text-[9px] uppercase tracking-wider text-[#f44336] bg-[#f44336]/10 px-1.5 py-0.5 rounded">Susp</span>}
                      {d.user.kycStatus !== 'approved' && <span className="text-[9px] uppercase tracking-wider text-[#F57C00] bg-[#F57C00]/10 px-1.5 py-0.5 rounded">KYC {d.user.kycStatus}</span>}
                    </div>
                    <p className="text-[11px] text-[#737373] truncate">{d.reference || 'No reference'} · {relTime(d.createdAt)} ago</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-medium text-[#E5E5E5]">{(d.amount ?? 0).toLocaleString()} {d.currency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={busyTx === d.id} onClick={() => handleApprove(d.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50">Approve</button>
                    <button type="button" disabled={busyTx === d.id} onClick={() => handleReject(d.id)} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* On-chain pending deposits (from connected self-custody wallets) */}
        <section className="mt-6 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-[#E5E5E5] flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-[#3B99FC]" /> On-chain deposit approvals
              {onchain.length > 0 && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#3B99FC]/15 text-[#3B99FC]">{onchain.length}</span>
              )}
            </h2>
            <button type="button" onClick={refreshOnchain} className="text-[11px] text-[#A0A0A0] hover:text-[#0C8B44]">Refresh</button>
          </div>
          <p className="text-[11px] text-[#737373] mb-3">
            Deposits initiated from a user&rsquo;s connected self-custody wallet (MetaMask / WalletConnect / etc.) to the admin treasury address.
            Click the tx hash to verify on-chain, then approve to credit the user.
          </p>
          {onchainLoading ? (
            <p className="text-xs text-[#737373]">Loading…</p>
          ) : onchain.length === 0 ? (
            <p className="text-xs text-[#737373]">No on-chain deposits awaiting verification.</p>
          ) : (
            <div className="space-y-2">
              {onchain.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/admin/users/${d.user.id}`} className="text-sm text-[#E5E5E5] hover:text-[#0C8B44]">{d.user.name}</Link>
                      <span className="text-[#737373]">·</span>
                      <span className="text-[11px] text-[#737373]">{d.user.email}</span>
                      <span className="text-[9px] uppercase tracking-wider text-[#3B99FC] bg-[#3B99FC]/10 px-1.5 py-0.5 rounded">Chain {d.chainId}</span>
                    </div>
                    <p className="text-[11px] text-[#737373] truncate font-mono mt-1">
                      from {d.fromAddress.slice(0, 10)}…{d.fromAddress.slice(-6)} → {d.toAddress.slice(0, 10)}…{d.toAddress.slice(-6)}
                    </p>
                    <p className="text-[10px] text-[#737373] mt-1">
                      <a href={d.explorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#3B99FC] hover:underline font-mono">
                        {d.txHash.slice(0, 14)}…{d.txHash.slice(-6)} <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-[#737373]"> · {relTime(d.createdAt)} ago</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-medium text-[#E5E5E5]">{d.amount} {d.asset}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={busyOnchain === d.id} onClick={() => handleApproveOnchain(d)} className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539] disabled:opacity-50">Approve & credit</button>
                    <button type="button" disabled={busyOnchain === d.id} onClick={() => handleRejectOnchain(d)} className="px-3 py-1.5 text-xs rounded-lg bg-[#1a1a1a] border border-[#f44336]/40 text-[#f44336] hover:bg-[#f44336]/10 disabled:opacity-50">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
    </>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-4 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] hover:border-[#0C8B44]/40 hover:bg-[#0C8B44]/5 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center text-[#0C8B44]">{icon}</div>
      <span className="text-sm text-[#E5E5E5]">{label}</span>
    </Link>
  )
}

function Stat({ icon, label, value, accent, to }: { icon: React.ReactNode; label: string; value: number; accent?: 'green' | 'red' | 'orange'; to?: string }) {
  const color = accent === 'red' ? 'text-[#f44336]' : accent === 'green' ? 'text-[#4CAF50]' : accent === 'orange' ? 'text-[#F57C00]' : 'text-[#E5E5E5]'
  const inner = (
    <>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">{icon}<span>{label}</span></div>
      <p className={`text-2xl font-light ${color}`}>{value.toLocaleString()}</p>
    </>
  )
  if (to) return <Link to={to} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 hover:border-[#0C8B44]/40 transition-colors block">{inner}</Link>
  return <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">{inner}</div>
}

function BroadcastCard({ last }: { last: AdminStats['lastBroadcast'] }) {
  return (
    <Link to="/admin/broadcast" className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 hover:border-[#0C8B44]/40 transition-colors block">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2"><Clock className="w-4 h-4" /><span>Last broadcast</span></div>
      {last ? (
        <>
          <p className="text-sm text-[#E5E5E5]">{relTime(last.at)} ago</p>
          <p className="text-[10px] text-[#737373] truncate">{last.by ?? 'system'}</p>
        </>
      ) : (
        <p className="text-sm text-[#A0A0A0]">None yet</p>
      )}
    </Link>
  )
}

function relTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-[#4CAF50] bg-[#4CAF50]/10'
    case 'pending': return 'text-[#F57C00] bg-[#F57C00]/10'
    case 'failed':
    case 'reversed': return 'text-[#f44336] bg-[#f44336]/10'
    default: return 'text-[#A0A0A0] bg-[#1a1a1a]'
  }
}
