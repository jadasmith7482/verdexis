import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trophy, Medal, Crown } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'

interface Trader {
  rank: number
  name: string
  avatar: string
  gain: number
  trades: number
  winRate: number
  followers: number
  strategy: string
  badge: 'gold' | 'silver' | 'bronze' | null
}

const TRADERS: Trader[] = [
  { rank: 1, name: 'CryptoWhale99', avatar: 'CW', gain: 284.3, trades: 412, winRate: 78, followers: 3_201, strategy: 'Momentum swing', badge: 'gold' },
  { rank: 2, name: 'NightOwlTrader', avatar: 'NO', gain: 201.7, trades: 289, winRate: 71, followers: 2_180, strategy: 'Alt-season rotation', badge: 'silver' },
  { rank: 3, name: 'SatoshiSam', avatar: 'SS', gain: 178.4, trades: 198, winRate: 69, followers: 1_840, strategy: 'BTC/ETH pairs', badge: 'bronze' },
  { rank: 4, name: 'DeFiDynamo', avatar: 'DD', gain: 152.1, trades: 540, winRate: 65, followers: 1_320, strategy: 'DeFi yield farming', badge: null },
  { rank: 5, name: 'AIAlphaBot', avatar: 'AI', gain: 143.8, trades: 890, winRate: 63, followers: 980, strategy: 'Quant ML signals', badge: null },
  { rank: 6, name: 'GoldBullRon', avatar: 'GB', gain: 128.5, trades: 147, winRate: 72, followers: 740, strategy: 'Macro + BTC', badge: null },
  { rank: 7, name: 'LayerZeroLisa', avatar: 'LZ', gain: 119.2, trades: 231, winRate: 67, followers: 620, strategy: 'L2 ecosystem plays', badge: null },
  { rank: 8, name: 'AltcoinAlly', avatar: 'AA', gain: 108.9, trades: 378, winRate: 61, followers: 510, strategy: 'Small cap gems', badge: null },
  { rank: 9, name: 'StableSeeker', avatar: 'SK', gain: 98.4, trades: 95, winRate: 74, followers: 430, strategy: 'DeFi stablecoins', badge: null },
  { rank: 10, name: 'MemeKingDave', avatar: 'MK', gain: 87.1, trades: 612, winRate: 58, followers: 2_100, strategy: 'Meme momentum', badge: null },
]

const BADGE_ICON = {
  gold: <Crown className="w-4 h-4 text-yellow-400" />,
  silver: <Medal className="w-4 h-4 text-slate-300" />,
  bronze: <Medal className="w-4 h-4 text-amber-600" />,
}

export default function Leaderboard() { return <RequireAuth><LeaderboardInner /></RequireAuth> }

function LeaderboardInner() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-[#0C8B44]" />
              </div>
              <div>
                <h1 className="text-2xl font-light text-[#E5E5E5]">Leaderboard</h1>
                <p className="text-xs text-[#737373]">Top performing traders on Verdexis.</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', 'all'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-full text-xs transition-colors ${period === p ? 'bg-[#0C8B44] text-white' : 'bg-[#0f1619] border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
                  {p === 'all' ? 'All Time' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Top 3 podium */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[TRADERS[1], TRADERS[0], TRADERS[2]].map((t, idx) => {
              const isCenter = idx === 1
              return (
                <div key={t.rank} className={`rounded-2xl border p-6 text-center transition-all ${isCenter ? 'bg-[#0C8B44]/10 border-[#0C8B44]/30 scale-105' : 'bg-[#0f1619]/50 border-[#ffffff08]'}`}>
                  <div className="flex justify-center mb-2">{t.badge && BADGE_ICON[t.badge]}</div>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-3 ${isCenter ? 'bg-[#0C8B44]/20 text-[#0C8B44]' : 'bg-[#ffffff10] text-[#E5E5E5]'}`}>{t.avatar}</div>
                  <p className="text-sm font-medium text-[#E5E5E5]">{t.name}</p>
                  <p className="text-xs text-[#737373] mb-2">{t.strategy}</p>
                  <p className={`text-xl font-light ${isCenter ? 'text-[#0C8B44]' : 'text-[#E5E5E5]'}`}>+{t.gain}%</p>
                  <p className="text-[10px] text-[#737373] mt-1">#{t.rank} · {t.followers.toLocaleString()} followers</p>
                </div>
              )
            })}
          </div>

          {/* Full rankings */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
            <div className="grid grid-cols-7 gap-4 px-6 py-3 border-b border-[#ffffff08] text-[10px] uppercase tracking-[0.05em] text-[#737373]">
              <span>Rank</span>
              <span className="col-span-2">Trader</span>
              <span>Return</span>
              <span>Win Rate</span>
              <span>Trades</span>
              <span></span>
            </div>
            {TRADERS.map(t => (
              <div key={t.rank} className="grid grid-cols-7 gap-4 px-6 py-4 border-b border-[#ffffff05] hover:bg-[#ffffff04] transition-colors items-center">
                <div className="flex items-center gap-1">
                  {t.badge ? BADGE_ICON[t.badge] : <span className="text-sm text-[#737373]">#{t.rank}</span>}
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#0C8B44]/15 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{t.avatar}</div>
                  <div>
                    <p className="text-xs font-medium text-[#E5E5E5]">{t.name}</p>
                    <p className="text-[10px] text-[#737373]">{t.strategy}</p>
                  </div>
                </div>
                <span className="text-[#0C8B44] text-sm font-light">+{t.gain}%</span>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-[#ffffff10] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0C8B44] rounded-full" style={{ width: `${t.winRate}%` }} />
                    </div>
                    <span className="text-[10px] text-[#737373]">{t.winRate}%</span>
                  </div>
                </div>
                <span className="text-xs text-[#737373]">{t.trades}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#737373]">{t.followers.toLocaleString()} followers</span>
                  <button className="text-[10px] px-2 py-1 rounded bg-[#0C8B44]/10 text-[#0C8B44] hover:bg-[#0C8B44]/20 transition-colors">
                    Follow
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-[#737373] text-center mt-6">Returns are paper-calculated and for informational purposes only. Past performance does not guarantee future results.</p>
        </div>
      </div>
    </div>
  )
}
