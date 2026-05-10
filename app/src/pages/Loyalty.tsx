import { Link } from 'react-router-dom'
import { ArrowLeft, Gem, Zap, Star, Crown, CheckCircle } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'

interface Tier {
  name: string
  icon: React.ReactNode
  color: string
  bgColor: string
  volumeRequired: number
  makerFee: number
  takerFee: number
  perks: string[]
}

const TIERS: Tier[] = [
  {
    name: 'Bronze',
    icon: <Star className="w-6 h-6" />,
    color: '#cd7f32',
    bgColor: '#cd7f3220',
    volumeRequired: 0,
    makerFee: 0.10,
    takerFee: 0.12,
    perks: ['Standard execution', 'Email support', 'Access to all markets'],
  },
  {
    name: 'Silver',
    icon: <Star className="w-6 h-6" />,
    color: '#94a3b8',
    bgColor: '#94a3b820',
    volumeRequired: 10_000,
    makerFee: 0.08,
    takerFee: 0.10,
    perks: ['Reduced trading fees', 'Priority email support', '1 free wire withdrawal/mo'],
  },
  {
    name: 'Gold',
    icon: <Gem className="w-6 h-6" />,
    color: '#f59e0b',
    bgColor: '#f59e0b20',
    volumeRequired: 100_000,
    makerFee: 0.06,
    takerFee: 0.08,
    perks: ['Further reduced fees', 'Live chat support', '3 free wire withdrawals/mo', 'Early access to new features'],
  },
  {
    name: 'Platinum',
    icon: <Zap className="w-6 h-6" />,
    color: '#38bdf8',
    bgColor: '#38bdf820',
    volumeRequired: 500_000,
    makerFee: 0.04,
    takerFee: 0.06,
    perks: ['Lowest fees', 'Dedicated account manager', 'Unlimited free withdrawals', 'API rate limit doubling', 'Exclusive market reports'],
  },
  {
    name: 'Diamond',
    icon: <Crown className="w-6 h-6" />,
    color: '#a78bfa',
    bgColor: '#a78bfa20',
    volumeRequired: 2_000_000,
    makerFee: 0.02,
    takerFee: 0.04,
    perks: ['VIP fees', 'Personal relationship manager', 'OTC desk access', 'Custom API solutions', 'Exclusive webinars & briefings'],
  },
]

const MOCK_USER = {
  tier: 'Silver',
  volume30d: 34_200,
  nextTierVolume: 100_000,
}

export default function Loyalty() { return <RequireAuth><LoyaltyInner /></RequireAuth> }

