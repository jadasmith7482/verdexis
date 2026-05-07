// Admin-managed deposit instructions.
//
// Two flavours:
//  - Wire transfer (USD / EUR / GBP) — admin enters the receiving bank
//    coordinates that show up on the user's deposit screen with copy buttons.
//  - Crypto wallets — admin enters the deposit address per network. The
//    Wallet page renders the address + QR code. Users scan and send.
//
// Stored in localStorage so a single admin can configure once on their
// browser and the values are read by every other tab on the same device.
// The CHANGED_EVENT lets the wallet UI react live when admin saves.

export const DEPOSIT_INSTRUCTIONS_EVENT = 'verdexis:depositInstructions'
const STORAGE_KEY = 'verdexis_deposit_instructions_v1'
const ADMIN_FLAG_KEY = 'verdexis_admin'

export interface WireInstruction {
  /** Display label, e.g. "USD Wire (Domestic)". */
  label: string
  /** Account holder name as registered with the bank. */
  beneficiaryName: string
  /** Beneficiary street / postal address (often required on wires). */
  beneficiaryAddress?: string
  bankName: string
  bankAddress?: string
  /** ABA / routing number for domestic US wires. */
  routingNumber?: string
  /** SWIFT / BIC for international wires. */
  swiftCode?: string
  /** IBAN for EU / UK wires. */
  iban?: string
  accountNumber: string
  /** A reference / memo the user MUST include so we can credit them. */
  reference?: string
  /** Optional free-form note shown in a callout below the details. */
  notes?: string
}

export interface CryptoWallet {
  /** Coingecko-style id ("bitcoin", "ethereum", "solana", ...). */
  currency: string
  /** Network label, e.g. "Bitcoin", "Ethereum (ERC-20)", "Solana". */
  network: string
  address: string
  /** Optional memo / destination tag (XRP, XLM, BNB, ...). */
  memo?: string
  /** Min confirmations / processing note rendered to the user. */
  notes?: string
}

export interface DepositInstructions {
  wires: Record<string, WireInstruction> // keyed by currency, e.g. "USD"
  cryptos: Record<string, CryptoWallet>  // keyed by currency, e.g. "BTC"
  /** Admin-managed Web3 payout address shown in the user's wallet picker.
   *  Keyed by EIP-155 chain id hex (e.g. "0x1" Ethereum, "0x89" Polygon)
   *  with an optional "default" fallback used when no chain-specific entry. */
  web3: Record<string, Web3Payout>
}

export interface Web3Payout {
  /** Human label, e.g. "Verdexis Treasury (ETH Mainnet)". */
  label: string
  /** EIP-155 chain id hex, e.g. "0x1". Use "default" to apply to any chain. */
  chainId: string
  /** 0x... EVM address that user funds will be transferred to. */
  address: string
  /** Optional note shown to the user. */
  notes?: string
}

const EMPTY: DepositInstructions = { wires: {}, cryptos: {}, web3: {} }

function read(): DepositInstructions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<DepositInstructions>
    return {
      wires: parsed.wires ?? {},
      cryptos: parsed.cryptos ?? {},
      web3: parsed.web3 ?? {},
    }
  } catch {
    return EMPTY
  }
}

function write(next: DepositInstructions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(DEPOSIT_INSTRUCTIONS_EVENT))
  } catch {
    /* localStorage may be disabled — fail silently */
  }
}

export const depositInstructions = {
  all(): DepositInstructions {
    return read()
  },
  getWire(currency: string): WireInstruction | null {
    return read().wires[currency.toUpperCase()] ?? null
  },
  getCrypto(currency: string): CryptoWallet | null {
    return read().cryptos[currency.toUpperCase()] ?? null
  },
  setWire(currency: string, info: WireInstruction): void {
    const cur = read()
    cur.wires[currency.toUpperCase()] = info
    write(cur)
  },
  removeWire(currency: string): void {
    const cur = read()
    delete cur.wires[currency.toUpperCase()]
    write(cur)
  },
  setCrypto(currency: string, info: CryptoWallet): void {
    const cur = read()
    cur.cryptos[currency.toUpperCase()] = info
    write(cur)
  },
  removeCrypto(currency: string): void {
    const cur = read()
    delete cur.cryptos[currency.toUpperCase()]
    write(cur)
  },
  /** Resolve Web3 payout for a chain id (hex). Falls back to "default". */
  getWeb3Payout(chainId: string | null | undefined): Web3Payout | null {
    const cur = read()
    if (chainId) {
      const hit = cur.web3[chainId.toLowerCase()]
      if (hit) return hit
    }
    return cur.web3['default'] ?? null
  },
  listWeb3Payouts(): Web3Payout[] {
    const cur = read()
    return Object.values(cur.web3)
  },
  setWeb3Payout(info: Web3Payout): void {
    const cur = read()
    const key = (info.chainId || 'default').toLowerCase()
    cur.web3[key] = { ...info, chainId: key }
    write(cur)
  },
  removeWeb3Payout(chainId: string): void {
    const cur = read()
    delete cur.web3[chainId.toLowerCase()]
    write(cur)
  },
}

/**
 * Subscribe to changes in deposit instructions across tabs and same-tab
 * updates. Returns an unsubscribe function.
 */
export function onDepositInstructionsChanged(cb: () => void): () => void {
  const handler = () => cb()
  const storage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb() }
  window.addEventListener(DEPOSIT_INSTRUCTIONS_EVENT, handler)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(DEPOSIT_INSTRUCTIONS_EVENT, handler)
    window.removeEventListener('storage', storage)
  }
}

// ---- Admin gating ---------------------------------------------------------
// Admin status is a local flag. In production this would check a server
// claim, but the deposit instructions themselves are public-readable (anyone
// who deposits needs to see the address), so the only action that matters
// is *write*, which we restrict client-side via this flag.
export function isAdmin(): boolean {
  try { return localStorage.getItem(ADMIN_FLAG_KEY) === '1' } catch { return false }
}

export function setAdmin(on: boolean): void {
  try {
    if (on) localStorage.setItem(ADMIN_FLAG_KEY, '1')
    else localStorage.removeItem(ADMIN_FLAG_KEY)
    window.dispatchEvent(new CustomEvent(DEPOSIT_INSTRUCTIONS_EVENT))
  } catch { /* ignore */ }
}
