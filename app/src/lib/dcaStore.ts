// Recurring DCA (dollar-cost-average) buy schedule. Lets the user define
// "every X days, buy $Y of asset Z". A scheduler in Dashboard ticks once
// a minute and, when a schedule is overdue, simulates the buy through
// portfolioStore.recordTrade so it shows up in trades + holdings.

const STORAGE_KEY = 'verdexis_dca'
const EVENT = 'verdexis:dca'

export interface DcaSchedule {
  id: string
  asset: string // symbol
  assetId: string // CoinGecko id
  name: string
  amountUsd: number
  intervalDays: number
  active: boolean
  createdAt: string
  lastRun?: string
}

const DEFAULT: DcaSchedule[] = [
  { id: 'dca_btc', asset: 'BTC', assetId: 'bitcoin', name: 'Bitcoin', amountUsd: 100, intervalDays: 7, active: true, createdAt: new Date().toISOString() },
]

function load(): DcaSchedule[] {
  if (typeof window === 'undefined') return DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as DcaSchedule[]
    return Array.isArray(parsed) ? parsed : DEFAULT
  } catch { return DEFAULT }
}

function save(list: DcaSchedule[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(EVENT))
}

export const dcaStore = {
  list(): DcaSchedule[] { return load() },
  add(input: Omit<DcaSchedule, 'id' | 'createdAt'>): DcaSchedule {
    const s: DcaSchedule = { ...input, id: `dca_${Date.now()}`, createdAt: new Date().toISOString() }
    save([...load(), s])
    return s
  },
  toggle(id: string) {
    save(load().map((s) => s.id === id ? { ...s, active: !s.active } : s))
  },
  markRun(id: string) {
    save(load().map((s) => s.id === id ? { ...s, lastRun: new Date().toISOString() } : s))
  },
  remove(id: string) { save(load().filter((s) => s.id !== id)) },
}

export function nextRunMs(s: DcaSchedule): number {
  const last = s.lastRun ? new Date(s.lastRun).getTime() : new Date(s.createdAt).getTime()
  return last + s.intervalDays * 86400_000
}

export const DCA_EVENT = EVENT
