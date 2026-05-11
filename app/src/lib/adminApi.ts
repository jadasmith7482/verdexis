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
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected'
  holdActive: boolean
  holdType: 'all' | 'withdraw' | 'transfer' | null
  twoFactor: boolean
  investmentId: string | null
  lastLoginAt: string | null
  lastLoginIp: string | null
  lastLoginGeo: {
    country?: string
    countryCode?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
    timezone?: string
    isp?: string
  } | null
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
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected'
  kycNotes: string | null
  kycReviewedAt: string | null
  kycReviewedBy: string | null
  dailyWithdrawLimit: number | null
  monthlyWithdrawLimit: number | null
  dailyTransferLimit: number | null
  monthlyTransferLimit: number | null
  ipAllowlist: string | null
  investmentId: string | null
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
  { value: 'high_risk_jurisdiction', label: 'High-risk jurisdiction review' },
  { value: 'multiple_failed_auth', label: 'Multiple failed authentication attempts' },
  { value: 'device_fingerprint_mismatch', label: 'Device fingerprint mismatch' },
  { value: 'impossible_travel_login', label: 'Impossible-travel login pattern' },
  { value: 'velocity_limit_breach', label: 'Transfer velocity limit breach' },
  { value: 'source_of_funds_review', label: 'Source of funds review' },
  { value: 'pep_review', label: 'PEP review required' },
  { value: 'beneficiary_verification', label: 'Beneficiary verification pending' },
  { value: 'manual_risk_override', label: 'Manual risk override' },
  { value: 'other', label: 'Other (see note)' },
]
export const HOLD_TYPES: Array<{ value: 'all' | 'withdraw' | 'transfer'; label: string; description: string }> = [
  { value: 'all', label: 'All money movement', description: 'Block both withdrawals and transfers' },
  { value: 'withdraw', label: 'Withdrawals only', description: 'User can still transfer internally' },
  { value: 'transfer', label: 'Transfers only', description: 'User can still withdraw to bank/crypto' },
]

export const HOLDING_REASONS: Array<{ value: string; label: string }> = [
  { value: 'admin_correction', label: 'Manual correction' },
  { value: 'manual_purchase', label: 'Manual purchase' },
  { value: 'manual_sale', label: 'Manual sale' },
  { value: 'gift', label: 'Gift' },
  { value: 'airdrop', label: 'Airdrop' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'court_order', label: 'Court order' },
  { value: 'other', label: 'Other (see note)' },
]
export const TRANSFER_REASONS: Array<{ value: string; label: string }> = [
  { value: 'court_order', label: 'Court order' },
  { value: 'dispute_resolution', label: 'Dispute resolution' },
  { value: 'fraud_recovery', label: 'Fraud recovery' },
  { value: 'gift', label: 'Gift / family transfer' },
  { value: 'family_transfer', label: 'Family / household transfer' },
  { value: 'compliance_directive', label: 'Compliance directive' },
  { value: 'merger_consolidation', label: 'Merger / consolidation' },
  { value: 'manual_correction', label: 'Manual correction' },
  { value: 'other', label: 'Other (see note)' },
]
export const FEE_TYPES: Array<{ value: string; label: string }> = [
  { value: 'wire', label: 'Wire fee' },
  { value: 'inactivity', label: 'Inactivity fee' },
  { value: 'custody', label: 'Custody fee' },
  { value: 'maintenance', label: 'Maintenance fee' },
  { value: 'late_payment', label: 'Late payment fee' },
  { value: 'currency_conversion', label: 'Currency conversion fee' },
  { value: 'withdrawal', label: 'Withdrawal fee' },
  { value: 'admin_fee', label: 'Service fee' },
  { value: 'other', label: 'Other (see note)' },
]
export const KYC_STATUSES: Array<{ value: 'none' | 'pending' | 'approved' | 'rejected'; label: string; tone: string }> = [
  { value: 'none', label: 'Not started', tone: 'gray' },
  { value: 'pending', label: 'Pending review', tone: 'orange' },
  { value: 'approved', label: 'Approved', tone: 'green' },
  { value: 'rejected', label: 'Rejected', tone: 'red' },
]
export const EMAIL_TEMPLATES: Array<{ value: string; label: string; subject: string; body: string }> = [
  { value: 'none', label: 'Blank', subject: '', body: '' },
  { value: 'welcome', label: 'Welcome', subject: 'Welcome to Verdexis', body: 'Hi,\n\nThanks for joining Verdexis. Reply to this message if you need help getting started.\n\n— The Verdexis team' },
  { value: 'verification_required', label: 'Verification required', subject: 'Account verification required', body: 'Hi,\n\nWe need a few additional details to keep your account in good standing. Please log in and complete the verification flow at your convenience.\n\n— Compliance, Verdexis' },
  { value: 'kyc_request', label: 'KYC document request', subject: 'Please send KYC documents', body: 'Hi,\n\nAs part of our regulatory obligations we need a copy of a government-issued photo ID and a proof of address dated within the last 90 days.\n\n— Compliance, Verdexis' },
  { value: 'password_reset_offer', label: 'Password reset offer', subject: 'Reset your password', body: 'Hi,\n\nWe noticed unusual sign-in activity on your account. As a precaution we recommend resetting your password from the Settings page.\n\n— Security, Verdexis' },
  { value: 'security_alert', label: 'Security alert', subject: 'Security alert on your Verdexis account', body: 'Hi,\n\nWe blocked a suspicious action on your account. No further action is required at this time, but please contact us if you didn\u2019t initiate it.\n\n— Security, Verdexis' },
  { value: 'custom', label: 'Custom', subject: '', body: '' },
]

