// Lightweight bank-account "linking" store. This is a realistic-feeling
// stand-in for a real Plaid / Stripe Financial Connections flow:
//  - Verifies routing-number checksum (ABA)
//  - Stores masked account info locally
//  - Simulates a 2 step verification (micro-deposits OR instant)
//  - Generates a deterministic `accountToken` other code can reference
//
// When the real provider is wired in, the public API here stays the same —
// only the implementation of `linkBank()` / `verifyAccount()` will change.

const STORAGE_KEY = 'verdexis_bank_accounts'

export type BankAccountType = 'checking' | 'savings'
export type BankVerificationMethod = 'instant' | 'micro_deposits'
export type BankStatus = 'pending' | 'verified' | 'failed'

export interface BankAccount {
  id: string
  accountToken: string
  institution: string
  accountHolder: string
  type: BankAccountType
  routingNumber: string         // full, used for checksum (not displayed)
  accountMask: string           // last 4 only — what we render
  status: BankStatus
  verificationMethod: BankVerificationMethod
  linkedAt: string              // ISO
  verifiedAt?: string
}

// Common US bank routing prefixes -> institution name. Best-effort, not exhaustive.
const ROUTING_INSTITUTIONS: Array<[RegExp, string]> = [
  [/^021000021$/, 'JPMorgan Chase'],
  [/^026009593$/, 'Bank of America'],
  [/^121000248$/, 'Wells Fargo'],
  [/^111000025$/, 'Federal Reserve Bank'],
  [/^061000104$/, 'SunTrust / Truist'],
  [/^011401533$/, 'Citizens Bank'],
  [/^031176110$/, 'Capital One'],
  [/^124003116$/, 'Zions Bancorporation'],
  [/^103100195$/, 'Bank of Oklahoma'],
  [/^^/, ''], // sentinel
]

function readAll(): BankAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BankAccount[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(list: BankAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    window.dispatchEvent(new Event('verdexis:banks'))
  } catch { /* ignore */ }
}

/**
 * Validate ABA routing number using the standard 9-digit checksum.
 * Real banks won't accept anything else — so we won't either.
 */
export function isValidRoutingNumber(rn: string): boolean {
  if (!/^\d{9}$/.test(rn)) return false
  const d = rn.split('').map(Number)
  const sum =
    3 * (d[0] + d[3] + d[6]) +
    7 * (d[1] + d[4] + d[7]) +
    1 * (d[2] + d[5] + d[8])
  return sum % 10 === 0
}

export function institutionForRouting(rn: string): string {
  for (const [re, name] of ROUTING_INSTITUTIONS) {
    if (re.test(rn) && name) return name
  }
  // Plausible-sounding generic name based on first 4 digits
  const region = rn.slice(0, 4)
  return `Member Bank ${region}`
}

export function listBanks(): BankAccount[] {
  return readAll()
}

export function getBank(id: string): BankAccount | null {
  return readAll().find((b) => b.id === id) ?? null
}

export interface LinkBankInput {
  accountHolder: string
  routingNumber: string
  accountNumber: string
  type: BankAccountType
  /** 'instant' marks the account verified immediately (Plaid Link style).
   *  'micro_deposits' starts pending and resolves after a short delay. */
  verificationMethod?: BankVerificationMethod
}

export interface LinkBankResult {
  ok: boolean
  account?: BankAccount
  error?: string
}

export function linkBank(input: LinkBankInput): LinkBankResult {
  const { accountHolder, routingNumber, accountNumber, type, verificationMethod = 'instant' } = input
  if (!accountHolder.trim()) return { ok: false, error: 'Account holder name is required' }
  if (!isValidRoutingNumber(routingNumber)) return { ok: false, error: 'Invalid routing number (ABA checksum failed)' }
  if (!/^\d{4,17}$/.test(accountNumber)) return { ok: false, error: 'Account number must be 4–17 digits' }

  const all = readAll()
  const mask = accountNumber.slice(-4)
  // Reject obvious duplicate on same routing+last4
  if (all.some((b) => b.routingNumber === routingNumber && b.accountMask === mask)) {
    return { ok: false, error: 'This bank account is already linked' }
  }

  const id = `ba_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const accountToken = `vbtok_${id.slice(3)}_${routingNumber.slice(0, 4)}${mask}`
  const account: BankAccount = {
    id,
    accountToken,
    institution: institutionForRouting(routingNumber),
    accountHolder: accountHolder.trim(),
    type,
    routingNumber,
    accountMask: mask,
    status: verificationMethod === 'instant' ? 'verified' : 'pending',
    verificationMethod,
    linkedAt: new Date().toISOString(),
    verifiedAt: verificationMethod === 'instant' ? new Date().toISOString() : undefined,
  }
  all.unshift(account)
  writeAll(all)

  // Simulate micro-deposit verification arriving 1–2 business days later.
  // For demo purposes we resolve in 6 seconds.
  if (verificationMethod === 'micro_deposits') {
    window.setTimeout(() => {
      const list = readAll()
      const idx = list.findIndex((b) => b.id === id)
      if (idx === -1) return
      list[idx] = { ...list[idx], status: 'verified', verifiedAt: new Date().toISOString() }
      writeAll(list)
    }, 6000)
  }

  return { ok: true, account }
}

export function removeBank(id: string): void {
  const all = readAll().filter((b) => b.id !== id)
  writeAll(all)
}

/** Subscribe to bank list changes (cross-tab + same-tab). */
export function onBanksChanged(cb: () => void): () => void {
  const handler = () => cb()
  window.addEventListener('verdexis:banks', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('verdexis:banks', handler)
    window.removeEventListener('storage', handler)
  }
}
