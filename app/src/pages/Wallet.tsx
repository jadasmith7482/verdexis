import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { portfolioStore } from '../lib/portfolioStore'
import { Toaster, toast } from 'sonner'
import {
  ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  Clock, CheckCircle, AlertCircle, Copy,
  Eye, EyeOff, Banknote, QrCode,
} from 'lucide-react'

type TabType = 'overview' | 'deposit' | 'withdraw' | 'transfer'

export default function WalletPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('action') as TabType | null) ?? 'overview'
  const validTabs: TabType[] = ['overview', 'deposit', 'withdraw', 'transfer']
  const [showBalance, setShowBalance] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>(
    validTabs.includes(initialTab) ? initialTab : 'overview'
  )

  // Keep URL in sync with the active tab
  useEffect(() => {
    const current = searchParams.get('action')
    if (activeTab === 'overview' && current) {
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      setSearchParams(next, { replace: true })
    } else if (activeTab !== 'overview' && current !== activeTab) {
      const next = new URLSearchParams(searchParams)
      next.set('action', activeTab)
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [wallet, setWallet] = useState(() => portfolioStore.getWallet())
  const [transactions, setTransactions] = useState(() => portfolioStore.getTransactions())

  useEffect(() => {
    const refresh = () => {
      setWallet(portfolioStore.getWallet())
      setTransactions(portfolioStore.getTransactions())
    }
    window.addEventListener('verdexis:portfolio', refresh)
    return () => window.removeEventListener('verdexis:portfolio', refresh)
  }, [])

  const totalBalance = wallet.reduce((sum, w) => sum + (w.currency === 'USD' ? w.balance : w.balance * getUsdRate(w.currency)), 0)

  function getUsdRate(currency: string): number {
    const rates: Record<string, number> = { USD: 1, BTC: 67432, ETH: 3521, SOL: 178.45, ADA: 0.52 }
    return rates[currency] || 1
  }

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const amt = parseFloat(amount)
    portfolioStore.addTransaction('deposit', amt, selectedCurrency, selectedCurrency === 'USD' ? 'Bank Transfer (ACH)' : `Crypto Deposit (${selectedCurrency})`)
    toast.success(`Deposited ${amt.toLocaleString()} ${selectedCurrency}`, { description: 'Funds will be available shortly' })
    setAmount('')
    setTransactions(portfolioStore.getTransactions())
  }

  const handleWithdraw = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const amt = -parseFloat(amount)
    portfolioStore.addTransaction('withdraw', amt, selectedCurrency, selectedCurrency === 'USD' ? 'Bank Transfer (ACH)' : `Crypto Withdrawal (${selectedCurrency})`)
    toast.success(`Withdrew ${Math.abs(amt).toLocaleString()} ${selectedCurrency}`, { description: 'Transaction completed' })
    setAmount('')
    setTransactions(portfolioStore.getTransactions())
  }

  const handleTransfer = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const amt = -parseFloat(amount)
    portfolioStore.addTransaction('transfer', amt, 'USD', `Transfer to ${selectedCurrency}`)
    const receiveAmt = Math.abs(amt) / getUsdRate(selectedCurrency)
    portfolioStore.addTransaction('deposit', receiveAmt, selectedCurrency, `Received from USD exchange`)
    toast.success(`Transferred ${Math.abs(amt).toLocaleString()} USD to ${receiveAmt.toFixed(6)} ${selectedCurrency}`)
    setAmount('')
    setTransactions(portfolioStore.getTransactions())
  }

  const getStatusIcon = (status: string) => {
    return status === 'completed' ? <CheckCircle className="w-4 h-4 text-[#4CAF50]" /> : <Clock className="w-4 h-4 text-[#F57C00]" />
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownRight className="w-5 h-5 text-[#4CAF50]" />
      case 'withdraw': return <ArrowUpRight className="w-5 h-5 text-[#f44336]" />
      case 'transfer': return <ArrowLeftRight className="w-5 h-5 text-[#2196F3]" />
      default: return <ArrowLeftRight className="w-5 h-5 text-[#A0A0A0]" />
    }
  }

  const txIconBg = (type: string) => {
    switch (type) {
      case 'deposit': return 'bg-[#4CAF50]/10'
      case 'withdraw': return 'bg-[#f44336]/10'
      case 'transfer': return 'bg-[#2196F3]/10'
      default: return 'bg-[#1a1a1a]/50'
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Wallet</h1>
              <p className="text-sm text-[#737373] mt-1">Manage your assets</p>
            </div>
            <button onClick={() => setShowBalance(!showBalance)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff08] text-sm text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors">
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showBalance ? 'Hide' : 'Show'} Balance
            </button>
          </div>

          {/* Main Balance */}
          <div className="liquid-card p-8 mb-6" style={{ '--fill-color': 'rgba(12,139,68,0.15)' } as React.CSSProperties}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-sm text-[#A0A0A0] mb-2">Total Balance</p>
                <p className="text-5xl md:text-6xl font-light tracking-[-0.03em] text-[#E5E5E5]">
                  {showBalance ? `$${totalBalance.toLocaleString()}` : '****'}
                </p>
                <p className="text-sm text-[#4CAF50] mt-2 flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4" /> +5.2% this month
                </p>
              </div>
              <div className="flex items-center gap-3">
                {[{ label: 'Deposit', icon: ArrowDownRight, tab: 'deposit' as TabType, color: '#0C8B44' }, { label: 'Withdraw', icon: ArrowUpRight, tab: 'withdraw' as TabType, color: '#f44336' }, { label: 'Transfer', icon: ArrowLeftRight, tab: 'transfer' as TabType, color: '#2196F3' }].map((action) => (
                  <button key={action.label} onClick={() => setActiveTab(action.tab)} className="flex flex-col items-center gap-2 group">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${action.color}15`, border: `1px solid ${action.color}30` }}>
                      <action.icon className="w-6 h-6" style={{ color: action.color }} />
                    </div>
                    <span className="text-xs text-[#A0A0A0]">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sub-balances */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {wallet.map((w) => (
              <div key={w.currency} className="glass-card p-4 hover:border-[#0C8B44]/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{w.currency[0]}</div>
                    <span className="text-sm font-medium text-[#E5E5E5]">{w.currency}</span>
                  </div>
                  {w.currency !== 'USD' && <span className="text-xs text-[#737373]">${(w.balance * getUsdRate(w.currency)).toLocaleString()}</span>}
                </div>
                <p className="text-2xl font-light text-[#E5E5E5]">{showBalance ? <>{w.symbol}{w.balance.toLocaleString()}</> : '****'}</p>
                <p className="text-xs text-[#737373] mt-1">Available: {w.symbol}{w.available.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[#1a1a1a] rounded-xl mb-6 w-fit">
            {([{ key: 'overview', label: 'Overview' }, { key: 'deposit', label: 'Deposit' }, { key: 'withdraw', label: 'Withdraw' }, { key: 'transfer', label: 'Transfer' }] as const).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-[#0C8B44] text-white' : 'text-[#737373] hover:text-[#E5E5E5]'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-[#ffffff08]">
                <h3 className="text-lg font-medium text-[#E5E5E5]">Transaction History</h3>
              </div>
              <div className="divide-y divide-[#ffffff05]">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-[#ffffff02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${txIconBg(tx.type)}`}>
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#E5E5E5]">{tx.description}</p>
                        <p className="text-xs text-[#737373]">{formatTimeAgo(tx.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${tx.amount >= 0 ? 'text-[#4CAF50]' : 'text-[#E5E5E5]'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} {tx.currency}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {getStatusIcon(tx.status)}
                        <span className="text-xs text-[#737373] capitalize">{tx.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'deposit' && (
            <div className="glass-card p-8 max-w-lg">
              <h3 className="text-xl font-medium text-[#E5E5E5] mb-6">Deposit Funds</h3>
              <div className="mb-6">
                <label className="text-sm text-[#A0A0A0] mb-2 block">Select Currency</label>
                <div className="grid grid-cols-2 gap-3">
                  {wallet.map((w) => (
                    <button key={w.currency} onClick={() => setSelectedCurrency(w.currency)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCurrency === w.currency ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50'}`}>
                      <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{w.currency[0]}</div>
                      <span className="text-sm text-[#E5E5E5]">{w.currency}</span>
                    </button>
                  ))}
                </div>
              </div>
              {selectedCurrency === 'USD' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]">$</span>
                      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                        className="w-full pl-8 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08]">
                    <p className="text-xs text-[#737373] mb-2">Bank Transfer (ACH)</p>
                    <div className="flex items-center gap-3">
                      <Banknote className="w-8 h-8 text-[#0C8B44]" />
                      <div><p className="text-sm text-[#E5E5E5]">**** **** **** 4532</p><p className="text-xs text-[#737373]">Chase Bank - Checking</p></div>
                    </div>
                  </div>
                  <button onClick={handleDeposit} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors">
                    Deposit USD
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Amount</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                  </div>
                  <div className="p-6 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] text-center">
                    <QrCode className="w-32 h-32 mx-auto mb-4 text-[#E5E5E5]" />
                    <p className="text-sm text-[#A0A0A0] mb-2">Your {selectedCurrency} Address</p>
                    <div className="flex items-center gap-2 justify-center">
                      <code className="text-xs text-[#E5E5E5] bg-[#070C0E] px-3 py-1.5 rounded-lg">0x71C...9A3F</code>
                      <button className="p-1.5 rounded-lg text-[#737373] hover:text-[#0C8B44] transition-colors"><Copy className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F57C00]/10 border border-[#F57C00]/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#F57C00] shrink-0 mt-0.5" />
                      <div><p className="text-sm font-medium text-[#F57C00]">Important</p><p className="text-xs text-[#A0A0A0] mt-1">Only send {selectedCurrency} to this address. Other assets may be lost.</p></div>
                    </div>
                  </div>
                  <button onClick={handleDeposit} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors">
                    Confirm Deposit
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div className="glass-card p-8 max-w-lg">
              <h3 className="text-xl font-medium text-[#E5E5E5] mb-6">Withdraw Funds</h3>
              <div className="mb-6">
                <label className="text-sm text-[#A0A0A0] mb-2 block">Select Currency</label>
                <div className="grid grid-cols-2 gap-3">
                  {wallet.map((w) => (
                    <button key={w.currency} onClick={() => setSelectedCurrency(w.currency)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCurrency === w.currency ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50'}`}>
                      <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{w.currency[0]}</div>
                      <div><span className="text-sm text-[#E5E5E5]">{w.currency}</span><p className="text-xs text-[#737373]">Avail: {w.symbol}{w.available.toLocaleString()}</p></div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">Amount</label>
                  <div className="relative">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                  </div>
                </div>
                {selectedCurrency !== 'USD' && (
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Withdrawal Address</label>
                    <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Enter wallet address"
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                  </div>
                )}
                {selectedCurrency === 'USD' && (
                  <div className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08]">
                    <p className="text-xs text-[#737373] mb-2">Destination Account</p>
                    <div className="flex items-center gap-3">
                      <Banknote className="w-8 h-8 text-[#0C8B44]" />
                      <div><p className="text-sm text-[#E5E5E5]">**** **** **** 4532</p><p className="text-xs text-[#737373]">Chase Bank - Checking</p></div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between py-3 border-t border-[#ffffff08]">
                  <span className="text-sm text-[#A0A0A0]">Network Fee</span>
                  <span className="text-sm text-[#E5E5E5]">{selectedCurrency === 'USD' ? '$0.00' : `0.001 ${selectedCurrency}`}</span>
                </div>
                <button onClick={handleWithdraw} className="w-full py-3.5 bg-[#f44336] text-white text-sm font-medium rounded-xl hover:bg-[#d32f2f] transition-colors">
                  Withdraw {selectedCurrency}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="glass-card p-8 max-w-lg">
              <h3 className="text-xl font-medium text-[#E5E5E5] mb-6">Transfer Funds</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">From</label>
                  <div className="p-4 rounded-xl bg-[#0C8B44]/10 border border-[#0C8B44]/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-sm font-bold text-[#0C8B44]">$</div>
                        <div><p className="text-sm font-medium text-[#E5E5E5]">USD Wallet</p><p className="text-xs text-[#737373]">Available: $125,430.50</p></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                    <ArrowLeftRight className="w-5 h-5 text-[#0C8B44]" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">To</label>
                  <div className="grid grid-cols-3 gap-3">
                    {wallet.filter((w) => w.currency !== 'USD').map((w) => (
                      <button key={w.currency} onClick={() => setSelectedCurrency(w.currency)}
                        className={`p-3 rounded-xl border transition-all ${selectedCurrency === w.currency ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50'}`}>
                        <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44] mx-auto mb-2">{w.currency[0]}</div>
                        <p className="text-xs text-[#E5E5E5]">{w.currency}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]">$</span>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-[#ffffff08]">
                  <span className="text-sm text-[#A0A0A0]">Exchange Rate</span>
                  <span className="text-sm text-[#E5E5E5]">1 USD = {(1 / getUsdRate(selectedCurrency)).toFixed(8)} {selectedCurrency}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-[#ffffff08]">
                  <span className="text-sm text-[#A0A0A0]">You will receive</span>
                  <span className="text-sm font-medium text-[#E5E5E5]">{amount ? (parseFloat(amount) / getUsdRate(selectedCurrency)).toFixed(8) : '0.00'} {selectedCurrency}</span>
                </div>
                <button onClick={handleTransfer} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors">
                  Transfer Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
