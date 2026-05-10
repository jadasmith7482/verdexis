import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Wallet2, Plus, Trash2, ArrowRightLeft } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import { toast } from 'sonner'

interface SubAccount {
  id: string
  name: string
  category: string
  balance: number
  color: string
  holdings: { symbol: string; value: number }[]
}

const INITIAL: SubAccount[] = [
  { id: '1', name: 'Core Holdings', category: 'Long-term', balance: 42_800, color: '#0C8B44', holdings: [{ symbol: 'BTC', value: 28000 }, { symbol: 'ETH', value: 14800 }] },
  { id: '2', name: 'Trading Account', category: 'Active Trading', balance: 12_500, color: '#38bdf8', holdings: [{ symbol: 'SOL', value: 6200 }, { symbol: 'BNB', value: 4100 }, { symbol: 'AVAX', value: 2200 }] },
  { id: '3', name: 'DeFi Vault', category: 'DeFi / Yield', balance: 8_200, color: '#a78bfa', holdings: [{ symbol: 'USDC', value: 5000 }, { symbol: 'ETH', value: 3200 }] },
  { id: '4', name: 'Cash Reserve', category: 'Savings', balance: 6_500, color: '#94a3b8', holdings: [{ symbol: 'USD', value: 6500 }] },
]

const CATEGORIES = ['Long-term', 'Active Trading', 'DeFi / Yield', 'Savings', 'Speculative', 'Retirement', 'Other']
const COLORS = ['#0C8B44', '#38bdf8', '#a78bfa', '#f59e0b', '#ef4444', '#94a3b8', '#fb923c']

export default function SubAccounts() { return <RequireAuth><SubAccountsInner /></RequireAuth> }

function SubAccountsInner() {
  const [accounts, setAccounts] = useState<SubAccount[]>(INITIAL)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newColor, setNewColor] = useState(COLORS[0])
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferModal, setTransferModal] = useState(false)

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  const createAccount = () => {
    if (!newName.trim()) { toast.error('Enter a name'); return }
    const acc: SubAccount = { id: Date.now().toString(), name: newName.trim(), category: newCategory, balance: 0, color: newColor, holdings: [] }
    setAccounts(prev => [...prev, acc])
    setNewName(''); setCreating(false)
    toast.success(`Account "${acc.name}" created`)
  }

  const remove = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id))
    toast.success('Account removed')
  }

  const doTransfer = () => {
    const amt = parseFloat(transferAmount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (transferFrom === transferTo) { toast.error('Choose different accounts'); return }
    const from = accounts.find(a => a.id === transferFrom)
    if (!from || from.balance < amt) { toast.error('Insufficient balance'); return }
    setAccounts(prev => prev.map(a => {
      if (a.id === transferFrom) return { ...a, balance: a.balance - amt }
      if (a.id === transferTo) return { ...a, balance: a.balance + amt }
      return a
    }))
    toast.success(`Transferred $${amt.toLocaleString()} between accounts`)
    setTransferModal(false); setTransferAmount('')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#E5E5E5] mb-6 transition-colors">
            <ArrowLeft className="w-3 h-3" />Back to dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                <Wallet2 className="w-5 h-5 text-[#0C8B44]" />
              </div>
              <div>
                <h1 className="text-2xl font-light text-[#E5E5E5]">Sub-Accounts</h1>
                <p className="text-xs text-[#737373]">Separate your portfolio into distinct buckets.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setTransferFrom(accounts[0]?.id ?? ''); setTransferTo(accounts[1]?.id ?? ''); setTransferModal(true) }} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#ffffff10] text-xs text-[#737373] hover:text-[#E5E5E5] transition-colors">
                <ArrowRightLeft className="w-3 h-3" />Transfer
              </button>
              <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0C8B44] text-white text-xs hover:bg-[#0a7539] transition-colors">
                <Plus className="w-3 h-3" />New Account
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#737373]">Total across all accounts</p>
              <p className="text-2xl font-light text-[#E5E5E5]">${totalBalance.toLocaleString()}</p>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {accounts.map(a => (
                <div key={a.id} className="h-full rounded-sm transition-all" title={a.name} style={{ background: a.color, width: `${(a.balance / totalBalance) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 text-[10px] text-[#737373]">
                  <div className="w-2 h-2 rounded-full" style={{ background: a.color }} />
                  {a.name}: {((a.balance / totalBalance) * 100).toFixed(1)}%
                </div>
              ))}
            </div>
          </div>

          {/* Account cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {accounts.map(a => (
              <div key={a.id} className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-5 hover:border-[#ffffff15] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${a.color}20` }}>
                      <Wallet2 className="w-4 h-4" style={{ color: a.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E5E5E5]">{a.name}</p>
                      <p className="text-[10px] text-[#737373]">{a.category}</p>
                    </div>
                  </div>
                  <button onClick={() => remove(a.id)} className="p-1 rounded hover:bg-red-500/10 text-[#737373] hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xl font-light text-[#E5E5E5] mb-3">${a.balance.toLocaleString()}</p>
                <div className="space-y-1.5">
                  {a.holdings.map(h => (
                    <div key={h.symbol} className="flex justify-between text-xs">
                      <span className="text-[#737373]">{h.symbol}</span>
                      <span className="text-[#E5E5E5]">${h.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="flex h-1 rounded-full overflow-hidden gap-0.5">
                    {a.holdings.map(h => (
                      <div key={h.symbol} className="h-full rounded-sm" style={{ background: a.color, width: `${(h.value / a.balance) * 100}%`, opacity: 0.4 + (a.holdings.indexOf(h) * 0.2) }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Create card */}
            {creating && (
              <div className="rounded-2xl bg-[#0f1619]/50 border border-[#0C8B44]/30 p-5">
                <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">New Account</h3>
                <div className="space-y-3">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Account name" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                  <select aria-label="Category" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <div className="flex gap-2">
                    {COLORS.map(c => <button key={c} onClick={() => setNewColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: c }} />)}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCreating(false)} className="flex-1 py-2 border border-[#ffffff10] text-xs text-[#737373] rounded-lg hover:text-[#E5E5E5] transition-colors">Cancel</button>
                    <button onClick={createAccount} className="flex-1 py-2 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">Create</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transfer modal */}
        {transferModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setTransferModal(false)}>
            <div className="rounded-2xl bg-[#0f1619] border border-[#ffffff10] p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-medium text-[#E5E5E5] mb-4">Internal Transfer</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">From</label>
                  <select aria-label="From account" value={transferFrom} onChange={e => setTransferFrom(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (${a.balance.toLocaleString()})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">To</label>
                  <select aria-label="To account" value={transferTo} onChange={e => setTransferTo(e.target.value)} className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1">Amount (USD)</label>
                  <input type="number" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5]" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setTransferModal(false)} className="flex-1 py-2.5 border border-[#ffffff10] text-xs text-[#737373] rounded-lg hover:text-[#E5E5E5] transition-colors">Cancel</button>
                  <button onClick={doTransfer} className="flex-1 py-2.5 bg-[#0C8B44] text-white text-xs rounded-lg hover:bg-[#0a7539] transition-colors">Transfer</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