function LoyaltyInner() {
  const currentTierIdx = TIERS.findIndex(t => t.name === MOCK_USER.tier)
  const currentTier = TIERS[currentTierIdx]
  const nextTier = TIERS[currentTierIdx + 1]
  const progress = nextTier ? (MOCK_USER.volume30d / nextTier.volumeRequired) * 100 : 100

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          {/* Current status */}
          <div className="rounded-2xl border p-6 mb-8" style={{ background: currentTier.bgColor, borderColor: `${currentTier.color}30` }}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: currentTier.bgColor, color: currentTier.color }}>
                  {currentTier.icon}
                </div>
                <div>
                  <p className="text-xs text-[#737373] uppercase tracking-[0.05em]">Current tier</p>
                  <h1 className="text-3xl font-light" style={{ color: currentTier.color }}>{currentTier.name}</h1>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#737373]">30-day volume</p>
                <p className="text-2xl font-light text-[#E5E5E5]">${MOCK_USER.volume30d.toLocaleString()}</p>
              </div>
            </div>

            {nextTier && (
              <div className="mt-6">
                <div className="flex justify-between text-xs text-[#737373] mb-2">
                  <span>{currentTier.name}</span>
                  <span>{nextTier.name} — ${nextTier.volumeRequired.toLocaleString()} vol needed</span>
                </div>
                <div className="w-full h-2 bg-[#ffffff10] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%`, background: currentTier.color }} />
                </div>
                <p className="text-[11px] text-[#737373] mt-2">${(nextTier.volumeRequired - MOCK_USER.volume30d).toLocaleString()} more in trading volume to reach {nextTier.name}</p>
              </div>
            )}
          </div>

          {/* Tiers grid */}
          <div className="grid md:grid-cols-5 gap-3 mb-8">
            {TIERS.map((tier, i) => {
              const isCurrent = tier.name === MOCK_USER.tier
              const isPast = i < currentTierIdx
              return (
                <div key={tier.name} className={`rounded-2xl border p-4 text-center transition-all ${isCurrent ? 'scale-105 shadow-lg' : ''}`} style={{ borderColor: isCurrent ? tier.color : '#ffffff10', background: isCurrent ? tier.bgColor : '#0f161950' }}>
                  <div className="flex justify-center mb-2" style={{ color: isPast || isCurrent ? tier.color : '#737373' }}>{tier.icon}</div>
                  <p className="text-xs font-medium text-[#E5E5E5]">{tier.name}</p>
                  <p className="text-[10px] text-[#737373] mt-1">${tier.volumeRequired >= 1_000_000 ? `${tier.volumeRequired / 1_000_000}M` : tier.volumeRequired >= 1000 ? `${tier.volumeRequired / 1000}K` : tier.volumeRequired} vol</p>
                  <p className="text-[10px] mt-2" style={{ color: tier.color }}>{tier.takerFee}% taker</p>
                  {isCurrent && <div className="mt-2 text-[9px] text-white bg-[#0C8B44] rounded-full px-2 py-0.5">Current</div>}
                </div>
              )
            })}
          </div>

          {/* Fee comparison table */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 mb-6">
            <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Fee Schedule</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#737373] border-b border-[#ffffff08]">
                    <th className="pb-3 text-left font-medium">Tier</th>
                    <th className="pb-3 text-left font-medium">30d Volume</th>
                    <th className="pb-3 text-left font-medium">Maker Fee</th>
                    <th className="pb-3 text-left font-medium">Taker Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ffffff05]">
                  {TIERS.map(tier => (
                    <tr key={tier.name} className={`${tier.name === MOCK_USER.tier ? 'bg-[#0C8B44]/05' : ''}`}>
                      <td className="py-3 pr-4 font-medium" style={{ color: tier.color }}>{tier.name}</td>
                      <td className="py-3 pr-4 text-[#737373]">${tier.volumeRequired >= 1_000_000 ? `${tier.volumeRequired / 1_000_000}M+` : tier.volumeRequired >= 1000 ? `${tier.volumeRequired / 1000}K+` : tier.volumeRequired === 0 ? 'Any' : `${tier.volumeRequired}+`}</td>
                      <td className="py-3 pr-4 text-[#E5E5E5]">{tier.makerFee}%</td>
                      <td className="py-3 text-[#E5E5E5]">{tier.takerFee}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Perks */}
          <div className="grid md:grid-cols-2 gap-4">
            {TIERS.map(tier => {
              const isCurrent = tier.name === MOCK_USER.tier
              const isPast = TIERS.indexOf(tier) < currentTierIdx
              return (
                <div key={tier.name} className={`rounded-2xl border p-5 ${isCurrent ? '' : ''}`} style={{ borderColor: isCurrent ? `${tier.color}40` : '#ffffff08', background: isCurrent ? tier.bgColor : '#0f161950' }}>
                  <div className="flex items-center gap-2 mb-3" style={{ color: isCurrent || isPast ? tier.color : '#737373' }}>
                    {tier.icon}
                    <span className="text-sm font-medium text-[#E5E5E5]">{tier.name} Perks</span>
                  </div>
                  <ul className="space-y-2">
                    {tier.perks.map(perk => (
                      <li key={perk} className="flex items-center gap-2 text-xs text-[#737373]">
                        <CheckCircle className="w-3 h-3 shrink-0" style={{ color: isPast || isCurrent ? tier.color : '#737373' }} />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
