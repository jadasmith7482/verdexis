import { Link } from 'react-router-dom'
import { ArrowLeft, Zap, Star, Bug, TrendingUp, Package } from 'lucide-react'
import Navigation from '../components/Navigation'

interface Release {
  version: string
  date: string
  entries: { type: 'feature' | 'fix' | 'improvement' | 'security'; text: string }[]
}

const RELEASES: Release[] = [
  {
    version: '2.8.0',
    date: 'May 10, 2026',
    entries: [
      { type: 'feature', text: 'Copy Trading — automatically mirror top traders with a single click' },
      { type: 'feature', text: 'Tax-Loss Harvesting — identify positions with unrealized losses and harvest with one tap' },
      { type: 'feature', text: 'NFT Portfolio Tracker — view your NFT collections, floor prices, and P&L' },
      { type: 'feature', text: 'Sub-Accounts — organize your portfolio into separate named buckets' },
      { type: 'feature', text: 'Rebalance Tool — set target allocations and rebalance with one click' },
      { type: 'feature', text: 'Integrations Hub — manage webhooks, API keys, and third-party connections' },
      { type: 'improvement', text: 'Achievements system upgraded with 5 new milestones' },
      { type: 'fix', text: 'Fixed an issue where paper trading P&L wasn\'t updating in real time' },
    ],
  },
  {
    version: '2.7.0',
    date: 'Apr 22, 2026',
    entries: [
      { type: 'feature', text: 'Paper Trading — trade with $100K virtual money, zero risk' },
      { type: 'feature', text: 'Screener — filter assets by RSI, MACD, volume, and category' },
      { type: 'feature', text: 'Economic Calendar — track macro events, Fed meetings, and crypto catalysts' },
      { type: 'feature', text: 'Leaderboard — see top-performing traders ranked by return' },
      { type: 'feature', text: 'Referral Program — earn $25 credit for every qualified referral' },
      { type: 'improvement', text: 'Learn Center redesign with progress tracking' },
      { type: 'fix', text: 'Fixed flicker on dark mode toggle' },
    ],
  },
  {
    version: '2.6.0',
    date: 'Mar 14, 2026',
    entries: [
      { type: 'feature', text: 'KYC Identity Verification — 4-step wizard for identity, address, and selfie upload' },
      { type: 'feature', text: 'Loyalty Tiers — Bronze to Diamond tier system with fee discounts' },
      { type: 'feature', text: 'Achievements & XP — gamified milestones with level progression' },
      { type: 'improvement', text: 'AI Analyst response speed improved by 40%' },
      { type: 'security', text: 'Session token expiry now enforced at 24 hours with silent refresh' },
    ],
  },
  {
    version: '2.5.2',
    date: 'Feb 28, 2026',
    entries: [
      { type: 'fix', text: 'Fixed price alert notifications not firing for SOL/USD pair' },
      { type: 'fix', text: 'Resolved wallet balance discrepancy after failed transaction rollback' },
      { type: 'improvement', text: 'Improved chart loading speed on slower connections' },
    ],
  },
  {
    version: '2.5.0',
    date: 'Feb 10, 2026',
    entries: [
      { type: 'feature', text: 'DCA Scheduler — set up automated recurring crypto purchases' },
      { type: 'feature', text: 'Goals Tracker — set financial milestones with automated contributions' },
      { type: 'improvement', text: 'Dashboard layout now fully customizable with drag-and-drop widgets' },
      { type: 'security', text: 'Two-factor authentication (TOTP) now available for all accounts' },
    ],
  },
  {
    version: '2.4.0',
    date: 'Jan 5, 2026',
    entries: [
      { type: 'feature', text: 'WhatsApp Alerts — receive price alerts directly via WhatsApp' },
      { type: 'feature', text: 'Linked Wallets — connect MetaMask, Phantom, and other wallets' },
      { type: 'improvement', text: 'Net Worth Chart now shows 1Y and All-time views' },
      { type: 'fix', text: 'Fixed CSV export encoding for non-ASCII characters' },
    ],
  },
]

const TYPE_META: Record<string, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  feature: { label: 'New', color: '#0C8B44', Icon: (p) => <Zap className={p.className} /> },
  improvement: { label: 'Improved', color: '#38bdf8', Icon: (p) => <TrendingUp className={p.className} /> },
  fix: { label: 'Fix', color: '#f59e0b', Icon: (p) => <Bug className={p.className} /> },
  security: { label: 'Security', color: '#a78bfa', Icon: (p) => <Star className={p.className} /> },
}

export default function Changelog() {
  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back
          </Link>

          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#E5E5E5]">Changelog</h1>
              <p className="text-xs text-[#737373]">What's new in VERDEXIS — most recent first.</p>
            </div>
          </div>

          <div className="space-y-10">
            {RELEASES.map((r, i) => (
              <div key={r.version} className="relative pl-6">
                {/* Timeline line */}
                {i < RELEASES.length - 1 && (
                  <div className="absolute left-2 top-8 bottom-0 w-px bg-[#ffffff08]" />
                )}
                {/* Timeline dot */}
                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-[#0C8B44]/20 border border-[#0C8B44]/40 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0C8B44]" />
                </div>

                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-sm font-medium text-[#E5E5E5]">v{r.version}</span>
                  {i === 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0C8B44]/15 text-[#0C8B44] font-medium">Latest</span>}
                  <span className="text-xs text-[#737373]">{r.date}</span>
                </div>

                <div className="space-y-2">
                  {r.entries.map((e, j) => {
                    const meta = TYPE_META[e.type]
                    return (
                      <div key={j} className="flex items-start gap-3">
                        <span className="text-[10px] px-2 py-0.5 rounded shrink-0 mt-0.5 font-medium" style={{ color: meta.color, background: `${meta.color}15` }}>
                          {meta.label}
                        </span>
                        <p className="text-xs text-[#737373]">{e.text}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center text-xs text-[#737373]">
            See even earlier releases in our <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[#0C8B44] hover:underline">GitHub repository</a>.
          </div>
        </div>
      </div>
    </div>
  )
}