export interface AdminHolding { id: string; userId: string; symbol: string; name: string; amount: number; avgPrice: number; type: string; createdAt: string; updatedAt: string }
export interface AdminWalletBalance { id: string; userId: string; currency: string; symbol: string; balance: number; available: number; updatedAt: string }
export interface AdminTransaction { id: string; userId: string; kind: string; currency: string; amount: number; status: string; reference: string | null; reversedFromId?: string | null; subType?: string | null; createdAt: string }
export interface AdminTrade { id: string; userId: string; symbol: string; side: 'buy' | 'sell'; amount: number; price: number; total: number; createdAt: string }
export interface AdminWatchItem { id: string; userId: string; symbol: string; name: string; type: string; createdAt: string }
export interface AdminPriceAlert { id: string; userId: string; symbol: string; name: string; direction: 'above' | 'below'; target: number; active: boolean; triggered: boolean; createdAt: string }
export interface AdminNotification { id: string; userId: string; kind: string; title: string; body: string | null; read: boolean; createdAt: string }
export interface AdminWalletLink {
  id: string
  userId: string
  address: string
  chainId: string | null
  provider: string | null
  label: string | null
  isPrimary: boolean
  linkedAt: string
}

export interface AdminUserDetailResponse {
  user: AdminUserFull
  holdings: AdminHolding[]
  walletBalances: AdminWalletBalance[]
  walletLinks?: AdminWalletLink[]
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
    holds: number
    kycPending: number
    withdraws24h: number
    pendingDeposits: number
  }
  lastBroadcast: { at: string; by: string | null; payload: string | null } | null
  recentSignups: Array<Pick<AdminUserSummary, 'id' | 'email' | 'name' | 'createdAt' | 'role' | 'suspended'>>
  recentTx: Array<AdminTransaction & { user: { id: string; email: string; name: string } }>
}

