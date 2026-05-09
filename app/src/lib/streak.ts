// Login streak tracker. Stores last login date + current consecutive-day count.
// Updated once per session on app load. Two consecutive calendar days =
// streak of 2; missing a day resets to 1.

const STORAGE_KEY = 'verdexis_streak'

interface StreakData {
  lastDate: string // YYYY-MM-DD
  count: number
  best: number
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((db - da) / (1000 * 60 * 60 * 24))
}

export function recordVisit(): StreakData {
  const today = todayStr()
  let data: StreakData = { lastDate: today, count: 1, best: 1 }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const prev = JSON.parse(raw) as StreakData
      const gap = daysBetween(prev.lastDate, today)
      if (gap === 0) {
        data = prev
      } else if (gap === 1) {
        data = { lastDate: today, count: prev.count + 1, best: Math.max(prev.best, prev.count + 1) }
      } else {
        data = { lastDate: today, count: 1, best: Math.max(prev.best, 1) }
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
  return data
}

export function getStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as StreakData
  } catch { /* ignore */ }
  return { lastDate: todayStr(), count: 0, best: 0 }
}

export function greetingFor(name: string): string {
  const h = new Date().getHours()
  const part = h < 5 ? 'Good Night' : h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : h < 22 ? 'Good Evening' : 'Good Night'
  return `${part}, ${name}`
}
