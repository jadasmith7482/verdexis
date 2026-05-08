import { api, getToken } from './api'

export interface PortfolioHolding {
  id: string
  symbol: string
  name: string
  quantity: number
  avgBuyPrice: number
  currentPrice: number
  value: number
  pnl: number
  pnlPercent: number
  allocation: number
}

export interface Trade {
  id: string
  symbol: string
  name: string
  side: 'buy' | 'sell'
  type: string
  price: number
  quantity: number
  total: number
  timestamp: Date
}

export interface WalletTransaction {
  id: string
  type: 'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest'
  amount: number
  currency: string
  description: string
  timestamp: Date
  status: 'completed' | 'pending'
}

export interface WalletBalance {
  currency: string
  symbol: string
  balance: number
  available: number
}

const STORAGE_KEYS = {
  holdings: 'verdexis_holdings',
  trades: 'verdexis_trades',
  wallet: 'verdexis_wallet',
  transactions: 'verdexis_transactions',
}

// One-time purge of the legacy mock seed data (BTC 2.45 / USDC 125,430 /
// $5,000 "Bank Transfer from Chase" etc.) that earlier builds wrote to
// localStorage on first visit. Bumping this key forces a re-evaluation:
// any browser still holding the seed will be cleared once and start fresh.
const STORAGE_RESET_FLAG = 'verdexis_storage_reset_v2'
function purgeLegacyMockSeeds() {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(STORAGE_RESET_FLAG) === '1') return
    localStorage.removeItem(STORAGE_KEYS.holdings)
    localStorage.removeItem(STORAGE_KEYS.trades)
    localStorage.removeItem(STORAGE_KEYS.wallet)
    localStorage.removeItem(STORAGE_KEYS.transactions)
    localStorage.setItem(STORAGE_RESET_FLAG, '1')
  } catch { /* ignore */ }
}
purgeLegacyMockSeeds()

// Empty defaults: real holdings/trades/balances come from the server (loadFromApi)
// once the user is authenticated. Showing seeded mock numbers like $125,430.50 or
// a $5,000 "Bank Transfer from Chase" creates the impression that the app is
// faking balances. Anonymous / pre-login views start at zero and reflect actual
// activity from there.
const DEFAULT_HOLDINGS: PortfolioHolding[] = []

const DEFAULT_TRADES: Trade[] = []

const DEFAULT_WALLET: WalletBalance[] = [
  { currency: 'USD', symbol: '$', balance: 0, available: 0 },
  { currency: 'BTC', symbol: 'B', balance: 0, available: 0 },
  { currency: 'ETH', symbol: 'E', balance: 0, available: 0 },
  { currency: 'SOL', symbol: 'S', balance: 0, available: 0 },
]

const DEFAULT_TRANSACTIONS: WalletTransaction[] = []

interface ApiHolding { id: string; symbol: string; name: string; amount: number; avgPrice: number; type: string }
interface ApiBalance { currency: string; symbol: string; balance: number; available: number }
interface ApiTransaction { id: string; kind: 'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest'; currency: string; amount: number; reference?: string | null; status: string; createdAt: string }
interface ApiTrade { id: string; symbol: string; side: 'buy' | 'sell'; amount: number; price: number; total: number; createdAt: string }

const PORTFOLIO_EVENT = 'verdexis:portfolio'

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PORTFOLIO_EVENT))
  }
}

function symbolFor(currency: string): string {
  const map: Record<string, string> = { USD: '$', BTC: 'B', ETH: 'E', SOL: 'S', USDC: '$', USDT: '$' }
  return map[currency] || currency
}

class PortfolioStoreImpl {
  private holdings: PortfolioHolding[]
  private trades: Trade[]
  private wallet: WalletBalance[]
  private transactions: WalletTransaction[]
  private hydrated = false
  // Most recent live quote map keyed by both coin id (e.g. 'bitcoin') and
  // upper-case symbol (e.g. 'BTC'). Updated by markToMarket so wallet-value
  // helpers can convert non-USD balances to USD using the same prices the
  // dashboard already uses for holdings. Falls back to baseline rates below.
  private lastQuotes: Record<string, number> = {}

