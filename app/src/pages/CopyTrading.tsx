import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Users, TrendingUp, AlertCircle, Star } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'

interface Trader {
  id: string
  name: string
  avatar: string
  gain30d: number
  gain90d: number
  winRate: number
  trades: number
  followers: number
  riskScore: 'low' | 'medium' | 'high'
  strategy: string
  copiers: number
  isFollowing: boolean
}

const TRADERS: Trader[] = [
  { id: '1', name: 'CryptoWhale99', avatar: 'CW', gain30d: 28.4, gain90d: 71.2, winRate: 78, trades: 412, followers: 3201, riskScore: 'medium', strategy: 'Momentum swing', copiers: 841, isFollowing: false },
  { id: '2', name: 'NightOwlTrader', avatar: 'NO', gain30d: 18.1, gain90d: 52.3, winRate: 71, trades: 289, followers: 2180, riskScore: 'low', strategy: 'Alt-season rotation', copiers: 523, isFollowing: true },
  { id: '3', name: 'SatoshiSam', avatar: 'SS', gain30d: 14.9, gain90d: 44.8, winRate: 69, trades: 198, followers: 1840, riskScore: 'low', strategy: 'BTC/ETH pairs', copiers: 392, isFollowing: false },
  { id: '4', name: 'DeFiDynamo', avatar: 'DD', gain30d: 22.3, gain90d: 61.1, winRate: 65, trades: 540, followers: 1320, riskScore: 'high', strategy: 'DeFi yield farming', copiers: 289, isFollowing: false },
  { id: '5', name: 'AIAlphaBot', avatar: 'AI', gain30d: 11.8, gain90d: 38.2, winRate: 63, trades: 890, followers: 980, riskScore: 'low', strategy: 'Quant ML signals', copiers: 412, isFollowing: false },
]

const RISK_COLOR: Record<string, string> = {
  low: 'text-[#0C8B44] bg-[#0C8B44]/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  high: 'text-red-400 bg-red-400/10',
}

export default function CopyTrading() { return <RequireAuth><CopyTradingInner /></RequireAuth> }

function CopyTradingInner() {
  const [traders, setTraders] = useState(TRADERS)
  const [selected, setSelected] = useState<Trader | null>(null)
  const [copyAmount, setCopyAmount] = useState('500')

  const toggle = (id: string) => {
    setTraders(prev => prev.map(t => t.id === id ? { ...t, isFollowing: !t.isFollowing } : t))
  }

  const startCopy = () => {
    if (!selected) return
    if (!copyAmount || parseFloat(copyAmount) <= 0) { toast.error('Enter a valid amount'); return }
    toggle(selected.id)
    toast.success(`Now copying ${selected.name} with $${copyAmount}`)
    setSelected(null)
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Copy className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Copy Trading</h1>
              <p className="text-xs text-[#737373]">Automatically mirror top traders' positions in real time.</p>
            </div>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { step: '01', title: 'Choose a trader', desc: 'Browse top performers, review risk scores & strategies.' },
              { step: '02', title: 'Set your allocation', desc: 'Decide how much of your portfolio to allocate.' },
              { step: '03', title: 'Trades mirror automatically', desc: 'Every trade they make is proportionally mirrored in your account.' },
            ].map(s => (
              <div key={s.step} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 text-center">
                <div className="w-7 h-7 rounded-full bg-[#0C8B44]/15 text-[#0C8B44] text-xs font-bold flex items-center justify-center mx-auto mb-2">{s.step}</div>
                <p className="text-xs font-medium text-[#E5E5E5] mb-1">{s.title}</p>
                <p className="text-[11px] text-[#737373]">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Trader list */}
          <div className="space-y-4">
            {traders.map(t => (
              <div key={t.id} className={`rounded-2xl border p-5 transition-all ${t.isFollowing ? 'bg-[#0C8B44]/05 border-[#0C8B44]/20' : 'bg-[#0f1619]/50 border-[#ffffff08] hover:border-[#ffffff15]'}`}>
                <div className="flex flex-wrap items-center gap-4">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-[#0C8B44]/15 flex items-center justify-center text-sm font-bold text-[#0C8B44] shrink-0">{t.avatar}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#E5E5E5]">{t.name}</p>
                        {t.isFollowing && <span className="text-[10px] text-[#0C8B44] bg-[#0C8B44]/10 px-1.5 py-0.5 rounded-full font-medium">Copying</span>}
                      </div>
                      <p className="text-[11px] text-[#737373]">{t.strategy}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-xs font-medium text-[#0C8B44]">+{t.gain30d}%</p>
                      <p className="text-[10px] text-[#737373]">30d</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#E5E5E5]">+{t.gain90d}%</p>
                      <p className="text-[10px] text-[#737373]">90d</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#E5E5E5]">{t.winRate}%</p>
                      <p className="text-[10px] text-[#737373]">Win rate</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#E5E5E5]">{t.copiers}</p>
                      <p className="text-[10px] text-[#737373]">Copiers</p>
                    </div>
                  </div>

                  {/* Risk + action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] px-2 py-1 rounded font-medium ${RISK_COLOR[t.riskScore]}`}>{t.riskScore} risk</span>
                    {t.isFollowing ? (
                      <button onClick={() => { toggle(t.id); toast.success(`Stopped copying ${t.name}`) }} className="px-3 py-1.5 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">Stop copying</button>
                    ) : (
                      <button onClick={() => setSelected(t)} className="px-3 py-1.5 text-xs bg-[#0C8B44] text-white hover:bg-[#0a7539] rounded-lg transition-colors">Copy trader</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 mt-6 rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-4">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#737373]">Copy trading involves risk. Past performance of copied traders does not guarantee future results. You can stop copying at any time and all positions will remain open in your account.</p>
          </div>
        </div>

        {/* Copy modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setSelected(null)}>
            <div className="rounded-2xl bg-[#0f1619] border border-[#ffffff10] p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-medium text-[#E5E5E5] mb-1">Copy {selected.name}</h3>
              <p className="text-xs text-[#737373] mb-6">Set how much of your portfolio to allocate to this trader's strategy.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Allocation Amount (USD)</label>
                  <input type="number" value={copyAmount} onChange={e => setCopyAmount(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" min="50" />
                  <p className="text-[10px] text-[#737373] mt-1">Minimum: $50</p>
                </div>
                <div className="text-xs text-[#737373] space-y-1">
                  <div className="flex justify-between"><span>30d return</span><span className="text-[#0C8B44]">+{selected.gain30d}%</span></div>
                  <div className="flex justify-between"><span>Win rate</span><span className="text-[#E5E5E5]">{selected.winRate}%</span></div>
                  <div className="flex justify-between"><span>Risk level</span><span className={RISK_COLOR[selected.riskScore].split(' ')[0]}>{selected.riskScore}</span></div>
                </div>
                <button onClick={startCopy} className="w-full py-2.5 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg hover:bg-[#0a7539] transition-colors">
                  Start Copying
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
