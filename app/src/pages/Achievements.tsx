import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Zap, Trophy, Star, Target, TrendingUp, Flame, Lock } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'

interface Achievement {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  xp: number
  unlocked: boolean
  progress?: number
  max?: number
  category: string
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-trade', title: 'First Trade', description: 'Execute your very first trade on Verdexis.', icon: <Zap />, xp: 50, unlocked: true, category: 'Trading' },
  { id: 'five-trades', title: 'Active Trader', description: 'Complete 5 trades.', icon: <TrendingUp />, xp: 100, unlocked: true, progress: 5, max: 5, category: 'Trading' },
  { id: '100-trades', title: 'Centurion', description: 'Complete 100 trades.', icon: <Flame />, xp: 500, unlocked: false, progress: 23, max: 100, category: 'Trading' },
  { id: 'first-goal', title: 'Goal Setter', description: 'Create your first financial goal.', icon: <Target />, xp: 50, unlocked: true, category: 'Goals' },
  { id: 'goal-hit', title: 'Goal Crusher', description: 'Reach 100% progress on any goal.', icon: <Trophy />, xp: 200, unlocked: false, category: 'Goals' },
  { id: 'first-deposit', title: 'Funded', description: 'Make your first deposit.', icon: <Star />, xp: 75, unlocked: true, category: 'Account' },
  { id: 'kyc', title: 'Verified', description: 'Complete KYC identity verification.', icon: <Star />, xp: 150, unlocked: false, category: 'Account' },
  { id: 'watchlist-5', title: 'Watcher', description: 'Add 5 assets to your watchlist.', icon: <Star />, xp: 75, unlocked: true, progress: 5, max: 5, category: 'Markets' },
  { id: 'alert-10', title: 'Alert Master', description: 'Create 10 price alerts.', icon: <Zap />, xp: 100, unlocked: false, progress: 3, max: 10, category: 'Markets' },
  { id: 'ai-chat', title: 'AI Curious', description: 'Have your first conversation with the AI assistant.', icon: <Flame />, xp: 50, unlocked: true, category: 'AI' },
  { id: 'paper-trade', title: 'Simulator', description: 'Place your first paper trade.', icon: <TrendingUp />, xp: 75, unlocked: false, category: 'Trading' },
  { id: 'portfolio-10k', title: 'Five-Figure Portfolio', description: 'Reach $10,000 in portfolio value.', icon: <Trophy />, xp: 300, unlocked: false, progress: 4200, max: 10000, category: 'Portfolio' },
  { id: 'referral-1', title: 'Ambassador', description: 'Refer your first friend to Verdexis.', icon: <Star />, xp: 100, unlocked: false, category: 'Community' },
  { id: 'learn-1', title: 'Student', description: 'Complete your first learning course.', icon: <Star />, xp: 100, unlocked: false, category: 'Learning' },
  { id: 'streak-7', title: '7-Day Streak', description: 'Log in for 7 consecutive days.', icon: <Flame />, xp: 200, unlocked: false, progress: 3, max: 7, category: 'Account' },
]

const CATEGORIES = ['All', ...Array.from(new Set(ACHIEVEMENTS.map(a => a.category)))]

const XP_LEVELS = [
  { level: 1, xpRequired: 0, title: 'Novice' },
  { level: 2, xpRequired: 200, title: 'Explorer' },
  { level: 3, xpRequired: 500, title: 'Trader' },
  { level: 4, xpRequired: 1000, title: 'Analyst' },
  { level: 5, xpRequired: 2000, title: 'Expert' },
  { level: 6, xpRequired: 4000, title: 'Veteran' },
  { level: 7, xpRequired: 7000, title: 'Master' },
]

export default function Achievements() { return <RequireAuth><AchievementsInner /></RequireAuth> }

function AchievementsInner() {
  const [category, setCategory] = useState('All')

  const totalXp = ACHIEVEMENTS.filter(a => a.unlocked).reduce((s, a) => s + a.xp, 0)
  const currentLevel = [...XP_LEVELS].reverse().find(l => totalXp >= l.xpRequired) ?? XP_LEVELS[0]
  const nextLevel = XP_LEVELS.find(l => l.xpRequired > totalXp)
  const xpToNext = nextLevel ? nextLevel.xpRequired - totalXp : 0
  const levelProgress = nextLevel ? ((totalXp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100 : 100

  const filtered = ACHIEVEMENTS.filter(a => category === 'All' || a.category === category)
  const unlocked = filtered.filter(a => a.unlocked)
  const locked = filtered.filter(a => !a.unlocked)

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          {/* Level card */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0C8B44]/15 to-[#0f1619] border border-[#0C8B44]/20 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Level {currentLevel.level}</p>
                <h2 className="text-2xl font-light text-[#E5E5E5]">{currentLevel.title}</h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-light text-[#0C8B44]">{totalXp} XP</p>
                {nextLevel && <p className="text-xs text-[#737373]">{xpToNext} XP to {nextLevel.title}</p>}
              </div>
            </div>
            {nextLevel && (
              <div className="w-full h-2 bg-[#ffffff10] rounded-full overflow-hidden">
                <div className="h-full bg-[#0C8B44] rounded-full transition-all" style={{ width: `${levelProgress}%` }} />
              </div>
            )}
            <div className="flex gap-6 mt-4 text-xs text-[#737373]">
              <span><span className="text-[#E5E5E5]">{unlocked.length}</span> unlocked</span>
              <span><span className="text-[#E5E5E5]">{ACHIEVEMENTS.length}</span> total</span>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs transition-colors ${category === cat ? 'bg-[#0C8B44] text-white' : 'bg-[#0f1619] border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Unlocked */}
          {unlocked.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs uppercase tracking-[0.05em] text-[#737373] mb-4">Unlocked</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unlocked.map(a => (
                  <div key={a.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#0C8B44]/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center text-[#0C8B44] shrink-0">
                        {a.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium text-[#E5E5E5] truncate">{a.title}</p>
                          <span className="text-[10px] text-[#0C8B44] font-medium shrink-0">+{a.xp} XP</span>
                        </div>
                        <p className="text-[11px] text-[#737373] mt-0.5">{a.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locked */}
          {locked.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-[0.05em] text-[#737373] mb-4">In Progress / Locked</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {locked.map(a => (
                  <div key={a.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4 opacity-75">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#ffffff08] flex items-center justify-center text-[#737373] shrink-0">
                        {a.progress !== undefined ? a.icon : <Lock className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium text-[#737373] truncate">{a.title}</p>
                          <span className="text-[10px] text-[#737373] shrink-0">+{a.xp} XP</span>
                        </div>
                        <p className="text-[11px] text-[#737373] mt-0.5">{a.description}</p>
                        {a.progress !== undefined && a.max && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-[#737373] mb-1">
                              <span>{a.progress >= 1000 ? `$${a.progress.toLocaleString()}` : a.progress} / {a.max >= 1000 ? `$${a.max.toLocaleString()}` : a.max}</span>
                              <span>{Math.round((a.progress / a.max) * 100)}%</span>
                            </div>
                            <div className="w-full h-1 bg-[#ffffff10] rounded-full">
                              <div className="h-full bg-[#0C8B44]/50 rounded-full" style={{ width: `${Math.min((a.progress / a.max) * 100, 100)}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
