// Lightweight typed fetch wrapper for the Verdexis API.
// Uses a JWT stored in localStorage and prefixes all requests with /api.

const TOKEN_KEY = 'verdexis_token'
const USER_KEY = 'verdexis_auth' // existing key, now stores { id, email, name } from API

export interface ApiUser {
  id: string
  email: string
  name: string
  avatar: string | null
  twoFactor: boolean
  prefs: Record<string, unknown>
}

export interface ApiError {
  error: string
  details?: unknown
  status: number
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function setStoredUser(user: ApiUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, email: user.email, name: user.name }))
    if (user.avatar) localStorage.setItem('verdexis_avatar', user.avatar)
    else localStorage.removeItem('verdexis_avatar')
    if (user.prefs && Object.keys(user.prefs).length) {
      localStorage.setItem('verdexis_prefs', JSON.stringify(user.prefs))
    }
    window.dispatchEvent(new Event('verdexis:profile'))
  } catch {
    /* ignore */
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem('verdexis_avatar')
  } catch {
    /* ignore */
  }
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = {}
  }
  if (!res.ok) {
    const err = body as { error?: string; details?: unknown }
    const apiErr: ApiError = {
      error: err.error || `Request failed with ${res.status}`,
      details: err.details,
      status: res.status,
    }
    throw apiErr
  }
  return body as T
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health'),

  // Auth
  signup: (email: string, password: string, name: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  forgot: (email: string) =>
    request<{ ok: boolean; message: string }>('/api/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  reset: (token: string, password: string) =>
    request<{ ok: boolean }>('/api/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  me: () => request<{ user: ApiUser }>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Profile
  patchProfile: (patch: Partial<{ name: string; avatar: string | null; prefs: Record<string, unknown>; twoFactor: boolean }>) =>
    request<{ user: ApiUser }>('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAccount: () => request<{ ok: boolean }>('/api/profile', { method: 'DELETE' }),

  // Holdings
  listHoldings: () => request<{ holdings: unknown[] }>('/api/holdings'),
  upsertHolding: (h: { symbol: string; name: string; amount: number; avgPrice: number; type: 'crypto' | 'stock' | 'etf' }) =>
    request('/api/holdings', { method: 'POST', body: JSON.stringify(h) }),

  // Wallet
  getWallet: () => request<{ balances: unknown[]; transactions: unknown[] }>('/api/wallet'),
  postTransaction: (tx: { kind: 'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest'; currency: string; symbol?: string; amount: number; reference?: string }) =>
    request('/api/wallet/transactions', { method: 'POST', body: JSON.stringify(tx) }),

  // Trades
  listTrades: () => request<{ trades: unknown[] }>('/api/trades'),
  postTrade: (t: { symbol: string; name?: string; side: 'buy' | 'sell'; amount: number; price: number; type?: 'crypto' | 'stock' | 'etf' }) =>
    request('/api/trades', { method: 'POST', body: JSON.stringify(t) }),

  // Watchlist
  listWatchlist: () => request<{ watchlist: { id: string; symbol: string; name: string; type: string }[] }>('/api/watchlist'),
  addWatch: (item: { symbol: string; name: string; type?: 'crypto' | 'stock' | 'etf' }) =>
    request('/api/watchlist', { method: 'POST', body: JSON.stringify(item) }),
  removeWatch: (symbol: string) =>
    request(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' }),

  // Price alerts
  listAlerts: () => request<{ alerts: { id: string; symbol: string; name: string; direction: 'above' | 'below'; target: number; active: boolean; triggered: boolean; createdAt: string }[] }>('/api/alerts'),
  addAlert: (a: { symbol: string; name: string; direction: 'above' | 'below'; target: number }) =>
    request('/api/alerts', { method: 'POST', body: JSON.stringify(a) }),
  removeAlert: (id: string) => request(`/api/alerts/${id}`, { method: 'DELETE' }),
  checkAlerts: (prices: { symbol: string; price: number }[]) =>
    request<{ triggered: number }>('/api/alerts/check', { method: 'POST', body: JSON.stringify({ prices }) }),

  // Notifications
  listNotifications: () => request<{ notifications: { id: string; kind: string; title: string; body: string | null; read: boolean; createdAt: string }[]; unread: number }>('/api/notifications'),
  markAllRead: () => request('/api/notifications/read', { method: 'POST' }),
  removeNotification: (id: string) => request(`/api/notifications/${id}`, { method: 'DELETE' }),
}

/**
 * Best-effort API check. Returns true if the backend responds within 1s,
 * false otherwise. Components can use this to fall back to localStorage.
 */
export async function isApiOnline(): Promise<boolean> {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 1000)
    const res = await fetch(`${BASE}/api/health`, { signal: ctl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}
