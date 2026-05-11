import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import RequireAdmin from '../components/RequireAdmin'
import { adminApi } from '../lib/adminApi'
import { ArrowLeft, Gift, CheckCircle, Clock, XCircle } from 'lucide-react'

export default function AdminReferrals() {
  return <RequireAdmin><AdminReferralsInner /></RequireAdmin>
}

function AdminReferralsInner() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    totalReferrals: number
    activeReferrals: number
    pendingReferrals: number
    conversionRate: string
    totalBonusesAwarded: number
    totalBonusesPending: number
  } | null>(null)
  const [referrals, setReferrals] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const [statsResp, referralsResp] = await Promise.all([
          adminApi.get('/referrals/stats'),
          adminApi.get(`/referrals${filter !== 'all' ? `?status=${filter}` : ''}`),
        ])
        setStats(statsResp)
        setReferrals(referralsResp.referrals || [])
      } catch (e) {
        toast.error('Failed to load referral data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filter])

  const cancelReferral = async (referralId: string) => {
    if (!confirm('Are you sure you want to cancel this referral?')) return
    try {
      await adminApi.post(`/referrals/${referralId}/cancel`, { reason: 'admin_action' })
      toast.success('Referral cancelled')
      const updatedReferrals = await adminApi.get(`/referrals${filter !== 'all' ? `?status=${filter}` : ''}`)
      setReferrals(updatedReferrals.referrals || [])
    } catch (e) {
      toast.error('Failed to cancel referral')
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to admin
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-light text-[#E5E5E5] flex items-center gap-3 mb-2">
            <Gift className="w-8 h-8 text-[#0C8B44]" />Referral Program Management
          </h1>
          <p className="text-sm text-[#737373]">Monitor and manage the referral program</p>
        </div>

        {/* Stats */}
        {!loading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Total Referrals</p>
              <p className="text-2xl font-light text-[#E5E5E5]">{stats.totalReferrals}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Active</p>
              <p className="text-2xl font-light text-[#0C8B44]">{stats.activeReferrals}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Pending</p>
              <p className="text-2xl font-light text-yellow-400">{stats.pendingReferrals}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Conversion</p>
              <p className="text-2xl font-light text-[#E5E5E5]">{stats.conversionRate}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Awarded</p>
              <p className="text-2xl font-light text-[#4CAF50]">${stats.totalBonusesAwarded}</p>
            </div>
            <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1">Pending Pay</p>
              <p className="text-2xl font-light text-orange-400">${stats.totalBonusesPending}</p>
            </div>
          </div>
        )}

        {/* Filter and List */}
        <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          <div className="bg-[#0a0e10] border-b border-[#ffffff08] px-6 py-4 flex items-center gap-4">
            <p className="text-sm font-medium text-[#E5E5E5]">Referrals</p>
            <div className="flex gap-2">
              {(['all', 'active', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                    filter === f
                      ? 'bg-[#0C8B44] text-white'
                      : 'bg-[#ffffff05] text-[#A0A0A0] hover:bg-[#ffffff10]'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Pending'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">Loading...</div>
          ) : referrals.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[#737373]">No referrals found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0e10] border-b border-[#ffffff08]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Referrer</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Referee Email</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Status</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Deposit</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Joined</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-[#737373] font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-[#ffffff08] hover:bg-[#0a0e10]/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-[#E5E5E5] font-medium">{r.referrer?.name || r.referrer?.email || 'Unknown'}</p>
                        <p className="text-xs text-[#737373]">{r.referrer?.id}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[#E5E5E5]">{r.refereeEmail}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                            r.status === 'active'
                              ? 'bg-[#0C8B44]/15 text-[#0C8B44]'
                              : r.status === 'pending'
                                ? 'bg-yellow-400/15 text-yellow-400'
                                : 'bg-red-500/15 text-red-500'
                          }`}
                        >
                          {r.status === 'active' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : r.status === 'pending' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {r.firstDepositAmount ? (
                          <p className="text-[#E5E5E5]">${r.firstDepositAmount.toFixed(2)}</p>
                        ) : (
                          <p className="text-xs text-[#737373]">—</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#A0A0A0]">
                        {r.firstDepositAt ? new Date(r.firstDepositAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {r.status === 'active' && r.referrerBonusUsd ? (
                            <button
                              onClick={() => {/* Award bonus endpoint */ }}
                              className="px-3 py-1 text-xs bg-[#0C8B44]/20 text-[#0C8B44] rounded-lg hover:bg-[#0C8B44]/30 transition-colors"
                            >
                              Award $250
                            </button>
                          ) : null}
                          {r.status !== 'cancelled' ? (
                            <button
                              onClick={() => cancelReferral(r.id)}
                              className="px-3 py-1 text-xs bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-colors"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
