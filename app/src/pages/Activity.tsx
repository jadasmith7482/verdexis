import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { portfolioStore, type WalletTransaction, type Trade } from '../lib/portfolioStore'
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, TrendingUp, Search, Filter, X, Copy, ExternalLink, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'

// Unified row type so wallet transactions and trades can share the same list.
type ActivityRow =
  | { kind: 'tx'; id: string; ts: Date; data: WalletTransaction }
  | { kind: 'trade'; id: string; ts: Date; data: Trade }

type Filter = 'all' | 'deposit' | 'withdraw' | 'transfer' | 'trade' | 'dividend' | 'interest'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdraw', label: 'Withdrawals' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'trade', label: 'Trades' },
  { value: 'dividend', label: 'Dividends' },
  { value: 'interest', label: 'Interest' },
]

function fmtAmount(n: number, currency: string): string {
  const isFiat = currency === 'USD' || currency === 'USDC' || currency === 'USDT'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: isFiat ? 2 : 0,
    maximumFractionDigits: isFiat ? 2 : 8,
  })
}

function rowIcon(row: ActivityRow) {
  if (row.kind === 'trade') return TrendingUp
  switch (row.data.type) {
    case 'deposit': return ArrowDownToLine
    case 'withdraw': return ArrowUpFromLine
    case 'transfer': return ArrowLeftRight
    case 'dividend':
    case 'interest': return TrendingUp
    default: return ArrowLeftRight
  }
}

function rowColor(row: ActivityRow): string {
  if (row.kind === 'trade') return row.data.side === 'buy' ? '#4CAF50' : '#FF9800'
  if (row.data.type === 'deposit' || row.data.type === 'dividend' || row.data.type === 'interest') return '#4CAF50'
  if (row.data.type === 'withdraw') return '#f44336'
  return '#FF9800'
}

function rowTitle(row: ActivityRow): string {
  if (row.kind === 'trade') {
    const side = row.data.side === 'buy' ? 'Bought' : 'Sold'
    return `${side} ${row.data.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${row.data.symbol}`
  }
  return row.data.description
}

