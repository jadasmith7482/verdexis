import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminStats } from '../lib/adminApi'
import {
  Users, ShieldCheck, Ban, Briefcase, ArrowLeftRight, Bell,
  Banknote, UserPlus, MegaphoneIcon, Settings as Cog, Activity, FileCheck2, Lock, ArrowDownToLine, Clock,
} from 'lucide-react'

export default function AdminDashboard() {
  const [data, setData] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.stats()
      .then((d) => setData(d))
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load admin stats'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
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
                        <p className="text-sm text-[#E5E5E5] capitalize">{t.kind} · {t.amount.toLocaleString()} {t.currency}</p>
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
      </div>
    </div>
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
