import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, Copy, Check, Share2, Gift, TrendingUp } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'
import { api } from '../lib/api'

export default function Referral() { return <RequireAuth><ReferralInner /></RequireAuth> }

function ReferralInner() {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<Array<{
    id: string
    refereeEmail: string
    status: string
    firstDepositAt: string | null
    firstDepositAmount: number | null
    referrerBonusUsd: number | null
  }>>([])
  const [totalEarned, setTotalEarned] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const [summary, listData] = await Promise.all([
          api.getReferralSummary(),
          api.getReferralList(),
        ])
        setReferralCode(summary.referralCode)
        setTotalEarned(summary.totalEarned)
        setActiveCount(summary.activeReferrals)
        setPendingCount(summary.pendingReferrals)
        setReferrals(listData.referrals || [])
      } catch (e) {
        toast.error('Failed to load referral data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const referralLink = referralCode ? `https://verdexis.com/signup?ref=${referralCode}` : ''

  const copy = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true)
      toast.success('Referral link copied!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          {/* Header */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0C8B44]/20 to-[#0f1619] border border-[#0C8B44]/20 p-8 mb-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#0C8B44]/15 flex items-center justify-center mx-auto mb-4">
              <Gift className="w-7 h-7 text-[#0C8B44]" />
            </div>
            <h1 className="text-3xl font-light text-[#E5E5E5] mb-2">Refer & Earn</h1>
            <p className="text-sm text-[#737373] mb-6 max-w-md mx-auto">
              Invite friends to Verdexis. You get <span className="text-[#0C8B44] font-medium">$250</span> in trading credits for every friend who signs up and makes their first deposit.
            </p>

            {/* Referral link */}
            {referralCode && referralLink ? (
              <>
                <div className="flex items-center gap-2 max-w-lg mx-auto">
                  <div className="flex-1 px-4 py-3 bg-[#0a0f11] border border-[#ffffff10] rounded-xl text-sm text-[#737373] text-left overflow-hidden text-ellipsis whitespace-nowrap">
                    {referralLink}
                  </div>
                  <button onClick={copy} className="flex items-center gap-2 px-4 py-3 bg-[#0C8B44] text-white text-xs font-medium rounded-xl hover:bg-[#0a7539] transition-colors shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="flex items-center justify-center gap-4 mt-4">
                  <span className="text-xs text-[#737373]">Your code: <span className="text-[#E5E5E5] font-mono">{referralCode}</span></span>
                  <button onClick={copy} className="flex items-center gap-1 text-xs text-[#0C8B44] hover:text-[#0a7539] transition-colors">
                    <Share2 className="w-3 h-3" />Share
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-[#737373]">Loading referral code...</div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Earned', value: `$${totalEarned}`, icon: TrendingUp, color: '#0C8B44' },
              { label: 'Active Referrals', value: activeCount, icon: Users, color: '#0C8B44' },
              { label: 'Pending', value: pendingCount, icon: Users, color: '#737373' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} />
                <p className="text-2xl font-light text-[#E5E5E5]">{s.value}</p>
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-6">
            <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">How it works</h2>
            <div className="grid grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Share your link', desc: 'Send your unique referral link or code to friends.' },
                { step: '02', title: 'Friend signs up', desc: 'They create an account using your link and make a deposit ≥ $50.' },
                { step: '03', title: 'Both get rewarded', desc: 'You receive $250 in trading credits. Your friend gets a $10 bonus.' },
              ].map(s => (
                <div key={s.step} className="text-center">
                  <div className="w-8 h-8 rounded-full bg-[#0C8B44]/15 text-[#0C8B44] text-xs font-bold flex items-center justify-center mx-auto mb-3">{s.step}</div>
                  <p className="text-xs font-medium text-[#E5E5E5] mb-1">{s.title}</p>
                  <p className="text-[11px] text-[#737373]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Referral list */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
            <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Your Referrals</h2>
            {loading ? (
              <p className="text-xs text-[#737373] text-center py-6">Loading referrals...</p>
            ) : referrals.length === 0 ? (
              <p className="text-xs text-[#737373] text-center py-6">No referrals yet. Share your link to get started!</p>
            ) : (
              <div className="space-y-3">
                {referrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl bg-[#0a0f11] border border-[#ffffff08] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#0C8B44]/15 flex items-center justify-center text-[10px] font-bold text-[#0C8B44]">{r.refereeEmail[0]?.toUpperCase()}</div>
                      <div>
                        <p className="text-xs text-[#E5E5E5]">{r.refereeEmail}</p>
                        <p className="text-[10px] text-[#737373]">
                          {r.firstDepositAt ? `Joined ${new Date(r.firstDepositAt).toLocaleDateString()}` : 'Awaiting first deposit'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === 'active' ? 'text-[#0C8B44] bg-[#0C8B44]/10' : 'text-yellow-400 bg-yellow-400/10'}`}>{r.status}</span>
                      <span className="text-xs text-[#E5E5E5]">{r.referrerBonusUsd ? `+$${r.referrerBonusUsd}` : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
