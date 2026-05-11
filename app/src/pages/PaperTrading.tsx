import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FlaskConical, TrendingUp, TrendingDown, RotateCcw, BookOpen } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'

interface PaperPosition {
  symbol: string
  name: string
  qty: number
  avgCost: number
  currentPrice: number
}

interface PaperTrade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  qty: number
  price: number
  total: number
  ts: number
}

interface PaperState {
  balance: number
  positions: PaperPosition[]
  trades: PaperTrade[]
}

const INITIAL_BALANCE = 100_000

const MOCK_PRICES: Record<string, { name: string; price: number; change: number }> = {
  BTC: { name: 'Bitcoin', price: 62_450, change: 2.3 },
  ETH: { name: 'Ethereum', price: 3_280, change: 1.8 },
  SOL: { name: 'Solana', price: 178, change: -0.9 },
  BNB: { name: 'BNB', price: 590, change: 0.5 },
  XRP: { name: 'XRP', price: 0.54, change: 3.1 },
  ADA: { name: 'Cardano', price: 0.44, change: -1.2 },
  DOGE: { name: 'Dogecoin', price: 0.165, change: 5.4 },
  AVAX: { name: 'Avalanche', price: 38.2, change: -2.1 },
}

const STORAGE_KEY = 'verdexis_paper'

function loadState(): PaperState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PaperState>
      return {
        balance: typeof parsed.balance === 'number' ? parsed.balance : INITIAL_BALANCE,
        positions: Array.isArray(parsed.positions) ? parsed.positions : [],
        trades: Array.isArray(parsed.trades) ? parsed.trades : [],
      }
    }
  } catch {
    // ignore malformed persisted state
  }
  return { balance: INITIAL_BALANCE, positions: [] as PaperPosition[], trades: [] as PaperTrade[] }
}

