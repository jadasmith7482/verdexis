// Inspired by Wealthfolio's goal-planning model.
// Tracks user-defined financial goals locally with progress + projection.

export interface Goal {
  id: string
  title: string
  target: number
  currency: 'USD'
  deadline: string // ISO date
  category: 'wealth' | 'crypto' | 'retirement' | 'home' | 'other'
  startedAt: string // ISO
}

const STORAGE_KEY = 'verdexis_goals'
const EVENT = 'verdexis:goals'

const DEFAULT: Goal[] = [
  {
    id: 'starter',
    title: 'Build $100k portfolio',
    target: 100000,
    currency: 'USD',
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    category: 'wealth',
    startedAt: new Date().toISOString(),
  },
]

function load(): Goal[] {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Goal[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT
  } catch {
    return DEFAULT
  }
}

function save(goals: Goal[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
  window.dispatchEvent(new Event(EVENT))
}

export const goalsStore = {
  list(): Goal[] {
    return load()
  },
  add(input: Omit<Goal, 'id' | 'startedAt'>): Goal {
    const goal: Goal = { ...input, id: `g_${Date.now()}`, startedAt: new Date().toISOString() }
    const next = [...load(), goal]
    save(next)
    return goal
  },
  remove(id: string) {
    save(load().filter((g) => g.id !== id))
  },
  reset() {
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    save(DEFAULT)
  },
}

export function progressFor(goal: Goal, currentValue: number) {
  const pct = Math.max(0, Math.min(100, (currentValue / goal.target) * 100))
  const start = new Date(goal.startedAt).getTime()
  const end = new Date(goal.deadline).getTime()
  const now = Date.now()
  const timeElapsedPct = end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 0
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
  const onTrack = pct >= timeElapsedPct
  return { pct, timeElapsedPct, daysLeft, onTrack, remaining: Math.max(0, goal.target - currentValue) }
}

export const GOALS_EVENT = EVENT
