// Admin-managed PER-USER deposit / fee-payment instructions.
//
// Lets an admin assign a unique receiving wallet (crypto and/or USD wire)
// to each individual user. The values fall back to the global
// `depositInstructions` if not set for that user.
//
// Storage: localStorage on the admin device (mirrors how
// `depositInstructions` already works). Keyed by user email so the same
// override surfaces when that user logs in on the same browser/device.

const STORAGE_KEY = 'verdexis_user_wallets_v1'
export const USER_WALLETS_EVENT = 'verdexis:userWallets'

export interface UserCryptoOverride {
  currency: string
  network: string
  address: string
  memo?: string
  notes?: string
}

export interface UserWireOverride {
  beneficiaryName: string
  bankName: string
  routingNumber?: string
  swiftCode?: string
  accountNumber: string
  reference?: string
  notes?: string
}

export interface UserWalletOverride {
  /** Crypto deposit / fee-payment addresses, keyed by ticker (BTC, ETH...). */
  cryptos: Record<string, UserCryptoOverride>
  /** Single USD wire override (most users only need one). */
  wire?: UserWireOverride
  /** Free-form admin note shown to the user beside the wallet panel. */
  notes?: string
  updatedAt?: string
}

type Store = Record<string, UserWalletOverride>

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed as Store : {}
  } catch {
    return {}
  }
}

function write(s: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.dispatchEvent(new Event(USER_WALLETS_EVENT))
}

function key(emailOrId: string): string {
  return (emailOrId || '').trim().toLowerCase()
}

export const userWallets = {
  get(emailOrId: string): UserWalletOverride | null {
    const k = key(emailOrId)
    if (!k) return null
    const s = read()
    return s[k] || null
  },
  set(emailOrId: string, override: UserWalletOverride): void {
    const k = key(emailOrId)
    if (!k) return
    const s = read()
    s[k] = { ...override, updatedAt: new Date().toISOString() }
    write(s)
  },
  remove(emailOrId: string): void {
    const k = key(emailOrId)
    if (!k) return
    const s = read()
    delete s[k]
    write(s)
  },
  all(): Store { return read() },
}