function rowSubtitle(row: ActivityRow): string {
  if (row.kind === 'trade') return `${row.data.type === 'market' ? 'Market' : 'Limit'} order @ $${row.data.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return row.data.type[0].toUpperCase() + row.data.type.slice(1)
}

export default function Activity() {
  const [params, setParams] = useSearchParams()
  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => portfolioStore.getTransactions())
  const [trades, setTrades] = useState<Trade[]>(() => portfolioStore.getTrades())
  const [filter, setFilter] = useState<Filter>((params.get('filter') as Filter) || 'all')
  const [query, setQuery] = useState('')

  const selectedId = params.get('tx') ?? params.get('id')

  // Re-read from the store on every portfolio change so balances/transactions
  // reflect any deposit, withdrawal, or trade made elsewhere in the app.
  useEffect(() => {
    const refresh = () => {
      setTransactions(portfolioStore.getTransactions())
      setTrades(portfolioStore.getTrades())
    }
    window.addEventListener('verdexis:portfolio', refresh)
    // Also fast-poll so newly imported server data shows up.
    const t = setInterval(refresh, 4_000)
    return () => {
      window.removeEventListener('verdexis:portfolio', refresh)
      clearInterval(t)
    }
  }, [])

  const rows: ActivityRow[] = useMemo(() => {
    const txRows = transactions.map<ActivityRow>((t) => ({ kind: 'tx', id: t.id, ts: new Date(t.timestamp), data: t }))
    const tradeRows = trades.map<ActivityRow>((t) => ({ kind: 'trade', id: t.id, ts: new Date(t.timestamp), data: t }))
    const merged = [...txRows, ...tradeRows].sort((a, b) => b.ts.getTime() - a.ts.getTime())
    const q = query.trim().toLowerCase()
    return merged.filter((r) => {
      if (filter !== 'all') {
        if (filter === 'trade' && r.kind !== 'trade') return false
        if (filter !== 'trade' && (r.kind !== 'tx' || r.data.type !== filter)) return false
      }
      if (!q) return true
      const hay = r.kind === 'tx'
        ? `${r.data.description} ${r.data.type} ${r.data.currency}`
        : `${r.data.symbol} ${r.data.side} ${r.data.type}`
      return hay.toLowerCase().includes(q)
    })
  }, [transactions, trades, filter, query])

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])

  function openDetail(id: string) {
    const next = new URLSearchParams(params)
    next.set('tx', id)
    setParams(next, { replace: false })
  }

  function closeDetail() {
    const next = new URLSearchParams(params)
    next.delete('tx')
    next.delete('id')
    setParams(next, { replace: true })
  }

  function changeFilter(f: Filter) {
    setFilter(f)
    const next = new URLSearchParams(params)
    if (f === 'all') next.delete('filter'); else next.set('filter', f)
    setParams(next, { replace: true })
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Could not copy'),
    )
  }

  // Lifetime totals shown at the top of the page.
  const totals = useMemo(() => {
    let deposited = 0, withdrawn = 0, trades = 0
    for (const tx of transactions) {
      if (tx.currency !== 'USD') continue // only USD lifetime totals are meaningful without per-tx FX
      if (tx.status !== 'completed') continue
      if (tx.type === 'deposit') deposited += tx.amount
      else if (tx.type === 'withdraw') withdrawn += Math.abs(tx.amount)
    }
    trades = portfolioStore.getTrades().length
    return { deposited, withdrawn, trades }
  }, [transactions])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[#A0A0A0] hover:text-[#E5E5E5]">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#E5E5E5]">Activity</h1>
          <p className="text-sm text-[#737373] mt-1">Every deposit, withdrawal, transfer and trade on your account.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Stat label="Total deposited (USD)" value={`$${totals.deposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="#4CAF50" />
          <Stat label="Total withdrawn (USD)" value={`$${totals.withdrawn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="#f44336" />
          <Stat label="Trades placed" value={totals.trades.toLocaleString()} color="#FF9800" />
        </div>

        {/* Filters + search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => changeFilter(f.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  filter === f.value
                    ? 'bg-[#0C8B44] border-[#0C8B44] text-white'
                    : 'bg-[#0f1619]/50 border-[#ffffff10] text-[#A0A0A0] hover:border-[#0C8B44]/40'
                }`}
              >
                <Filter className="w-3 h-3" /> {f.label}
              </button>
            ))}
          </div>
          <div className="sm:ml-auto relative">
            <Search className="w-3.5 h-3.5 text-[#737373] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description, currency, symbol…"
              className="pl-8 pr-3 py-1.5 bg-[#0f1619]/50 border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44] w-full sm:w-72"
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-12 text-center">
            <p className="text-sm text-[#A0A0A0]">No activity yet.</p>
            <p className="text-xs text-[#737373] mt-1">Deposits, withdrawals and trades will appear here.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] divide-y divide-[#ffffff05]">
            {rows.map((r) => {
              const Icon = rowIcon(r)
              const color = rowColor(r)
              const amount = r.kind === 'tx' ? r.data.amount : (r.data.side === 'buy' ? -r.data.total : r.data.total)
              const currency = r.kind === 'tx' ? r.data.currency : 'USD'
              const status = r.kind === 'tx' ? r.data.status : 'completed'
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => openDetail(r.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-[#ffffff04] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}15`, color }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#E5E5E5] truncate">{rowTitle(r)}</p>
                      <p className="text-[11px] text-[#737373] flex items-center gap-1.5">
                        <span>{rowSubtitle(r)}</span>
                        <span>·</span>
                        <span>{r.ts.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        {status !== 'completed' && (
                          <span className="inline-flex items-center gap-1 text-[#FF9800]"><Clock className="w-3 h-3" /> Pending</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm tabular-nums ${amount >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
                      {amount >= 0 ? '+' : ''}{fmtAmount(amount, currency)} {currency}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {selected && <DetailDrawer row={selected} onClose={closeDetail} onCopy={copy} />}
      <Footer />
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-[#0f1619]/50 border border-[#ffffff08] p-4">
      <div className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">{label}</div>
      <div className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</div>
    </div>
  )
}

function DetailDrawer({ row, onClose, onCopy }: { row: ActivityRow; onClose: () => void; onCopy: (s: string) => void }) {
  const Icon = rowIcon(row)
  const color = rowColor(row)
  const isTx = row.kind === 'tx'
  const amount = isTx ? row.data.amount : (row.data.side === 'buy' ? -row.data.total : row.data.total)
  const currency = isTx ? row.data.currency : 'USD'
  const status = isTx ? row.data.status : 'completed'

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full sm:max-w-lg bg-[#0a0f11] border border-[#ffffff10] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ffffff08]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}15`, color }}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-medium text-[#E5E5E5] truncate">{rowTitle(row)}</h2>
              <p className="text-[11px] text-[#737373]">{rowSubtitle(row)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#A0A0A0] hover:bg-[#ffffff05]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="text-center mb-6">
            <div className={`text-3xl font-semibold tabular-nums ${amount >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
              {amount >= 0 ? '+' : ''}{fmtAmount(amount, currency)} {currency}
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.05em] px-2 py-0.5 rounded-full"
              style={{ color: status === 'completed' ? '#4CAF50' : '#FF9800', background: status === 'completed' ? '#4CAF5015' : '#FF980015' }}>
              {status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {status}
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <Detail label="Type" value={row.kind === 'trade' ? `Trade · ${row.data.side.toUpperCase()}` : row.data.type} />
            {row.kind === 'trade' && (
              <>
                <Detail label="Symbol" value={row.data.symbol} />
                <Detail label="Quantity" value={`${row.data.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${row.data.symbol}`} />
                <Detail label="Fill price" value={`$${row.data.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                <Detail label="Order total" value={`$${row.data.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                <Detail label="Order type" value={row.data.type} />
              </>
            )}
            {isTx && (
              <>
                <Detail label="Currency" value={row.data.currency} />
                <Detail label="Description" value={row.data.description} multiline />
              </>
            )}
            <Detail label="Date" value={row.ts.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' })} />
            <Detail
              label="Reference ID"
              value={row.id}
              mono
              action={(
                <button onClick={() => onCopy(row.id)} className="inline-flex items-center gap-1 text-[11px] text-[#0C8B44] hover:text-[#00E676]">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              )}
            />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            {row.kind === 'trade' && (
              <Link
                to={`/asset/${row.data.symbol.toLowerCase()}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f1619] border border-[#ffffff10] text-xs text-[#E5E5E5] hover:border-[#0C8B44]/40"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View {row.data.symbol}
              </Link>
            )}
            <Link
              to="/wallet"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0C8B44] text-xs text-white hover:bg-[#0a7539]"
            >
              Open wallet
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, mono, multiline, action }: { label: string; value: string; mono?: boolean; multiline?: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.05em] text-[#737373] shrink-0 pt-0.5">{label}</span>
      <div className={`text-right text-[#E5E5E5] ${mono ? 'font-mono text-xs break-all' : 'text-sm'} ${multiline ? '' : 'truncate max-w-[60%]'}`}>
        <span>{value}</span>
        {action && <div className="mt-1 flex justify-end">{action}</div>}
      </div>
    </div>
  )
}
