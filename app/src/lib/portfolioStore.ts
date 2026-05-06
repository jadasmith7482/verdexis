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
  type: 'deposit' | 'withdraw' | 'transfer'
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

const DEFAULT_HOLDINGS: PortfolioHolding[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', quantity: 2.45, avgBuyPrice: 67432, currentPrice: 67432, value: 165208, pnl: 12450, pnlPercent: 8.15, allocation: 45 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', quantity: 15.23, avgBuyPrice: 3521, currentPrice: 3521, value: 53625, pnl: 3210, pnlPercent: 6.37, allocation: 27 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', quantity: 234.5, avgBuyPrice: 178.45, currentPrice: 178.45, value: 41842, pnl: -1240, pnlPercent: -2.87, allocation: 18 },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', quantity: 5000, avgBuyPrice: 0.52, currentPrice: 0.52, value: 2600, pnl: 180, pnlPercent: 7.43, allocation: 5 },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', quantity: 125430, avgBuyPrice: 1, currentPrice: 1, value: 125430, pnl: 0, pnlPercent: 0, allocation: 5 },
]

const DEFAULT_TRADES: Trade[] = [
  { id: '1', symbol: 'BTC', name: 'Bitcoin', side: 'buy', type: 'market', price: 67432, quantity: 0.5, total: 33716, timestamp: new Date(Date.now() - 86400000) },
  { id: '2', symbol: 'ETH', name: 'Ethereum', side: 'buy', type: 'limit', price: 3521, quantity: 2.0, total: 7042, timestamp: new Date(Date.now() - 172800000) },
  { id: '3', symbol: 'SOL', name: 'Solana', side: 'sell', type: 'market', price: 178.45, quantity: 10, total: 1784.5, timestamp: new Date(Date.now() - 259200000) },
]

const DEFAULT_WALLET: WalletBalance[] = [
  { currency: 'USD', symbol: '$', balance: 125430.50, available: 125430.50 },
  { currency: 'BTC', symbol: '₿', balance: 2.4538, available: 2.4538 },
  { currency: 'ETH', symbol: 'Ξ', balance: 15.2341, available: 15.2341 },
  { currency: 'SOL', symbol: '◎', balance: 234.56, available: 234.56 },
]

const DEFAULT_TRANSACTIONS: WalletTransaction[] = [
  { id: '1', type: 'deposit', amount: 5000, currency: 'USD', description: 'Bank Transfer from Chase', timestamp: new Date(Date.now() - 3600000), status: 'completed' },
  { id: '2', type: 'withdraw', amount: -1200, currency: 'ETH', description: 'ETH Purchase', timestamp: new Date(Date.now() - 86400000), status: 'completed' },
  { id: '3', type: 'transfer', amount: -500, currency: 'USD', description: 'Sent to John Doe', timestamp: new Date(Date.now() - 172800000), status: 'completed' },
  { id: '4', type: 'withdraw', amount: -9.99, currency: 'USD', description: 'Spotify Subscription', timestamp: new Date(Date.now() - 259200000), status: 'completed' },
  { id: '5', type: 'deposit', amount: 25000, currency: 'USD', description: 'Wire Transfer Received', timestamp: new Date(Date.now() - 604800000), status: 'completed' },
]

class PortfolioStore {
  private holdings: PortfolioHolding[]
  private trades: Trade[]
  private wallet: WalletBalance[]
  private transactions: WalletTransaction[]

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

  getHoldings(): PortfolioHolding[] {
    return this.holdings
  }

  getTrades(): Trade[] {
    return this.trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getWallet(): WalletBalance[] {
    return this.wallet
  }

  getTransactions(): WalletTransaction[] {
    return this.transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  executeTrade(symbol: string, name: string, side: 'buy' | 'sell', price: number, quantity: number, type: string): Trade {
    const total = price * quantity
    const trade: Trade = {
      id: Date.now().toString(),
      symbol,
      name,
      side,
      type,
      price,
      quantity,
      total,
      timestamp: new Date(),
    }

    this.trades.push(trade)
    this.save(STORAGE_KEYS.trades, this.trades)

    // Update holdings
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
          id: symbol.toLowerCase(),
          symbol,
          name,
          quantity,
          avgBuyPrice: price,
          currentPrice: price,
          value: total,
          pnl: 0,
          pnlPercent: 0,
          allocation: 0,
        })
      }
    } else {
      if (existingIdx >= 0) {
        const h = this.holdings[existingIdx]
        h.quantity = Math.max(0, h.quantity - quantity)
        h.currentPrice = price
        h.value = h.quantity * price
        if (h.quantity === 0) {
          this.holdings.splice(existingIdx, 1)
        }
      }
    }

    // Recalculate allocations
    const totalValue = this.holdings.reduce((s, h) => s + h.value, 0)
    this.holdings.forEach((h) => { h.allocation = totalValue > 0 ? Math.round((h.value / totalValue) * 100) : 0 })

    this.save(STORAGE_KEYS.holdings, this.holdings)
    return trade
  }

  addTransaction(type: 'deposit' | 'withdraw' | 'transfer', amount: number, currency: string, description: string): WalletTransaction {
    const tx: WalletTransaction = {
      id: Date.now().toString(),
      type,
      amount,
      currency,
      description,
      timestamp: new Date(),
      status: 'completed',
    }

    this.transactions.push(tx)
    this.save(STORAGE_KEYS.transactions, this.transactions)

    // Update wallet balance
    const walletEntry = this.wallet.find((w) => w.currency === currency)
    if (walletEntry) {
      walletEntry.balance += amount
      walletEntry.available += amount
      this.save(STORAGE_KEYS.wallet, this.wallet)
    }

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
  }
}

export const portfolioStore = new PortfolioStore()
