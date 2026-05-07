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
  holdActive: boolean
  holdType: 'all' | 'withdraw' | 'transfer' | null
  holdReason: string | null
  holdNote: string | null
  holdAt: string | null
  tokenVersion: number
  createdAt: string
  updatedAt: string
  prefs: Record<string, unknown>
}

// Reason vocabularies surfaced in the admin UI dropdowns. Keep in sync
// with the server's enums in routes/admin.ts.
export const DEPOSIT_REASONS: Array<{ value: string; label: string }> = [
  { value: 'manual_bank_wire', label: 'Manual deposit — bank wire' },
  { value: 'manual_crypto', label: 'Manual deposit — crypto' },
  { value: 'promo_credit', label: 'Promotional credit' },
  { value: 'refund', label: 'Refund' },
  { value: 'chargeback_reversal', label: 'Chargeback reversal' },
  { value: 'bonus_referral', label: 'Bonus / referral reward' },
  { value: 'compensation', label: 'Compensation / goodwill' },
  { value: 'correction_undercharge', label: 'Correction (under-credit fix)' },
  { value: 'other', label: 'Other (see note)' },
]
export const DEDUCT_REASONS: Array<{ value: string; label: string }> = [
  { value: 'manual_bank_wire', label: 'Manual withdrawal — bank wire' },
  { value: 'manual_crypto', label: 'Manual withdrawal — crypto' },
  { value: 'fee', label: 'Fee / service charge' },
  { value: 'chargeback', label: 'Chargeback' },
  { value: 'fraud_reversal', label: 'Fraud reversal' },
  { value: 'compliance_sanctions', label: 'Compliance / sanctions' },
  { value: 'correction_overcharge', label: 'Correction (over-credit fix)' },
  { value: 'court_order', label: 'Court order / legal request' },
  { value: 'other', label: 'Other (see note)' },
]
export const HOLD_REASONS: Array<{ value: string; label: string }> = [
  { value: 'aml_kyc_review', label: 'AML / KYC review' },
  { value: 'suspected_fraud', label: 'Suspected fraud' },
  { value: 'document_verification', label: 'Pending document verification' },
  { value: 'court_order', label: 'Court order / legal request' },
  { value: 'sanctions_screening', label: 'Sanctions screening' },
  { value: 'chargeback_investigation', label: 'Chargeback investigation' },
  { value: 'compliance_review', label: 'Compliance review' },
  { value: 'suspicious_activity', label: 'Suspicious activity' },
  { value: 'user_requested_freeze', label: 'User-requested freeze' },
  { value: 'pending_transfer_review', label: 'Pending transfer review' },
  { value: 'other', label: 'Other (see note)' },
]
export const HOLD_TYPES: Array<{ value: 'all' | 'withdraw' | 'transfer'; label: string; description: string }> = [
  { value: 'all', label: 'All money movement', description: 'Block both withdrawals and transfers' },
  { value: 'withdraw', label: 'Withdrawals only', description: 'User can still transfer internally' },
  { value: 'transfer', label: 'Transfers only', description: 'User can still withdraw to bank/crypto' },
]

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

  createUser: (input: { email: string; name: string; password: string; role?: 'user' | 'admin'; initialUsdBalance?: number }) =>
    request<{ user: AdminUserFull }>(`/api/admin/users`, { method: 'POST', body: JSON.stringify(input) }),

  deposit: (userId: string, input: { currency: string; symbol?: string; amount: number; reason: string; note?: string; status?: 'pending' | 'completed'; notify?: boolean }) =>
    request<{ balance: AdminWalletBalance; transaction: AdminTransaction }>(`/api/admin/users/${userId}/deposit`, { method: 'POST', body: JSON.stringify(input) }),

  deduct: (userId: string, input: { currency: string; symbol?: string; amount: number; reason: string; note?: string; status?: 'pending' | 'completed' | 'reversed'; allowNegative?: boolean; notify?: boolean }) =>
    request<{ balance: AdminWalletBalance; transaction: AdminTransaction }>(`/api/admin/users/${userId}/deduct`, { method: 'POST', body: JSON.stringify(input) }),

  placeHold: (userId: string, input: { holdType: 'all' | 'withdraw' | 'transfer'; reason: string; note?: string; notify?: boolean }) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${userId}/hold`, { method: 'POST', body: JSON.stringify(input) }),

  releaseHold: (userId: string) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${userId}/unhold`, { method: 'POST' }),

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
