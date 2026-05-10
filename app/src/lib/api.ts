// Lightweight typed fetch wrapper for the Verdexis API.
// Uses a JWT stored in localStorage and prefixes all requests with /api.

const TOKEN_KEY = 'verdexis_token'
const USER_KEY = 'verdexis_auth' // existing key, now stores { id, email, name } from API

export interface ApiUser {
  id: string
  email: string
  username: string | null
  name: string
  avatar: string | null
  twoFactor: boolean
  prefs: Record<string, unknown>
  role: 'user' | 'admin'
  suspended: boolean
  investmentId: string | null
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected'
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
    localStorage.setItem(USER_KEY, JSON.stringify({ id: user.id, email: user.email, username: user.username, name: user.name, role: user.role, suspended: user.suspended, investmentId: user.investmentId, kycStatus: user.kycStatus }))
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

// Generate an idempotency key for money-mutating requests. Use the platform
// crypto.randomUUID when available (every modern browser + secure context),
// falling back to a 22-char base36 string built from crypto.getRandomValues
// or Math.random as a last resort.
export function newIdempotencyKey(): string {
  try {
    const c = (typeof crypto !== 'undefined' ? crypto : undefined)
    if (c?.randomUUID) return c.randomUUID()
    if (c?.getRandomValues) {
      const buf = new Uint8Array(16)
      c.getRandomValues(buf)
      return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

interface RequestOpts extends RequestInit {
  /** Send `Idempotency-Key: <value>` so server-side retries are deduped.
   *  The caller is responsible for generating the key ONCE per logical
   *  user action — re-using the same key on retry is the whole point. */
  idempotencyKey?: string
}

async function request<T>(path: string, init: RequestOpts = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey)

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
  login: (identifier: string, password: string) =>
    request<{ token: string; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
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
  logoutAll: () => request<{ ok: boolean; token: string }>('/api/auth/logout-all', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean; token: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  exportData: () => {
    const headers: Record<string, string> = {}
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
    return fetch(`${BASE}/api/auth/export`, { headers }).then(async (r) => {
      if (!r.ok) throw await r.json().catch(() => ({ error: r.statusText }))
      return r.blob()
    })
  },

  // Profile
  patchProfile: (patch: Partial<{ name: string; username: string | null; avatar: string | null; prefs: Record<string, unknown>; twoFactor: boolean }>) =>
    request<{ user: ApiUser }>('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAccount: () => request<{ ok: boolean }>('/api/profile', { method: 'DELETE' }),

  // Holdings
  listHoldings: () => request<{ holdings: unknown[] }>('/api/holdings'),
  upsertHolding: (h: { symbol: string; name: string; amount: number; avgPrice: number; type: 'crypto' | 'stock' | 'etf' }) =>
    request('/api/holdings', { method: 'POST', body: JSON.stringify(h) }),

  // Wallet
  getWallet: () => request<{ balances: unknown[]; transactions: unknown[] }>('/api/wallet'),
  postTransaction: (
    tx: { kind: 'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest'; currency: string; symbol?: string; amount: number; reference?: string },
    idempotencyKey?: string,
  ) =>
    request('/api/wallet/transactions', { method: 'POST', body: JSON.stringify(tx), idempotencyKey }),
  transferToUser: (
    payload: { recipientEmail: string; currency: string; amount: number; note?: string },
    idempotencyKey?: string,
  ) =>
    request<{ recipient: { email: string; name: string | null } }>(
      '/api/wallet/transfer',
      { method: 'POST', body: JSON.stringify(payload), idempotencyKey },
    ),
  lookupRecipient: (email: string) =>
    request<{ user: { email: string; name: string | null } }>(`/api/wallet/lookup-recipient?email=${encodeURIComponent(email)}`),

  // Self-custody wallet linking
  getWalletLink: () =>
    request<{ wallet: { walletAddress: string | null; walletChainId: string | null; walletProvider: string | null; walletLinkedAt: string | null } | null }>(
      '/api/wallet/link',
    ),
  linkWallet: (payload: { address: string; chainId?: string; provider?: string }) =>
    request<{ wallet: { walletAddress: string; walletChainId: string | null; walletProvider: string | null; walletLinkedAt: string } }>(
      '/api/wallet/link',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  unlinkWallet: () =>
    request<{ ok: boolean }>('/api/wallet/link', { method: 'DELETE' }),

  // Multi-wallet linking
  listWalletLinks: () =>
    request<{ links: { id: string; address: string; chainId: string | null; provider: string | null; label: string | null; isPrimary: boolean; linkedAt: string }[] }>(
      '/api/wallet/links',
    ),
  addWalletLink: (payload: { address: string; chainId?: string; provider?: string; label?: string; setPrimary?: boolean }) =>
    request<{ link: { id: string; address: string; chainId: string | null; provider: string | null; label: string | null; isPrimary: boolean; linkedAt: string } }>(
      '/api/wallet/links',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  removeWalletLink: (id: string) =>
    request<{ ok: boolean }>(`/api/wallet/links/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setPrimaryWalletLink: (id: string) =>
    request<{ ok: boolean }>(`/api/wallet/links/${encodeURIComponent(id)}/primary`, { method: 'POST' }),

  // Admin-managed deposit instructions (wire / crypto / web3 destinations)
  getDepositInstructions: () =>
    request<{ instructions: unknown; updatedAt: string | null }>('/api/wallet/deposit-instructions'),
  putDepositInstructions: (instructions: unknown) =>
    request<{ instructions: unknown; updatedAt: string }>(
      '/api/wallet/deposit-instructions',
      { method: 'PUT', body: JSON.stringify(instructions) },
    ),

  // Per-user crypto / wire deposit destinations the admin assigned to me.
  getMyDepositAddresses: () =>
    request<{ addresses: unknown | null }>('/api/wallet/me/deposit-addresses'),

  // On-chain pending deposits
  recordPendingDeposit: (
    payload: { txHash: string; chainId: string; toAddress: string; fromAddress: string; asset: string; amount: number },
  ) =>
    request<{ pendingDeposit: { id: string; txHash: string; status: string; createdAt: string }; deduped?: boolean }>(
      '/api/wallet/pending-deposits',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  listPendingDeposits: () =>
    request<{ pendingDeposits: { id: string; txHash: string; chainId: string; toAddress: string; fromAddress: string; asset: string; amount: number; status: string; note: string | null; createdAt: string }[] }>(
      '/api/wallet/pending-deposits',
    ),

  // Trades
  listTrades: () => request<{ trades: unknown[] }>('/api/trades'),
  postTrade: (
    t: { symbol: string; name?: string; side: 'buy' | 'sell'; amount: number; price: number; type?: 'crypto' | 'stock' | 'etf' },
    idempotencyKey?: string,
  ) =>
    request<{ trade: { id: string; symbol: string; side: 'buy' | 'sell'; amount: number; price: number; total: number; createdAt: string }; broker: { id: string; venue: string } | null }>(
      '/api/trades',
      { method: 'POST', body: JSON.stringify(t), idempotencyKey },
    ),

  // Market data (server-side proxy)
  marketOrderbook: (id: string) => request<{ product: string; bids: { price: number; size: number }[]; asks: { price: number; size: number }[] }>(`/api/market/orderbook?id=${encodeURIComponent(id)}`),
  marketRecentTrades: (id: string) => request<{ product: string; trades: { id: number; time: string; price: number; size: number; side: 'buy' | 'sell' }[] }>(`/api/market/recent-trades?id=${encodeURIComponent(id)}`),

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

  // AI chat (LLM proxy). Returns 503 when no key is configured server-side
  // so the caller can fall back to its rule-based answer.
  aiChat: (payload: { query: string; persona?: string; context?: string }) =>
    request<{ answer: string; model: string }>('/api/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),

  // Public testimonials shown on the homepage carousel. GET is unauthenticated
  // so the marketing page works for signed-out visitors.
  listReviews: () =>
    request<{ reviews: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; createdAt: string }[] }>(
      '/api/reviews',
    ),
  getMyReview: () =>
    request<{ review: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; approved: boolean; createdAt: string; updatedAt: string } | null }>(
      '/api/reviews/me',
    ),
  upsertReview: (payload: { rating: number; text: string }) =>
    request<{ review: { id: string; rating: number; text: string; authorName: string; authorAvatar: string | null; approved: boolean; createdAt: string; updatedAt: string } }>(
      '/api/reviews',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  deleteMyReview: () => request<{ ok: boolean }>('/api/reviews/me', { method: 'DELETE' }),
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
