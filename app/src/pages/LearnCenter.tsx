import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, PlayCircle, CheckCircle, Lock, ChevronRight, GraduationCap, Clock } from 'lucide-react'
import Navigation from '../components/Navigation'

interface Lesson {
  id: string
  title: string
  duration: string
  locked: boolean
  completed: boolean
}

interface Course {
  id: string
  title: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  lessons: Lesson[]
  category: string
}

const COURSES: Course[] = [
  {
    id: 'crypto-101',
    title: 'Crypto 101',
    description: 'Everything you need to know to start investing in cryptocurrency.',
    level: 'beginner',
    category: 'Fundamentals',
    lessons: [
      { id: '1', title: 'What is Bitcoin?', duration: '5 min', locked: false, completed: true },
      { id: '2', title: 'How blockchain works', duration: '8 min', locked: false, completed: true },
      { id: '3', title: 'Wallets & private keys', duration: '6 min', locked: false, completed: false },
      { id: '4', title: 'Buying your first crypto', duration: '4 min', locked: false, completed: false },
      { id: '5', title: 'Security best practices', duration: '7 min', locked: true, completed: false },
    ],
  },
  {
    id: 'trading-basics',
    title: 'Trading Fundamentals',
    description: 'Learn how exchanges work, order types, and your first trade.',
    level: 'beginner',
    category: 'Trading',
    lessons: [
      { id: '1', title: 'How exchanges work', duration: '6 min', locked: false, completed: false },
      { id: '2', title: 'Market vs Limit orders', duration: '5 min', locked: false, completed: false },
      { id: '3', title: 'Reading candlestick charts', duration: '10 min', locked: true, completed: false },
      { id: '4', title: 'Volume & liquidity', duration: '7 min', locked: true, completed: false },
    ],
  },
  {
    id: 'technical-analysis',
    title: 'Technical Analysis',
    description: 'RSI, MACD, Bollinger Bands & chart patterns explained.',
    level: 'intermediate',
    category: 'Analysis',
    lessons: [
      { id: '1', title: 'Support & resistance', duration: '9 min', locked: false, completed: false },
      { id: '2', title: 'Moving averages (SMA/EMA)', duration: '8 min', locked: true, completed: false },
      { id: '3', title: 'RSI & momentum', duration: '7 min', locked: true, completed: false },
      { id: '4', title: 'MACD divergences', duration: '11 min', locked: true, completed: false },
      { id: '5', title: 'Bollinger Bands', duration: '8 min', locked: true, completed: false },
    ],
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    description: 'Protect your capital. Position sizing, stop-losses & drawdowns.',
    level: 'intermediate',
    category: 'Strategy',
    lessons: [
      { id: '1', title: 'Never risk more than you can lose', duration: '5 min', locked: false, completed: false },
      { id: '2', title: 'Position sizing strategies', duration: '9 min', locked: true, completed: false },
      { id: '3', title: 'Stop-loss placement', duration: '7 min', locked: true, completed: false },
      { id: '4', title: 'Portfolio diversification', duration: '8 min', locked: true, completed: false },
    ],
  },
  {
    id: 'defi-intro',
    title: 'Intro to DeFi',
    description: 'Decentralized finance: protocols, yield, and on-chain safety.',
    level: 'intermediate',
    category: 'DeFi',
    lessons: [
      { id: '1', title: 'What is DeFi?', duration: '6 min', locked: false, completed: false },
      { id: '2', title: 'Liquidity pools explained', duration: '8 min', locked: true, completed: false },
      { id: '3', title: 'Impermanent loss', duration: '10 min', locked: true, completed: false },
      { id: '4', title: 'Yield farming safely', duration: '9 min', locked: true, completed: false },
    ],
  },
  {
    id: 'advanced-strategies',
    title: 'Advanced Trading Strategies',
    description: 'Options, delta-neutral hedging, and quant fundamentals.',
    level: 'advanced',
    category: 'Strategy',
    lessons: [
      { id: '1', title: 'Derivatives overview', duration: '12 min', locked: true, completed: false },
      { id: '2', title: 'Delta-neutral positions', duration: '14 min', locked: true, completed: false },
      { id: '3', title: 'Quant backtesting basics', duration: '16 min', locked: true, completed: false },
      { id: '4', title: 'Building a trading system', duration: '20 min', locked: true, completed: false },
    ],
  },
]

