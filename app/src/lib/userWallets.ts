// Admin-managed PER-USER deposit / fee-payment instructions.
//
// Lets an admin assign a unique receiving wallet (crypto and/or USD wire)
// to each individual user. The values fall back to the global
// `depositInstructions` if not set for that user.
//
// Storage: server-persisted inside the user's `prefs.depositAddresses`
// JSON via /api/admin/users/:id/deposit-addresses (admin write) and
// /api/wallet/me/deposit-addresses (user read). Mirrored to localStorage
// as a fast cache, keyed by user email AND user id so both the admin
// (who knows the email) and the user (whose own profile we know) hit it.

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
  /** Cache an override under a given key without dispatching the event. */
  cache(emailOrId: string, override: UserWalletOverride | null): void {
    const k = key(emailOrId)
    if (!k) return
    const s = read()
    if (override) s[k] = override
    else delete s[k]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  },
}

// --- Server sync ---------------------------------------------------------
// Lazy-import api to avoid a circular dep at module load.

/**
 * Pull the per-user override the admin saved server-side and cache it
 * under both the email and (optionally) the user id. Call this after
 * login on the user side, and after opening a user detail page on the
 * admin side. Safe to call repeatedly.
 */
export async function hydrateUserWalletsFromServer(opts: {
  email?: string
  userId?: string
  /** When true, fetch via the admin endpoint (admin viewing another user). */
  admin?: boolean
}): Promise<UserWalletOverride | null> {
  try {
    const { api } = await import('./api')
    let addresses: UserWalletOverride | null = null
    if (opts.admin && opts.userId) {
      const { adminApi } = await import('./adminApi')
      const res = await adminApi.getUserDepositAddresses(opts.userId)
      addresses = (res.addresses as UserWalletOverride | null) ?? null
    } else {
      const res = await api.getMyDepositAddresses()
      addresses = (res.addresses as UserWalletOverride | null) ?? null
    }
    if (opts.email) userWallets.cache(opts.email, addresses)
    if (opts.userId) userWallets.cache(opts.userId, addresses)
    window.dispatchEvent(new Event(USER_WALLETS_EVENT))
    return addresses
  } catch {
    return null
  }
}

/**
 * Push an admin-edited override up to the server, so the user sees it on
 * any device. Returns the saved value (with server timestamp) or null on
 * failure.
 */
export async function pushUserWalletsToServer(
  userId: string,
  override: UserWalletOverride,
): Promise<UserWalletOverride | null> {
  try {
    const { adminApi } = await import('./adminApi')
    const res = await adminApi.setUserDepositAddresses(userId, override)
    return (res.addresses as UserWalletOverride | null) ?? null
  } catch {
    return null
  }
}
