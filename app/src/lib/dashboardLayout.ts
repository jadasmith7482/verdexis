// Persists which dashboard widgets the user wants visible. Order is fixed
// by the dashboard layout itself; this only controls show/hide so users can
// declutter (e.g. hide DCA + Staking if they're not into yield strategies).

const STORAGE_KEY = 'verdexis_dashboard_widgets'
const EVENT = 'verdexis:dashboard-widgets'

export type WidgetId =
  | 'topMovers'
  | 'watchlist'
  | 'alertsSummary'
  | 'newsSnippet'
  | 'goalsProgress'
  | 'connectedAccounts'
  | 'categoryBreakdown'
  | 'staking'
  | 'dca'

export interface WidgetMeta { id: WidgetId; label: string; description: string }

export const ALL_WIDGETS: WidgetMeta[] = [
  { id: 'topMovers', label: 'Top Movers', description: '24h gainers + losers' },
  { id: 'watchlist', label: 'Watchlist', description: 'Pinned assets' },
  { id: 'alertsSummary', label: 'Price Alerts', description: 'Active + triggered' },
  { id: 'newsSnippet', label: 'News', description: 'Latest market headlines' },
  { id: 'goalsProgress', label: 'Goals', description: 'Net-worth goal progress' },
  { id: 'connectedAccounts', label: 'Connected Accounts', description: 'Bank + wallet status' },
  { id: 'categoryBreakdown', label: 'Asset Categories', description: 'L1 / DeFi / Stablecoin mix' },
  { id: 'staking', label: 'Staking & Yield', description: 'Earned rewards + APY' },
  { id: 'dca', label: 'Recurring Buys', description: 'Scheduled DCA' },
]

const DEFAULT_HIDDEN: WidgetId[] = []

function load(): WidgetId[] {
  if (typeof window === 'undefined') return DEFAULT_HIDDEN
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_HIDDEN
    const parsed = JSON.parse(raw) as WidgetId[]
    return Array.isArray(parsed) ? parsed : DEFAULT_HIDDEN
  } catch { return DEFAULT_HIDDEN }
}

function save(hidden: WidgetId[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden))
  window.dispatchEvent(new Event(EVENT))
}

export const dashboardLayout = {
  hidden(): Set<WidgetId> { return new Set(load()) },
  isVisible(id: WidgetId): boolean { return !load().includes(id) },
  toggle(id: WidgetId) {
    const h = load()
    if (h.includes(id)) save(h.filter((x) => x !== id))
    else save([...h, id])
  },
  reset() { save([]) },
}

export const DASHBOARD_LAYOUT_EVENT = EVENT