const LEVEL_COLOR: Record<string, string> = {
  beginner: 'text-[#0C8B44] bg-[#0C8B44]/10',
  intermediate: 'text-yellow-400 bg-yellow-400/10',
  advanced: 'text-red-400 bg-red-400/10',
}

export default function LearnCenter() {
  const [selected, setSelected] = useState<Course | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('All')

  const categories = ['All', ...Array.from(new Set(COURSES.map(c => c.category)))]
  const filtered = COURSES.filter(c => categoryFilter === 'All' || c.category === categoryFilter)

  const totalCompleted = COURSES.flatMap(c => c.lessons).filter(l => l.completed).length
  const totalLessons = COURSES.flatMap(c => c.lessons).length

  if (selected) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-24 pb-16 px-6">
          <div className="max-w-3xl mx-auto">
            <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
              <ArrowLeft className="w-3 h-3" />Back to courses
            </button>
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className={`text-[10px] px-2 py-1 rounded font-medium uppercase tracking-wider ${LEVEL_COLOR[selected.level]}`}>{selected.level}</span>
                <h1 className="text-2xl font-light text-[#E5E5E5] mt-2">{selected.title}</h1>
                <p className="text-xs text-[#737373] mt-1">{selected.description}</p>
              </div>
            </div>
            <div className="space-y-3">
              {selected.lessons.map((lesson, i) => (
                <div key={lesson.id} className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors ${lesson.locked ? 'bg-[#0a0f11] border-[#ffffff05] opacity-60' : 'bg-[#0f1619]/50 border-[#ffffff08] hover:border-[#0C8B44]/30 cursor-pointer'}`}>
                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    {lesson.completed ? <CheckCircle className="w-5 h-5 text-[#0C8B44]" /> : lesson.locked ? <Lock className="w-4 h-4 text-[#737373]" /> : <PlayCircle className="w-5 h-5 text-[#0C8B44]" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[#E5E5E5]">{i + 1}. {lesson.title}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#737373]">
                    <Clock className="w-3 h-3" />{lesson.duration}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 bg-[#0C8B44] text-white text-xs font-medium uppercase tracking-[0.05em] rounded-xl hover:bg-[#0a7539] transition-colors">
              Start Course
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#0C8B44]" />
              </div>
              <div>
                <h1 className="text-2xl font-light text-[#E5E5E5]">Learning Center</h1>
                <p className="text-xs text-[#737373]">Master trading from beginner to advanced.</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#737373]">Your progress</p>
              <p className="text-sm text-[#E5E5E5]">{totalCompleted} / {totalLessons} lessons</p>
              <div className="w-32 h-1 bg-[#ffffff10] rounded-full mt-1 ml-auto">
                <div className="h-full bg-[#0C8B44] rounded-full" style={{ width: `${(totalCompleted / totalLessons) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 rounded-full text-xs transition-colors ${categoryFilter === cat ? 'bg-[#0C8B44] text-white' : 'bg-[#0f1619] border border-[#ffffff10] text-[#737373] hover:text-[#E5E5E5]'}`}>
                {cat}
              </button>
            ))}
          </div>

          {/* Course grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(course => {
              const done = course.lessons.filter(l => l.completed).length
              const pct = Math.round((done / course.lessons.length) * 100)
              return (
                <button key={course.id} onClick={() => setSelected(course)} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 text-left hover:border-[#0C8B44]/30 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-[10px] px-2 py-1 rounded font-medium uppercase tracking-wider ${LEVEL_COLOR[course.level]}`}>{course.level}</span>
                    <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#0C8B44] transition-colors" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center mb-3">
                    <BookOpen className="w-5 h-5 text-[#0C8B44]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#E5E5E5] mb-1">{course.title}</h3>
                  <p className="text-[11px] text-[#737373] mb-4">{course.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-[#737373] mb-2">
                    <span>{course.lessons.length} lessons</span>
                    <span>{done}/{course.lessons.length} done</span>
                  </div>
                  <div className="w-full h-1 bg-[#ffffff10] rounded-full">
                    <div className="h-full bg-[#0C8B44] rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