export interface AdminSignupBonusSettings {
  enabled: boolean
  amountUsd: number
  note?: string
  updatedAt?: string
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
  get: (path: string) => request<any>(`/api/admin${path}`),
  post: (path: string, body?: unknown) => request<any>(`/api/admin${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) }),

  stats: () => request<AdminStats>('/api/admin/stats'),
  getSignupBonus: () => request<AdminSignupBonusSettings>('/api/admin/signup-bonus'),
  setSignupBonus: (input: { enabled: boolean; amountUsd: number; note?: string }) =>
    request<AdminSignupBonusSettings>('/api/admin/signup-bonus', { method: 'PUT', body: JSON.stringify(input) }),

  // --- Pending deposit approval queue ---
  listPendingDeposits: () =>
    request<{ deposits: Array<AdminTransaction & { user: { id: string; email: string; name: string; kycStatus: string; suspended: boolean } }> }>(`/api/admin/deposits/pending`),
  approveDeposit: (txId: string) =>
    request<{ balance: AdminWalletBalance; transaction: AdminTransaction }>(`/api/admin/deposits/${txId}/approve`, { method: 'POST' }),
  rejectDeposit: (txId: string, reason?: string) =>
    request<{ transaction: AdminTransaction }>(`/api/admin/deposits/${txId}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || '' }) }),

  // --- On-chain (PendingDeposit) approval queue ---
  // These come from users who connected a self-custody wallet and sent ETH
  // (or other native asset) to the admin treasury address. Admin verifies
  // the tx hash on a block explorer (explorerUrl is included in the row)
  // and approves to credit the user's WalletBalance.
  listOnchainDeposits: (status: 'pending' | 'credited' | 'rejected' | 'all' = 'pending') =>
    request<{
      pendingDeposits: Array<{
        id: string
        userId: string
        txHash: string
        chainId: string
        toAddress: string
        fromAddress: string
        asset: string
        amount: number
        status: string
        note: string | null
        creditedTxId: string | null
        createdAt: string
        explorerUrl: string
        user: { id: string; email: string; name: string; investmentId: string | null }
      }>
    }>(`/api/admin/pending-deposits?status=${status}`),
  approveOnchainDeposit: (id: string, payload: { currency?: string; amount?: number; note?: string } = {}) =>
    request<{ balance: AdminWalletBalance; transaction: AdminTransaction; pending: { id: string; status: string } }>(
      `/api/admin/pending-deposits/${id}/approve`,
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  rejectOnchainDeposit: (id: string, note?: string) =>
    request<{ pendingDeposit: { id: string; status: string } }>(
      `/api/admin/pending-deposits/${id}/reject`,
      { method: 'POST', body: JSON.stringify({ note: note || '' }) },
    ),

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

  createUser: (input: { email: string; username?: string; name: string; password: string; role?: 'user' | 'admin'; initialUsdBalance?: number }) =>
    request<{ user: AdminUserFull }>(`/api/admin/users`, { method: 'POST', body: JSON.stringify(input) }),

  deposit: (
    userId: string,
    input: {
      currency: string
      symbol?: string
      amount: number
      reason: string
      note?: string
      status?: 'pending' | 'completed'
      notify?: boolean
      // ISO-8601 timestamp the deposit should be recorded at (admin backdate).
      occurredAt?: string
      // Optional: invest the deposit into a real asset at the historical
      // spot price for `occurredAt`. Server creates/updates a Holding so the
      // dashboard's profit/loss reflects the real market move since then.
      investAs?: { symbol: string; name: string; type: 'crypto' | 'stock' | 'etf' }
    },
  ) =>
    request<{
      balance?: AdminWalletBalance
      holding?: { id: string; symbol: string; name: string; amount: number; avgPrice: number; type: string }
      transaction: AdminTransaction
      historicalPrice?: number
      quantity?: number
      currentPrice?: number | null
      unrealizedPnl?: number | null
      unrealizedPnlPct?: number | null
    }>(`/api/admin/users/${userId}/deposit`, { method: 'POST', body: JSON.stringify(input) }),

  deduct: (userId: string, input: { currency: string; symbol?: string; amount: number; reason: string; note?: string; status?: 'pending' | 'completed' | 'reversed'; allowNegative?: boolean; notify?: boolean }) =>
    request<{ balance: AdminWalletBalance; transaction: AdminTransaction }>(`/api/admin/users/${userId}/deduct`, { method: 'POST', body: JSON.stringify(input) }),

  placeHold: (userId: string, input: { holdType: 'all' | 'withdraw' | 'transfer'; reason: string; note?: string; notify?: boolean }) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${userId}/hold`, { method: 'POST', body: JSON.stringify(input) }),

  releaseHold: (userId: string) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${userId}/unhold`, { method: 'POST' }),

  patchUser: (id: string, patch: Partial<{ name: string; email: string; avatar: string | null; role: 'user' | 'admin'; suspended: boolean; suspendedReason: string | null; twoFactor: boolean; prefs: Record<string, unknown>; createdAt: string }>) =>
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

  // Per-user crypto / wire deposit destinations the admin assigns.
  // Stored server-side in the user's prefs.depositAddresses, so they
  // surface to the user on any device they sign in on.
  getUserDepositAddresses: (userId: string) =>
    request<{ addresses: unknown | null }>(`/api/admin/users/${userId}/deposit-addresses`),
  setUserDepositAddresses: (userId: string, addresses: unknown) =>
    request<{ addresses: unknown }>(`/api/admin/users/${userId}/deposit-addresses`, { method: 'PUT', body: JSON.stringify(addresses) }),
  clearUserDepositAddresses: (userId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${userId}/deposit-addresses`, { method: 'DELETE' }),

  // Admin-managed linked Web3 wallets (user self-custody addresses)
  listUserWalletLinks: (userId: string) =>
    request<{ links: AdminWalletLink[] }>(`/api/admin/users/${userId}/wallet-links`),
  upsertUserWalletLink: (
    userId: string,
    input: { address: string; chainId?: string; provider?: string; label?: string; setPrimary?: boolean },
  ) =>
    request<{ link: AdminWalletLink }>(`/api/admin/users/${userId}/wallet-links`, { method: 'POST', body: JSON.stringify(input) }),
  setUserWalletLinkPrimary: (userId: string, linkId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${userId}/wallet-links/${linkId}/primary`, { method: 'POST' }),
  deleteUserWalletLink: (userId: string, linkId: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${userId}/wallet-links/${linkId}`, { method: 'DELETE' }),

  // Transactions
  createTransaction: (userId: string, tx: { kind: string; currency: string; amount: number; status?: string; reference?: string; createdAt?: string }) =>
    request<{ transaction: AdminTransaction }>(`/api/admin/users/${userId}/transactions`, { method: 'POST', body: JSON.stringify(tx) }),
  patchTransaction: (id: string, tx: Partial<{ kind: string; currency: string; amount: number; status: string; reference: string; createdAt: string }>) =>
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
  audit: (params: { limit?: number; actorId?: string; targetUserId?: string; action?: string; since?: string; until?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)) })
    return request<{ audit: AdminAuditLog[] }>(`/api/admin/audit?${qs.toString()}`)
  },
  auditCsvUrl: (params: { limit?: number; actorId?: string; targetUserId?: string; action?: string; since?: string; until?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)) })
    return `${BASE}/api/admin/audit.csv?${qs.toString()}`
  },
  userAudit: (id: string, limit = 200) => request<{ audit: AdminAuditLog[] }>(`/api/admin/users/${id}/audit?limit=${limit}`),

  // Bulk
  bulkUsers: (input: { ids: string[]; action: 'hold' | 'release' | 'suspend' | 'unsuspend' | 'delete' | 'revoke'; reason?: string; holdType?: 'all' | 'withdraw' | 'transfer'; notify?: boolean }) =>
    request<{ ok: boolean; count: number }>(`/api/admin/users/bulk`, { method: 'POST', body: JSON.stringify(input) }),

  // Impersonate
  impersonate: (id: string) =>
    request<{ token: string; user: { id: string; email: string; name: string; role: string }; expiresInSec: number }>(`/api/admin/users/${id}/impersonate`, { method: 'POST' }),

  // Holdings adjust
  adjustHolding: (userId: string, input: { symbol: string; name?: string; type?: 'crypto' | 'stock' | 'etf'; side: 'buy' | 'sell'; amount: number; price: number; reason?: string; note?: string; notify?: boolean }) =>
    request<{ holding: AdminHolding | null; trade: AdminTrade }>(`/api/admin/users/${userId}/holdings/adjust`, { method: 'POST', body: JSON.stringify(input) }),

  // Reverse
  reverseTransaction: (id: string, input: { reason?: string; notify?: boolean } = {}) =>
    request<{ balance: AdminWalletBalance; reversal: AdminTransaction }>(`/api/admin/transactions/${id}/reverse`, { method: 'POST', body: JSON.stringify(input) }),

  // Admin transfer
  adminTransfer: (input: { fromUserId: string; toUserId: string; currency: string; amount: number; reason?: string; note?: string; allowNegative?: boolean; notify?: boolean }) =>
    request<{ fromBalance: AdminWalletBalance; toBalance: AdminWalletBalance; fromTx: AdminTransaction; toTx: AdminTransaction }>(`/api/admin/transfer`, { method: 'POST', body: JSON.stringify(input) }),

  // Fee
  chargeFee: (userId: string, input: { currency: string; amount: number; feeType: string; note?: string; allowNegative?: boolean; notify?: boolean }) =>
    request<{ balance: AdminWalletBalance; transaction: AdminTransaction }>(`/api/admin/users/${userId}/fee`, { method: 'POST', body: JSON.stringify(input) }),

  // KYC
  setKyc: (userId: string, input: { status: 'none' | 'pending' | 'approved' | 'rejected'; notes?: string; notify?: boolean }) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${userId}/kyc`, { method: 'POST', body: JSON.stringify(input) }),

  // Limits
  setLimits: (userId: string, input: { dailyWithdrawLimit?: number | null; monthlyWithdrawLimit?: number | null; dailyTransferLimit?: number | null; monthlyTransferLimit?: number | null }) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${userId}/limits`, { method: 'PATCH', body: JSON.stringify(input) }),

  // IP allowlist
  setIpAllowlist: (userId: string, ipAllowlist: string | null) =>
    request<{ user: AdminUserFull }>(`/api/admin/users/${userId}/ip-allowlist`, { method: 'PATCH', body: JSON.stringify({ ipAllowlist }) }),

  // Email
  emailUser: (userId: string, input: { subject: string; body: string; template?: string }) =>
    request<{ notification: AdminNotification; deliveredVia: string }>(`/api/admin/users/${userId}/email`, { method: 'POST', body: JSON.stringify(input) }),
}