function saveState(s: PaperState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export default function PaperTrading() { return <RequireAuth><PaperTradingInner /></RequireAuth> }

function PaperTradingInner() {
  const [state, setState] = useState<PaperState>(loadState)
  const [symbol, setSymbol] = useState('BTC')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState('')

  const prices = MOCK_PRICES
  const currentPrice = prices[symbol]?.price ?? 0
  const totalCost = parseFloat(qty || '0') * currentPrice

  const portfolioValue = state.positions.reduce((acc, p) => {
    const price = prices[p.symbol]?.price ?? p.currentPrice
    return acc + p.qty * price
  }, 0)

  const totalEquity = state.balance + portfolioValue
  const pnl = totalEquity - INITIAL_BALANCE
  const pnlPct = (pnl / INITIAL_BALANCE) * 100

  const execute = () => {
    const amount = parseFloat(qty)
    if (!amount || amount <= 0) { toast.error('Enter a valid quantity'); return }

    if (side === 'buy') {
      if (totalCost > state.balance) { toast.error('Insufficient paper balance'); return }
      const newState = { ...state }
      newState.balance -= totalCost
      const existing = newState.positions.find(p => p.symbol === symbol)
      if (existing) {
        const newQty = existing.qty + amount
        existing.avgCost = (existing.avgCost * existing.qty + totalCost) / newQty
        existing.qty = newQty
        existing.currentPrice = currentPrice
      } else {
        newState.positions = [...newState.positions, { symbol, name: prices[symbol].name, qty: amount, avgCost: currentPrice, currentPrice }]
      }
      newState.trades = [{ id: Date.now().toString(), symbol, side, qty: amount, price: currentPrice, total: totalCost, ts: Date.now() }, ...newState.trades.slice(0, 49)]
      setState(newState)
      saveState(newState)
      toast.success(`Paper bought ${amount} ${symbol} @ $${currentPrice.toLocaleString()}`)
    } else {
      const existing = state.positions.find(p => p.symbol === symbol)
      if (!existing || existing.qty < amount) { toast.error(`Insufficient ${symbol} position`); return }
      const proceeds = amount * currentPrice
      const newState = { ...state }
      newState.balance += proceeds
      if (existing.qty - amount < 0.0001) {
        newState.positions = newState.positions.filter(p => p.symbol !== symbol)
      } else {
        newState.positions = newState.positions.map(p => p.symbol === symbol ? { ...p, qty: p.qty - amount, currentPrice } : p)
      }
      newState.trades = [{ id: Date.now().toString(), symbol, side, qty: amount, price: currentPrice, total: proceeds, ts: Date.now() }, ...newState.trades.slice(0, 49)]
      setState(newState)
      saveState(newState)
      toast.success(`Paper sold ${amount} ${symbol} @ $${currentPrice.toLocaleString()}`)
    }
    setQty('')
  }

  const reset = () => {
    const fresh: PaperState = { balance: INITIAL_BALANCE, positions: [], trades: [] }
    setState(fresh)
    saveState(fresh)
    toast.success('Portfolio reset to $100,000')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-[#0C8B44]" />
              </div>
              <div>
                <h1 className="text-2xl font-light text-[#E5E5E5]">Paper Trading</h1>
                <p className="text-xs text-[#737373]">Practice with $100,000 virtual cash — zero risk.</p>
              </div>
            </div>
            <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#ffffff10] text-xs text-[#737373] hover:text-[#E5E5E5] hover:border-[#ffffff20] transition-colors">
              <RotateCcw className="w-3 h-3" />Reset
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Equity', value: `$${totalEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
              { label: 'Cash Available', value: `$${state.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
              { label: 'Portfolio Value', value: `$${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
              { label: 'Total P&L', value: `${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`, color: pnl >= 0 ? '#0C8B44' : '#ef4444' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
                <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{s.label}</p>
                <p className="text-lg font-light" style={{ color: s.color ?? '#E5E5E5' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Order Form */}
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Place Order</h2>
              <div className="flex gap-2 mb-4">
                {(['buy', 'sell'] as const).map(s => (
                  <button key={s} onClick={() => setSide(s)} className={`flex-1 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors ${side === s ? (s === 'buy' ? 'bg-[#0C8B44] text-white' : 'bg-red-600 text-white') : 'bg-[#0a0f11] text-[#737373] hover:text-[#E5E5E5]'}`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Asset</label>
                  <select aria-label="Asset" value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    {Object.entries(prices).map(([sym, d]) => (
                      <option key={sym} value={sym}>{sym} — {d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Market Price</label>
                  <div className="px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    ${currentPrice.toLocaleString()}
                    <span className={`ml-2 text-xs ${prices[symbol]?.change >= 0 ? 'text-[#0C8B44]' : 'text-red-400'}`}>
                      {prices[symbol]?.change >= 0 ? '+' : ''}{prices[symbol]?.change}%
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Quantity ({symbol})</label>
                  <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                {qty && parseFloat(qty) > 0 && (
                  <div className="text-xs text-[#737373] bg-[#0a0f11] rounded-lg px-3 py-2">
                    Total: <span className="text-[#E5E5E5]">${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <button onClick={execute} className={`w-full py-2.5 text-white text-xs font-medium uppercase tracking-[0.05em] rounded-lg transition-colors ${side === 'buy' ? 'bg-[#0C8B44] hover:bg-[#0a7539]' : 'bg-red-600 hover:bg-red-700'}`}>
                  {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
                </button>
              </div>
            </div>

            {/* Positions */}
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Open Positions</h2>
              {state.positions.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-8 h-8 text-[#737373] mx-auto mb-2" />
                  <p className="text-xs text-[#737373]">No positions yet. Place a buy order to start.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {state.positions.map(pos => {
                    const price = prices[pos.symbol]?.price ?? pos.currentPrice
                    const value = pos.qty * price
                    const gain = value - pos.qty * pos.avgCost
                    const gainPct = (gain / (pos.qty * pos.avgCost)) * 100
                    return (
                      <div key={pos.symbol} className="rounded-xl bg-[#0a0f11] border border-[#ffffff08] p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-[#E5E5E5]">{pos.symbol}</span>
                          <span className={`text-xs ${gain >= 0 ? 'text-[#0C8B44]' : 'text-red-400'}`}>
                            {gain >= 0 ? '+' : ''}${gain.toFixed(2)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-[#737373]">
                          <span>{pos.qty.toFixed(6)} @ avg ${pos.avgCost.toLocaleString()}</span>
                          <span>${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Trade History */}
            <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <h2 className="text-sm font-medium text-[#E5E5E5] mb-4">Trade History</h2>
              {state.trades.length === 0 ? (
                <p className="text-xs text-[#737373] text-center py-8">No trades yet.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {state.trades.map(t => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-[#0a0f11] px-3 py-2">
                      <div className="flex items-center gap-2">
                        {t.side === 'buy' ? <TrendingUp className="w-3 h-3 text-[#0C8B44]" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                        <div>
                          <p className="text-xs text-[#E5E5E5]">{t.side.toUpperCase()} {t.qty} {t.symbol}</p>
                          <p className="text-[10px] text-[#737373]">${t.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs ${t.side === 'buy' ? 'text-red-400' : 'text-[#0C8B44]'}`}>
                          {t.side === 'buy' ? '-' : '+'}${t.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-[#737373]">{new Date(t.ts).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
