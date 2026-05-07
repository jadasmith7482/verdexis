// Typed wrapper around the /api/admin/* endpoints.
// Uses the same Bearer-token storage as the regular `api` client.

import { getToken } from './api'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  let body: unknown
  try { body = await res.json() } catch { body = {} }
  if (!res.ok) {
    const err = body as { error?: string; details?: unknown }
    throw { status: res.status, error: err.error || `Request failed with ${res.status}`, details: err.details }
  }
  return body as T
}

// --- types -------------------------------------------------------------

export interface AdminUserSummary {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  suspended: boolean
  twoFactor: boolean
  createdAt: string
  updatedAt: string
  _count: { holdings: number; trades: number; transactions: number; alerts: number }
}

export interface AdminUserFull {
  id: string
  email: string
  name: string
  avatar: string | null
  twoFactor: boolean
  role: 'user' | 'admin'
  suspended: boolean
  suspendedReason: string | null
  tokenVersion: number
  createdAt: string
  updatedAt: string
  prefs: Record<string, unknown>
}

export interface AdminHolding { id: string; userId: string; symbol: string; name: string; amount: number; avgPrice: number; type: string; createdAt: string; updatedAt: string }
export interface AdminWalletBalance { id: string; userId: string; currency: string; symbol: string; balance: number; available: number; updatedAt: string }
export interface AdminTransaction { id: string; userId: string; kind: string; currency: string; amount: number; status: string; reference: string | null; createdAt: string }
export interface AdminTrade { id: string; userId: string; symbol: string; side: 'buy' | 'sell'; amount: number; price: number; total: number; createdAt: string }
export interface AdminWatchItem { id: string; userId: string; symbol: string; name: string; type: string; createdAt: string }
export interface AdminPriceAlert { id: string; userId: string; symbol: string; name: string; direction: 'above' | 'below'; target: number; active: boolean; triggered: boolean; createdAt: string }
export interface AdminNotification { id: string; userId: string; kind: string; title: string; body: string | null; read: boolean; createdAt: string }

export interface AdminUserDetailResponse {
  user: AdminUserFull
  holdings: AdminHolding[]
  walletBalances: AdminWalletBalance[]
  transactions: AdminTransaction[]
  trades: AdminTrade[]
  watchlist: AdminWatchItem[]
  alerts: AdminPriceAlert[]
  notifications: AdminNotification[]
}

export interface AdminStats {
  stats: {
    users: number
    admins: number
    suspended: number
    holdings: number
    trades: number
    alerts: number
    deposits24h: number
    signups24h: number
  }
  recentSignups: Array<Pick<AdminUserSummary, 'id' | 'email' | 'name' | 'createdAt' | 'role' | 'suspended'>>
  recentTx: Array<AdminTransaction & { user: { id: string; email: string; name: string } }>
}

export interface AdminAuditLog {
  id: string
  actorId: string
  targetUserId: string | null
  action: string
  payload: string | null
  createdAt: string
  actor: { id: string; email: string; name: string } | null
  target: { id: string; email: string; name: string } | null
}

// --- API ---------------------------------------------------------------

export const adminApi = {
  stats: () => request<AdminStats>('/api/admin/stats'),

  listUsers: (params: { q?: string; page?: number; limit?: number; role?: 'user' | 'admin' | 'all'; suspended?: 'true' | 'false' | 'all' } = {}) => {
    const q = new URLSearchParams()
    if (params.q) q.set('q', params.q)
    if (params.page) q.set('page', String(params.page))
    if (params.limit) q.set('limit', String(params.limit))
    if (params.role) q.set('role', params.role)
    if (params.suspended) q.set('suspended', params.suspended)
    return request<{ users: AdminUserSummary[]; total: number; page: number; limit: number }>(`/api/admin/users?${q.toString()}`)
  },

  getUser: (id: string) => request<AdminUserDetailResponse>(`/api/admin/users/${id}`),

  patchUser: (id: string, patch: Partial<{ name: string; email: string; avatar: string | null; role: 'user' | 'admin'; suspended: boolean; suspendedReason: string | null; twoFactor: boolean; prefs: Record<string, unknown> }>) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  setPassword: (id: string, password: string, revokeSessions = true) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password, revokeSessions }) }),

  revokeSessions: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}/revoke`, { method: 'POST' }),

  deleteUser: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  // Holdings
  upsertHolding: (userId: string, h: { symbol: string; name: string; amount: number; avgPrice: number; type?: 'crypto' | 'stock' | 'etf' }) =>
    request<{ holding: AdminHolding }>(`/api/admin/users/${userId}/holdings`, { method: 'POST', body: JSON.stringify(h) }),
  patchHolding: (id: string, h: Partial<{ symbol: string; name: string; amount: number; avgPrice: number; type: 'crypto' | 'stock' | 'etf' }>) =>
    request<{ holding: AdminHolding }>(`/api/admin/holdings/${id}`, { method: 'PATCH', body: JSON.stringify(h) }),
  deleteHolding: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/holdings/${id}`, { method: 'DELETE' }),

  // Wallet
  setWallet: (userId: string, w: { currency: string; symbol: string; balance: number; available: number }) =>
    request<{ balance: AdminWalletBalance }>(`/api/admin/users/${userId}/wallet`, { method: 'POST', body: JSON.stringify(w) }),
  deleteWallet: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/wallet/${id}`, { method: 'DELETE' }),

  // Transactions
  createTransaction: (userId: string, tx: { kind: string; currency: string; amount: number; status?: string; reference?: string }) =>
    request<{ transaction: AdminTransaction }>(`/api/admin/users/${userId}/transactions`, { method: 'POST', body: JSON.stringify(tx) }),
  patchTransaction: (id: string, tx: Partial<{ kind: string; currency: string; amount: number; status: string; reference: string }>) =>
    request<{ transaction: AdminTransaction }>(`/api/admin/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(tx) }),
  deleteTransaction: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/transactions/${id}`, { method: 'DELETE' }),

  // Trades
  createTrade: (userId: string, t: { symbol: string; side: 'buy' | 'sell'; amount: number; price: number }) =>
    request<{ trade: AdminTrade }>(`/api/admin/users/${userId}/trades`, { method: 'POST', body: JSON.stringify(t) }),
  deleteTrade: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/trades/${id}`, { method: 'DELETE' }),

  // Alerts
  createAlert: (userId: string, a: { symbol: string; name: string; direction: 'above' | 'below'; target: number; active?: boolean }) =>
    request<{ alert: AdminPriceAlert }>(`/api/admin/users/${userId}/alerts`, { method: 'POST', body: JSON.stringify(a) }),
  deleteAlert: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/alerts/${id}`, { method: 'DELETE' }),

  // Watchlist
  deleteWatch: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/watchlist/${id}`, { method: 'DELETE' }),

  // Notifications
  createNotification: (userId: string, n: { kind?: string; title: string; body?: string }) =>
    request<{ notification: AdminNotification }>(`/api/admin/users/${userId}/notifications`, { method: 'POST', body: JSON.stringify(n) }),
  deleteNotification: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/notifications/${id}`, { method: 'DELETE' }),
  broadcast: (n: { kind?: string; title: string; body?: string }) =>
    request<{ ok: boolean; count: number }>(`/api/admin/broadcast`, { method: 'POST', body: JSON.stringify(n) }),

  // Audit
  audit: (limit = 100) => request<{ audit: AdminAuditLog[] }>(`/api/admin/audit?limit=${limit}`),
}