  constructor() {
    this.holdings = this.load(STORAGE_KEYS.holdings, DEFAULT_HOLDINGS)
    this.trades = this.load(STORAGE_KEYS.trades, DEFAULT_TRADES)
    this.wallet = this.load(STORAGE_KEYS.wallet, DEFAULT_WALLET)
    this.transactions = this.load(STORAGE_KEYS.transactions, DEFAULT_TRANSACTIONS)
  }

  private load<T>(key: string, fallback: T): T {
    try {
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return fallback
  }

  private save(key: string, data: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  async hydrate(force = false): Promise<void> {
    if (!getToken()) return
    if (this.hydrated && !force) return
    try {
      const [hRes, wRes, tRes] = await Promise.all([
        api.listHoldings(),
        api.getWallet(),
        api.listTrades(),
      ])

      const apiHoldings = (hRes.holdings as ApiHolding[]).map<PortfolioHolding>((h) => {
        const value = h.amount * h.avgPrice
        return {
          id: h.symbol.toLowerCase(),
          symbol: h.symbol,
          name: h.name,
          quantity: h.amount,
          avgBuyPrice: h.avgPrice,
          currentPrice: h.avgPrice,
          value,
          pnl: 0,
          pnlPercent: 0,
          allocation: 0,
        }
      })
      const totalValue = apiHoldings.reduce((s, h) => s + h.value, 0)
      apiHoldings.forEach((h) => { h.allocation = totalValue > 0 ? Math.round((h.value / totalValue) * 100) : 0 })

      const apiBalances = (wRes.balances as ApiBalance[]).map<WalletBalance>((b) => ({
        currency: b.currency,
        symbol: b.symbol || symbolFor(b.currency),
        balance: b.balance,
        available: b.available,
      }))

      const apiTransactions = (wRes.transactions as ApiTransaction[]).map<WalletTransaction>((tx) => ({
        id: tx.id,
        type: tx.kind,
        amount: (tx.kind === 'deposit' || tx.kind === 'dividend' || tx.kind === 'interest') ? tx.amount : -Math.abs(tx.amount),
        currency: tx.currency,
        description: tx.reference || `${tx.kind[0].toUpperCase()}${tx.kind.slice(1)} ${tx.currency}`,
        timestamp: new Date(tx.createdAt),
        status: tx.status === 'completed' ? 'completed' : 'pending',
      }))

      const apiTrades = (tRes.trades as ApiTrade[]).map<Trade>((t) => ({
        id: t.id,
        symbol: t.symbol,
        name: t.symbol,
        side: t.side,
        type: 'market',
        price: t.price,
        quantity: t.amount,
        total: t.total,
        timestamp: new Date(t.createdAt),
      }))

      this.holdings = apiHoldings
      this.wallet = apiBalances
      this.transactions = apiTransactions
      this.trades = apiTrades

      this.save(STORAGE_KEYS.holdings, this.holdings)
      this.save(STORAGE_KEYS.wallet, this.wallet)
      this.save(STORAGE_KEYS.transactions, this.transactions)
      this.save(STORAGE_KEYS.trades, this.trades)
      this.hydrated = true
      emit()
    } catch {
      // API offline or auth expired; keep local cache
    }
  }

  getHoldings(): PortfolioHolding[] { return this.holdings }

  /**
   * Update currentPrice / value / pnl / allocation from a live quote map keyed by
   * coin id (e.g. 'bitcoin') OR lower-case symbol (e.g. 'btc'). Called whenever
   * the crypto market list refreshes so the portfolio actually moves with the market.
   * Persists to localStorage and emits a single change event.
   */
  markToMarket(quotes: Record<string, number>): void {
    // Always cache quotes (even when no holdings) so wallet conversions can
    // use them. Keys come in as coin id ('bitcoin') and/or symbol ('btc').
    for (const [k, v] of Object.entries(quotes)) {
      if (typeof v === 'number' && isFinite(v) && v > 0) {
        this.lastQuotes[k.toLowerCase()] = v
        this.lastQuotes[k.toUpperCase()] = v
      }
    }
    if (!this.holdings.length) return
    let changed = false
    for (const h of this.holdings) {
      const live = quotes[h.id] ?? quotes[h.symbol?.toLowerCase()] ?? quotes[h.symbol]
      if (typeof live !== 'number' || !isFinite(live) || live <= 0) continue
      if (live === h.currentPrice) continue
      h.currentPrice = live
      h.value = h.quantity * live
      const cost = h.avgBuyPrice * h.quantity
      h.pnl = h.value - cost
      h.pnlPercent = cost > 0 ? (h.pnl / cost) * 100 : 0
      changed = true
    }
    if (!changed) return
    const totalValue = this.holdings.reduce((s, x) => s + x.value, 0)
    this.holdings.forEach((h) => { h.allocation = totalValue > 0 ? Math.round((h.value / totalValue) * 100) : 0 })
    this.save(STORAGE_KEYS.holdings, this.holdings)
    emit()
  }

  getTrades(): Trade[] {
    return [...this.trades].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getWallet(): WalletBalance[] { return this.wallet }

  /** Latest live quote (USD per unit) for a currency / coin id. Returns
   *  null when no live quote has been seen yet so callers can fall back
   *  to a sensible default rather than silently using 0. */
  getQuote(currencyOrId: string): number | null {
    if (!currencyOrId) return null
    const cur = currencyOrId.toUpperCase()
    if (cur === 'USD' || cur === 'USDC' || cur === 'USDT') return 1
    const live = this.lastQuotes[cur] ?? this.lastQuotes[currencyOrId.toLowerCase()]
    return typeof live === 'number' && live > 0 ? live : null
  }

  /** Single source of truth for the user's cash side. Sums every wallet
   *  entry converted to USD: USD/USDC/USDT count as 1:1, other currencies
   *  use the latest live quote (cached from markToMarket) and fall back to
   *  a static baseline only if no live price has ever been seen.  */
  getWalletValueUsd(): number {
    const baseline: Record<string, number> = { USD: 1, USDC: 1, USDT: 1, BTC: 67432, ETH: 3521, SOL: 178.45, ADA: 0.52 }
    let total = 0
    for (const w of this.wallet) {
      const cur = w.currency.toUpperCase()
      if (cur === 'USD' || cur === 'USDC' || cur === 'USDT') { total += w.balance; continue }
      const live = this.lastQuotes[cur] ?? this.lastQuotes[cur.toLowerCase()]
      const rate = (typeof live === 'number' && live > 0) ? live : (baseline[cur] ?? 0)
      total += w.balance * rate
    }
    return total
  }

  /** Net worth = holdings (positions) value at market + wallet cash + crypto
   *  wallet balances valued at market. This is the figure surfaced as the
   *  big "Total Net Worth" on the dashboard and matches the Wallet page. */
  getNetWorth(): number {
    const positions = this.holdings.reduce((s, h) => s + h.value, 0)
    return positions + this.getWalletValueUsd()
  }

  getTransactions(): WalletTransaction[] {
    return [...this.transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  executeTrade(symbol: string, name: string, side: 'buy' | 'sell', price: number, quantity: number, type: string): Trade {
    const total = price * quantity
    const trade: Trade = {
      id: Date.now().toString(),
      symbol, name, side, type, price, quantity, total,
      timestamp: new Date(),
    }

    this.trades.push(trade)
    this.save(STORAGE_KEYS.trades, this.trades)

    const existingIdx = this.holdings.findIndex((h) => h.symbol === symbol)
    if (side === 'buy') {
      if (existingIdx >= 0) {
        const h = this.holdings[existingIdx]
        const newQty = h.quantity + quantity
        h.avgBuyPrice = (h.avgBuyPrice * h.quantity + price * quantity) / newQty
        h.quantity = newQty
        h.currentPrice = price
        h.value = newQty * price
        h.pnl = h.value - h.avgBuyPrice * newQty
        h.pnlPercent = (h.pnl / (h.avgBuyPrice * newQty)) * 100
      } else {
        this.holdings.push({
          id: symbol.toLowerCase(), symbol, name, quantity,
          avgBuyPrice: price, currentPrice: price, value: total,
          pnl: 0, pnlPercent: 0, allocation: 0,
        })
      }
    } else if (existingIdx >= 0) {
      const h = this.holdings[existingIdx]
      h.quantity = Math.max(0, h.quantity - quantity)
      h.currentPrice = price
      h.value = h.quantity * price
      if (h.quantity === 0) this.holdings.splice(existingIdx, 1)
    }

    const totalValue = this.holdings.reduce((s, h) => s + h.value, 0)
    this.holdings.forEach((h) => { h.allocation = totalValue > 0 ? Math.round((h.value / totalValue) * 100) : 0 })
    this.save(STORAGE_KEYS.holdings, this.holdings)

    if (getToken()) {
      api.postTrade({ symbol, name, side, amount: quantity, price, type: 'crypto' })
        .then(() => this.hydrate(true))
        .catch(() => { /* offline; local cache wins */ })
    }
    emit()
    return trade
  }

  addTransaction(type: 'deposit' | 'withdraw' | 'transfer' | 'dividend' | 'interest', amount: number, currency: string, description: string): WalletTransaction {
    // User deposits require admin approval on the server (status='pending',
    // no balance credit) unless the actor is an admin. Mirror that locally
    // so the UI doesn't show inflated balances or "completed" badges for
    // requests that haven't actually settled. See server/src/routes/wallet.ts.
    let role: 'user' | 'admin' = 'user'
    try {
      const raw = localStorage.getItem('verdexis_auth')
      if (raw) {
        const u = JSON.parse(raw) as { role?: string }
        if (u?.role === 'admin') role = 'admin'
      }
    } catch { /* ignore */ }
    const requiresApproval = type === 'deposit' && role !== 'admin'

    const tx: WalletTransaction = {
      id: Date.now().toString(),
      type, amount, currency, description,
      timestamp: new Date(),
      status: requiresApproval ? 'pending' : 'completed',
    }

    this.transactions.push(tx)
    this.save(STORAGE_KEYS.transactions, this.transactions)

    // Pending deposits do NOT credit the local wallet — server won't either,
    // and the funds only land after an admin approves.
    if (!requiresApproval) {
      const walletEntry = this.wallet.find((w) => w.currency === currency)
      if (walletEntry) {
        walletEntry.balance += amount
        walletEntry.available += amount
        this.save(STORAGE_KEYS.wallet, this.wallet)
      }
    }

    if (getToken()) {
      api.postTransaction({ kind: type, currency, symbol: symbolFor(currency), amount: Math.abs(amount), reference: description })
        .then(() => this.hydrate(true))
        .catch(() => { /* offline; local cache wins */ })
    }
    emit()
    return tx
  }

  reset() {
    localStorage.removeItem(STORAGE_KEYS.holdings)
    localStorage.removeItem(STORAGE_KEYS.trades)
    localStorage.removeItem(STORAGE_KEYS.wallet)
    localStorage.removeItem(STORAGE_KEYS.transactions)
    this.holdings = [...DEFAULT_HOLDINGS]
    this.trades = [...DEFAULT_TRADES]
    this.wallet = [...DEFAULT_WALLET]
    this.transactions = [...DEFAULT_TRANSACTIONS]
    this.hydrated = false
    emit()
  }
}

export const portfolioStore = new PortfolioStoreImpl()
export const PORTFOLIO_EVENT_NAME = PORTFOLIO_EVENT

if (typeof window !== 'undefined') {
  setTimeout(() => { void portfolioStore.hydrate() }, 0)
  window.addEventListener('verdexis:profile', () => { void portfolioStore.hydrate(true) })
  // Pull fresh server state when the user returns to the tab so admin-approved
  // deposits, transfers, etc. show up without a manual reload.
  window.addEventListener('focus', () => { if (getToken()) void portfolioStore.hydrate(true) })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getToken()) void portfolioStore.hydrate(true)
  })
  // NotificationBell fires this when a deposit is approved/rejected, a
  // transfer is received, or a trade fills server-side. Refresh balances
  // immediately so the user doesn't see stale numbers next to a "Deposit
  // approved" toast.
  window.addEventListener('verdexis:portfolio-refresh', () => {
    if (getToken()) void portfolioStore.hydrate(true)
  })
}
