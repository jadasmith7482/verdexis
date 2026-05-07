import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import LinkBankModal from '../components/LinkBankModal'
import WalletPickerModal from '../components/WalletPickerModal'
import QrCode from '../components/QrCode'
import { portfolioStore } from '../lib/portfolioStore'
import { listBanks, removeBank, onBanksChanged, type BankAccount } from '../lib/bankLink'
import { depositInstructions, onDepositInstructionsChanged, isAdmin } from '../lib/depositInstructions'
import type { Web3Payout } from '../lib/depositInstructions'
import { useWeb3 } from '../hooks/use-web3'
import { cryptoIconFor, assetIconFor } from '../lib/cryptoIcon'
import { api, getToken } from '../lib/api'
import { Toaster, toast } from 'sonner'
import {
  ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  Clock, CheckCircle, AlertCircle, Copy,
  Eye, EyeOff, Banknote, QrCode as QrCodeIcon, Download,
  Coins, Percent, Plus, Trash2, Wallet as WalletIcon,
  ExternalLink, Building2, Shield,
} from 'lucide-react'

type TabType = 'overview' | 'deposit' | 'withdraw' | 'transfer' | 'income'
type IncomeKind = 'dividend' | 'interest'
type UsdMethod = 'ach' | 'wire'

export default function WalletPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('action') as TabType | null) ?? 'overview'
  const validTabs: TabType[] = ['overview', 'deposit', 'withdraw', 'transfer', 'income']
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
  // Transfer-tab mode: convert USD to crypto in your own wallet, OR send funds
  // to another Verdexis user identified by email.
  const [transferMode, setTransferMode] = useState<'convert' | 'send'>('send')
  const [transferRecipient, setTransferRecipient] = useState('')
  const [transferRecipientName, setTransferRecipientName] = useState<string | null>(null)
  const [transferRecipientStatus, setTransferRecipientStatus] = useState<'idle' | 'checking' | 'ok' | 'notfound'>('idle')
  const [transferNote, setTransferNote] = useState('')
  const [transferCurrency, setTransferCurrency] = useState('USD')
  const [transferSending, setTransferSending] = useState(false)
  // Full-page success / error overlay shown after a transfer attempt.
  const [transferStatus, setTransferStatus] = useState<
    | { kind: 'success'; title: string; message: string }
    | { kind: 'error'; title: string; message: string }
    | null
  >(null)
  // Auto-dismiss the success overlay; errors stay until the user clicks.
  useEffect(() => {
    if (transferStatus?.kind !== 'success') return
    const t = setTimeout(() => setTransferStatus(null), 4500)
    return () => clearTimeout(t)
  }, [transferStatus])
  const [incomeKind, setIncomeKind] = useState<IncomeKind>('dividend')
  const [incomeSource, setIncomeSource] = useState('')
  const [wallet, setWallet] = useState(() => portfolioStore.getWallet())
  const [transactions, setTransactions] = useState(() => portfolioStore.getTransactions())
  const [banks, setBanks] = useState<BankAccount[]>(() => listBanks())
  const [selectedBankId, setSelectedBankId] = useState<string>(() => listBanks()[0]?.id ?? '')
  const [linkBankOpen, setLinkBankOpen] = useState(false)
  const [usdMethod, setUsdMethod] = useState<UsdMethod>('ach')
  const [adminMode, setAdminMode] = useState<boolean>(() => isAdmin())
  const [instructionsTick, setInstructionsTick] = useState(0)
  const wireInstructions = useMemo(
    () => depositInstructions.getWire(selectedCurrency),
    // re-read whenever admin saves new instructions OR currency changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCurrency, instructionsTick],
  )
  const cryptoInstructions = useMemo(
    () => depositInstructions.getCrypto(selectedCurrency),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCurrency, instructionsTick],
  )
  const web3 = useWeb3()
  const [web3TransferAmount, setWeb3TransferAmount] = useState('')
  const [web3Recipient, setWeb3Recipient] = useState('')
  // Admin-managed Web3 payout for the connected chain (or default).
  const [web3Payout, setWeb3Payout] = useState<Web3Payout | null>(null)
  // True while the recipient input is the admin payout (locked unless user overrides).
  const [web3RecipientOverridden, setWeb3RecipientOverridden] = useState(false)
  const [web3Sending, setWeb3Sending] = useState(false)
  const [web3LastTx, setWeb3LastTx] = useState<{ hash: string; amount: number; to: string } | null>(null)

  // Best-effort etherscan link for the connected chain.
  function explorerTxUrl(hash: string, chainId: string | null): string {
    const base: Record<string, string> = {
      '0x1': 'https://etherscan.io/tx/',
      '0xaa36a7': 'https://sepolia.etherscan.io/tx/',
      '0x5': 'https://goerli.etherscan.io/tx/',
      '0x89': 'https://polygonscan.com/tx/',
      '0xa4b1': 'https://arbiscan.io/tx/',
      '0xa': 'https://optimistic.etherscan.io/tx/',
      '0x2105': 'https://basescan.org/tx/',
      '0x38': 'https://bscscan.com/tx/',
      '0xa86a': 'https://snowtrace.io/tx/',
    }
    return (base[chainId?.toLowerCase() ?? ''] ?? 'https://etherscan.io/tx/') + hash
  }

  async function handleWeb3Transfer() {
    const amt = parseFloat(web3TransferAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setTransferStatus({ kind: 'error', title: 'Web3 transfer declined', message: 'Enter a valid ETH amount.' })
      return
    }
    if (web3.balanceEth != null && amt > web3.balanceEth) {
      setTransferStatus({ kind: 'error', title: 'Web3 transfer declined', message: `Insufficient balance (${web3.balanceEth.toFixed(4)} ETH available).` })
      return
    }
    const recipientRaw = web3Recipient.trim()
    const sendingToOther = recipientRaw.length > 0
    if (sendingToOther && !/^0x[a-fA-F0-9]{40}$/.test(recipientRaw)) {
      setTransferStatus({ kind: 'error', title: 'Web3 transfer declined', message: 'Invalid recipient address. Must be a 0x… EVM address.' })
      return
    }
    setWeb3Sending(true)
    try {
      const hash = await web3.sendTransaction({ valueEth: amt, ...(sendingToOther ? { to: recipientRaw } : {}) })
      const short = `${hash.slice(0, 10)}…${hash.slice(-6)}`
      const toLabel = sendingToOther ? `${recipientRaw.slice(0, 6)}…${recipientRaw.slice(-4)}` : 'dashboard'
      portfolioStore.addTransaction(
        sendingToOther ? 'transfer' : 'deposit',
        sendingToOther ? -amt : amt,
        'ETH',
        sendingToOther
          ? `On-chain ETH to ${toLabel} · tx ${short}`
          : `On-chain ETH from ${web3.shortAddress} · tx ${short}`,
      )
      setWeb3LastTx({ hash, amount: amt, to: sendingToOther ? recipientRaw : (web3.address ?? '') })
      setWeb3TransferAmount('')
      // Reset override so the admin payout (if any) is shown again next time.
      setWeb3RecipientOverridden(false)
      if (web3Payout) {
        setWeb3Recipient(web3Payout.address)
      } else {
        setWeb3Recipient('')
      }
      setTransferStatus({
        kind: 'success',
        title: sendingToOther ? 'Web3 transfer sent' : 'Credited to dashboard',
        message: sendingToOther
          ? `Sent ${amt} ETH to ${toLabel}. Tx ${short}.`
          : `Sent ${amt} ETH from your wallet — credited to your Verdexis dashboard. Tx ${short}.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transfer failed'
      setTransferStatus({ kind: 'error', title: 'Web3 transfer declined', message: msg })
    } finally {
      setWeb3Sending(false)
    }
  }

  useEffect(() => {
    const refresh = () => {
      setWallet([...portfolioStore.getWallet()])
      setTransactions([...portfolioStore.getTransactions()])
    }
    window.addEventListener('verdexis:portfolio', refresh)
    return () => window.removeEventListener('verdexis:portfolio', refresh)
  }, [])

  // Keep linked-bank list reactive (cross-tab + same-tab updates).
  useEffect(() => {
    return onBanksChanged(() => {
      const list = listBanks()
      setBanks(list)
      setSelectedBankId((cur) => (cur && list.some((b) => b.id === cur) ? cur : list[0]?.id ?? ''))
    })
  }, [])

  // React when admin updates wire / crypto deposit instructions in another tab.
  useEffect(() => {
    return onDepositInstructionsChanged(() => {
      setAdminMode(isAdmin())
      setInstructionsTick((n) => n + 1)
    })
  }, [])

  // Resolve the admin-managed Web3 payout for the connected chain. When found,
  // pre-fill the recipient input (locked) so the user is sending to the address
  // the admin configured. The user can still click "Use a different address"
  // to override.
  useEffect(() => {
    const payout = depositInstructions.getWeb3Payout(web3.chainId)
    setWeb3Payout(payout)
    if (payout && !web3RecipientOverridden) {
      setWeb3Recipient(payout.address)
    } else if (!payout && !web3RecipientOverridden) {
      setWeb3Recipient('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web3.chainId, instructionsTick])

  // Single source of truth shared with the Dashboard so the Wallet's
  // \"Total Balance\" hero matches the Dashboard's \"Cash\" subtitle exactly.
  // Recompute on each render \u2014 the wallet event listener already triggers them.
  void wallet
  const totalBalance = portfolioStore.getWalletValueUsd()

  function getUsdRate(currency: string): number {
    // Live quote first (cached by portfolioStore.markToMarket from CoinGecko
    // ticker). Fall back only if we have never seen a live price.
    const live = portfolioStore.getQuote(currency)
    if (live != null && live > 0) return live
    const baseline: Record<string, number> = { USD: 1, USDC: 1, USDT: 1, BTC: 67432, ETH: 3521, SOL: 178.45, ADA: 0.52, XRP: 0.55, DOGE: 0.12, MATIC: 0.62, DOT: 6.8, AVAX: 32, LINK: 14, LTC: 75, BCH: 380 }
    return baseline[currency.toUpperCase()] || 1
  }

  // Cryptos a user can convert USD into. Independent of what they currently
  // hold, so a cash-only account can still pick a target.
  const CONVERT_TARGETS = ['BTC', 'ETH', 'SOL', 'USDC', 'USDT', 'ADA', 'XRP', 'DOGE', 'MATIC', 'DOT', 'AVAX', 'LINK', 'LTC', 'BCH'] as const

  function CurrencyIcon({ currency, size = 32 }: { currency: string; size?: number }) {
    const isUsd = currency === 'USD'
    if (isUsd) {
      return (
        <div
          className="rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44] shrink-0"
          style={{ width: size, height: size }}
        >$</div>
      )
    }
    return (
      <img
        src={assetIconFor(currency) || cryptoIconFor(currency) || undefined}
        alt={currency}
        className="rounded-full bg-[#0C8B44]/10 shrink-0 object-contain"
        style={{ width: size, height: size }}
        onError={(e) => {
          const t = e.currentTarget
          t.style.display = 'none'
          const fb = t.nextElementSibling as HTMLElement | null
          if (fb) fb.style.display = 'flex'
        }}
      />
    )
  }

  const handleDeposit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setTransferStatus({ kind: 'error', title: 'Deposit declined', message: 'Enter a valid amount.' })
      return
    }
    const amt = parseFloat(amount)
    if (selectedCurrency === 'USD') {
      if (usdMethod === 'wire') {
        if (!wireInstructions) {
          setTransferStatus({ kind: 'error', title: 'Deposit declined', message: 'Wire instructions are not configured yet — contact support.' })
          return
        }
        const ref = wireInstructions.reference || 'Wire deposit'
        portfolioStore.addTransaction('deposit', amt, 'USD', `Wire to ${wireInstructions.bankName} · ${ref}`)
        setTransferStatus({
          kind: 'success',
          title: 'Wire deposit initiated',
          message: `Initiated $${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} wire to ${wireInstructions.bankName}. Funds credit on receipt (typically 1 business day).`,
        })
        setAmount('')
        setTransactions(portfolioStore.getTransactions())
        return
      }
      const bank = banks.find((b) => b.id === selectedBankId)
      if (!bank) {
        setTransferStatus({ kind: 'error', title: 'Deposit declined', message: 'Link a bank account first.' })
        setLinkBankOpen(true)
        return
      }
      if (bank.status !== 'verified') {
        setTransferStatus({ kind: 'error', title: 'Deposit declined', message: 'That bank is still verifying — try again in a few seconds.' })
        return
      }
      const description = `ACH from ${bank.institution} ····${bank.accountMask}`
      portfolioStore.addTransaction('deposit', amt, 'USD', description)
      setTransferStatus({
        kind: 'success',
        title: 'ACH deposit initiated',
        message: `Initiated $${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${bank.institution} ····${bank.accountMask}. Funds typically settle in 1–3 business days.`,
      })
      setAmount('')
      setTransactions(portfolioStore.getTransactions())
      return
    }
    if (!cryptoInstructions) {
      setTransferStatus({ kind: 'error', title: 'Deposit declined', message: `No ${selectedCurrency} deposit address configured. Ask an admin to set one.` })
      return
    }
    portfolioStore.addTransaction('deposit', amt, selectedCurrency, `Crypto Deposit (${selectedCurrency}) — ${cryptoInstructions.network}`)
    setTransferStatus({
      kind: 'success',
      title: 'Deposit logged',
      message: `Logged ${amt.toLocaleString(undefined, { minimumFractionDigits: selectedCurrency === 'USD' ? 2 : 0, maximumFractionDigits: selectedCurrency === 'USD' ? 2 : 8 })} ${selectedCurrency}. Funds will be available after on-chain confirmation.`,
    })
    setAmount('')
    setTransactions(portfolioStore.getTransactions())
  }

  const handleWithdraw = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setTransferStatus({ kind: 'error', title: 'Withdrawal declined', message: 'Enter a valid amount.' })
      return
    }
    const amt = -parseFloat(amount)
    portfolioStore.addTransaction('withdraw', amt, selectedCurrency, selectedCurrency === 'USD' ? 'Bank Transfer (ACH)' : `Crypto Withdrawal (${selectedCurrency})`)
    setTransferStatus({
      kind: 'success',
      title: 'Withdrawal sent',
      message: `Withdrew ${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: selectedCurrency === 'USD' ? 2 : 0, maximumFractionDigits: selectedCurrency === 'USD' ? 2 : 8 })} ${selectedCurrency}.`,
    })
    setAmount('')
    setTransactions(portfolioStore.getTransactions())
  }

  const handleTransfer = async () => {
    if (transferMode === 'send') {
      const amt = parseFloat(amount)
      if (!amt || amt <= 0) {
        setTransferStatus({ kind: 'error', title: 'Transfer declined', message: 'Enter a valid amount.' })
        return
      }
      const email = transferRecipient.trim().toLowerCase()
      if (!email || !/^.+@.+\..+$/.test(email)) {
        setTransferStatus({ kind: 'error', title: 'Transfer declined', message: 'Enter a recipient email.' })
        return
      }
      const balance = wallet.find(w => w.currency === transferCurrency)?.available ?? 0
      if (amt > balance) {
        setTransferStatus({ kind: 'error', title: 'Transfer declined', message: `Insufficient ${transferCurrency} balance.` })
        return
      }
      setTransferSending(true)
      try {
        if (getToken()) {
          await api.transferToUser({ recipientEmail: email, currency: transferCurrency, amount: amt, note: transferNote.trim() || undefined })
        }
        // Reflect locally either way (offline-friendly).
        portfolioStore.addTransaction('transfer', -amt, transferCurrency, `Sent to ${email}${transferNote ? ' — ' + transferNote : ''}`)
        setTransferStatus({
          kind: 'success',
          title: 'Transfer sent',
          message: `Sent ${amt} ${transferCurrency} to ${transferRecipientName || email}.`,
        })
        setAmount(''); setTransferNote(''); setTransferRecipient(''); setTransferRecipientName(null); setTransferRecipientStatus('idle')
        setTransactions([...portfolioStore.getTransactions()])
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transfer failed'
        setTransferStatus({ kind: 'error', title: 'Transfer declined', message: msg })
      } finally {
        setTransferSending(false)
      }
      return
    }
    // Convert USD -> crypto inside the same wallet (legacy behaviour).
    if (!amount || parseFloat(amount) <= 0) {
      setTransferStatus({ kind: 'error', title: 'Transfer declined', message: 'Enter a valid amount.' })
      return
    }
    const amt = -parseFloat(amount)
    const usdAvailable = wallet.find(w => w.currency === 'USD')?.available ?? 0
    if (Math.abs(amt) > usdAvailable) {
      setTransferStatus({ kind: 'error', title: 'Transfer declined', message: 'Insufficient USD balance.' })
      return
    }
    portfolioStore.addTransaction('transfer', amt, 'USD', `Convert to ${selectedCurrency}`)
    const receiveAmt = Math.abs(amt) / getUsdRate(selectedCurrency)
    portfolioStore.addTransaction('deposit', receiveAmt, selectedCurrency, `Converted from USD`)
    setTransferStatus({
      kind: 'success',
      title: 'Conversion complete',
      message: `Converted ${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD to ${receiveAmt.toFixed(6)} ${selectedCurrency}.`,
    })
    setAmount('')
    setTransactions([...portfolioStore.getTransactions()])
  }

  // Debounced recipient lookup so the UI shows whether the email is a real
  // Verdexis user before they hit Send.
  useEffect(() => {
    if (transferMode !== 'send') return
    const email = transferRecipient.trim().toLowerCase()
    if (!email || !/^.+@.+\..+$/.test(email)) {
      setTransferRecipientStatus('idle')
      setTransferRecipientName(null)
      return
    }
    if (!getToken()) { setTransferRecipientStatus('idle'); return }
    setTransferRecipientStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const r = await api.lookupRecipient(email)
        setTransferRecipientName(r.user.name)
        setTransferRecipientStatus('ok')
      } catch {
        setTransferRecipientName(null)
        setTransferRecipientStatus('notfound')
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [transferRecipient, transferMode])

  const handleIncome = () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    const source = incomeSource.trim() || (incomeKind === 'dividend' ? 'Dividend payment' : 'Interest income')
    portfolioStore.addTransaction(incomeKind, amt, selectedCurrency, source)
    toast.success(`Logged ${amt.toLocaleString(undefined, { minimumFractionDigits: selectedCurrency === 'USD' ? 2 : 0, maximumFractionDigits: selectedCurrency === 'USD' ? 2 : 8 })} ${selectedCurrency} ${incomeKind}`)
    setAmount('')
    setIncomeSource('')
    setTransactions(portfolioStore.getTransactions())
    setWallet(portfolioStore.getWallet())
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
      case 'dividend': return <Coins className="w-5 h-5 text-[#0C8B44]" />
      case 'interest': return <Percent className="w-5 h-5 text-[#0C8B44]" />
      default: return <ArrowLeftRight className="w-5 h-5 text-[#A0A0A0]" />
    }
  }

  const txIconBg = (type: string) => {
    switch (type) {
      case 'deposit': return 'bg-[#4CAF50]/10'
      case 'withdraw': return 'bg-[#f44336]/10'
      case 'transfer': return 'bg-[#2196F3]/10'
      case 'dividend':
      case 'interest': return 'bg-[#0C8B44]/10'
      default: return 'bg-[#1a1a1a]/50'
    }
  }

  function exportTransactionsCsv(rows: typeof transactions) {
    const header = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Status']
    const csv = [header.join(',')]
      .concat(rows.map((t) => [
        new Date(t.timestamp).toISOString(),
        t.type,
        t.amount,
        t.currency,
        `"${t.description.replace(/"/g, '""')}"`,
        t.status,
      ].join(',')))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verdexis-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    toast.success('Exported CSV')
  }

  function importTransactionsCsv(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) { toast.error('CSV is empty'); return }
      // Header skipped
      const allowedTypes = ['deposit', 'withdraw', 'transfer', 'dividend', 'interest'] as const
      let imported = 0
      let skipped = 0
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvLine(lines[i])
        if (cells.length < 5) { skipped++; continue }
        const [, typeRaw, amountRaw, currencyRaw, descriptionRaw] = cells
        const type = typeRaw?.toLowerCase().trim() as typeof allowedTypes[number]
        const amount = parseFloat(amountRaw)
        const currency = (currencyRaw || 'USD').toUpperCase().trim()
        if (!allowedTypes.includes(type) || !isFinite(amount)) { skipped++; continue }
        portfolioStore.addTransaction(type, amount, currency, (descriptionRaw || 'Imported').replace(/^"|"$/g, ''))
        imported++
      }
      setTransactions(portfolioStore.getTransactions())
      setWallet(portfolioStore.getWallet())
      if (imported) toast.success(`Imported ${imported} transactions${skipped ? ` (${skipped} skipped)` : ''}`)
      else toast.error('No valid transactions found')
    }
    reader.readAsText(file)
  }

  function parseCsvLine(line: string): string[] {
    const out: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      {transferStatus && (
        <div
          className="status-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6"
          onClick={() => setTransferStatus(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-col items-center text-center max-w-sm">
            <div
              className={`status-disc w-32 h-32 rounded-full flex items-center justify-center ${
                transferStatus.kind === 'success'
                  ? 'bg-[#0C8B44]/20 ring-4 ring-[#0C8B44]/40'
                  : 'bg-red-500/20 ring-4 ring-red-500/40'
              }`}
            >
              <svg className="status-svg w-20 h-20" viewBox="0 0 52 52" fill="none" stroke={transferStatus.kind === 'success' ? '#0C8B44' : '#ef4444'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                {transferStatus.kind === 'success' ? (
                  <path d="M14 27 L23 36 L40 18" />
                ) : (
                  <path d="M18 18 L34 34 M34 18 L18 34" />
                )}
              </svg>
            </div>
            <div className="status-text mt-6">
              <h2 className={`text-2xl font-semibold ${transferStatus.kind === 'success' ? 'text-white' : 'text-red-400'}`}>{transferStatus.title}</h2>
              <p className="mt-2 text-sm text-[#A0A0A0] leading-relaxed">{transferStatus.message}</p>
              {transferStatus.kind === 'error' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setTransferStatus(null) }}
                  className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <Navigation />
      <LinkBankModal isOpen={linkBankOpen} onClose={() => setLinkBankOpen(false)} onLinked={(id) => setSelectedBankId(id)} />
      <WalletPickerModal
        isOpen={web3.pickerOpen}
        onClose={() => web3.setPickerOpen(false)}
        discovered={web3.discovered}
        onPick={(uuid) => { void web3.connectTo(uuid) }}
        onRefresh={() => web3.refreshDiscovered()}
        isConnecting={web3.isConnecting}
        selectedRdns={web3.walletInfo?.rdns}
      />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Wallet</h1>
              <p className="text-sm text-[#737373] mt-1">Manage your assets</p>
            </div>
            <button onClick={() => setShowBalance(!showBalance)} aria-label={showBalance ? 'Hide balance' : 'Show balance'}
              className="inline-flex items-center gap-1.5 self-start px-2.5 py-1.5 rounded-md bg-[#1a1a1a] border border-[#ffffff08] text-xs text-[#A0A0A0] hover:text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors">
              {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{showBalance ? 'Hide' : 'Show'}</span>
            </button>
          </div>

          {/* Main Balance */}
          <div className="liquid-card p-8 mb-6" style={{ '--fill-color': 'rgba(12,139,68,0.15)' } as React.CSSProperties}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-sm text-[#A0A0A0] mb-2">Total Balance</p>
                <p className="text-5xl md:text-6xl font-light tracking-[-0.03em] text-[#E5E5E5]">
                  {showBalance
                    ? `$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '****'}
                </p>
                <p className="text-sm text-[#4CAF50] mt-2 flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4" /> +5.2% this month
                </p>
              </div>
              <div className="flex items-center gap-3">
                {[{ label: 'Deposit', icon: ArrowDownRight, tab: 'deposit' as TabType, color: '#0C8B44' }, { label: 'Withdraw', icon: ArrowUpRight, tab: 'withdraw' as TabType, color: '#f44336' }, { label: 'Transfer', icon: ArrowLeftRight, tab: 'transfer' as TabType, color: '#2196F3' }, { label: 'Income', icon: Coins, tab: 'income' as TabType, color: '#0C8B44' }].map((action) => (
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

          {/* Income YTD summary */}
          {(() => {
            const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime()
            const incomeTxs = transactions.filter(
              (t) => (t.type === 'dividend' || t.type === 'interest') && new Date(t.timestamp).getTime() >= yearStart,
            )
            if (incomeTxs.length === 0) return null
            const ytdUsd = incomeTxs.reduce((s, t) => s + Math.abs(t.amount) * getUsdRate(t.currency), 0)
            const dividends = incomeTxs.filter((t) => t.type === 'dividend').reduce((s, t) => s + Math.abs(t.amount) * getUsdRate(t.currency), 0)
            const interest = incomeTxs.filter((t) => t.type === 'interest').reduce((s, t) => s + Math.abs(t.amount) * getUsdRate(t.currency), 0)
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="w-4 h-4 text-[#0C8B44]" />
                    <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Income YTD</p>
                  </div>
                  <p className="text-2xl font-light text-[#E5E5E5]">${ytdUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-[#737373] mt-1">{incomeTxs.length} payments</p>
                </div>
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="w-4 h-4 text-[#0C8B44]" />
                    <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Dividends YTD</p>
                  </div>
                  <p className="text-2xl font-light text-[#E5E5E5]">${dividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent className="w-4 h-4 text-[#0C8B44]" />
                    <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Interest YTD</p>
                  </div>
                  <p className="text-2xl font-light text-[#E5E5E5]">${interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            )
          })()}

          {/* Sub-balances */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {wallet.map((w) => (
              <div key={w.currency} className="glass-card p-4 hover:border-[#0C8B44]/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CurrencyIcon currency={w.currency} size={32} />
                    <span className="text-sm font-medium text-[#E5E5E5] truncate">{w.currency}</span>
                  </div>
                  {w.currency !== 'USD' && <span className="text-xs text-[#737373] shrink-0">${(w.balance * getUsdRate(w.currency)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
                </div>                <p className="text-2xl font-light text-[#E5E5E5] truncate">{showBalance ? <>{w.symbol}{w.balance.toLocaleString(undefined, { minimumFractionDigits: w.currency === 'USD' ? 2 : 0, maximumFractionDigits: w.currency === 'USD' ? 2 : 4 })}</> : '****'}</p>
                <p className="text-xs text-[#737373] mt-1 truncate">Available: {w.symbol}{w.available.toLocaleString(undefined, { minimumFractionDigits: w.currency === 'USD' ? 2 : 0, maximumFractionDigits: w.currency === 'USD' ? 2 : 4 })}</p>
              </div>
            ))}
          </div>

          {/* Web3 Wallet */}
          <div className="glass-card p-6 mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center shrink-0">
                  <WalletIcon className="w-5 h-5 text-[#0C8B44]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#E5E5E5]">Web3 Wallet</p>
                  {web3.isConnected ? (
                    <p className="text-xs text-[#A0A0A0] flex items-center gap-2 truncate">
                      <span className="font-mono text-[#0C8B44]">{web3.shortAddress}</span>
                      {web3.chainName && <span className="text-[10px] uppercase tracking-wider text-[#737373]">{web3.chainName}</span>}
                      {web3.balanceEth != null && <span className="text-[10px] text-[#737373]">{web3.balanceEth.toFixed(4)} ETH</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-[#737373]">{web3.discovered.length > 0 ? `${web3.discovered.length} wallet${web3.discovered.length === 1 ? '' : 's'} detected — connect to deposit crypto from self-custody.` : 'Connect any EIP-1193 wallet (MetaMask, Coinbase, Rabby, Trust…) to deposit crypto from self-custody.'}</p>
                  )}
                  {web3.error && <p className="text-[10px] text-[#f44336] mt-0.5">{web3.error}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {web3.isConnected ? (
                  <>
                    <button
                      onClick={() => { if (web3.address) { navigator.clipboard.writeText(web3.address); toast.success('Address copied') } }}
                      className="px-3 py-2 text-xs text-[#A0A0A0] bg-[#1a1a1a] border border-[#ffffff10] rounded-lg hover:text-[#0C8B44] hover:border-[#0C8B44]/40 transition-colors flex items-center gap-1.5"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <button
                      onClick={web3.disconnect}
                      className="px-3 py-2 text-xs text-[#A0A0A0] bg-[#1a1a1a] border border-[#ffffff10] rounded-lg hover:text-[#f44336] hover:border-[#f44336]/40 transition-colors"
                    >
                      Disconnect
                    </button>
                  </>
                ) : web3.isAvailable ? (
                  <button
                    onClick={web3.connect}
                    disabled={web3.isConnecting}
                    className="px-4 py-2 text-xs text-white bg-[#0C8B44] rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <WalletIcon className="w-3.5 h-3.5" />
                    {web3.isConnecting ? 'Connecting…' : 'Connect Wallet'}
                  </button>
                ) : (
                  <button
                    onClick={web3.connect}
                    className="px-4 py-2 text-xs text-white bg-[#0C8B44] rounded-lg hover:bg-[#0a7539] transition-colors flex items-center gap-1.5"
                  >
                    <WalletIcon className="w-3.5 h-3.5" />
                    Choose a wallet
                  </button>
                )}
              </div>
            </div>

            {/* Send ETH — visible only when connected */}
            {web3.isConnected && (
              <div className="mt-5 pt-5 border-t border-[#ffffff10]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-[#E5E5E5]">{web3Payout && !web3RecipientOverridden ? 'Send to Verdexis payout address' : web3Recipient.trim() ? 'Send ETH' : 'Transfer to Dashboard'}</p>
                    <p className="text-[11px] text-[#737373]">
                      {web3Payout && !web3RecipientOverridden
                        ? 'Funds will be sent on-chain to the address configured by Verdexis admin.'
                        : web3Recipient.trim()
                        ? 'Sign an on-chain ETH transfer to the recipient address below.'
                        : 'Leave the address empty to credit your Verdexis dashboard, or paste any 0x… address to send to another wallet.'}
                    </p>
                  </div>
                  <button
                    onClick={() => web3.balanceEth != null && setWeb3TransferAmount(Math.max(0, web3.balanceEth - 0.001).toFixed(4))}
                    className="text-[10px] uppercase tracking-wider text-[#0C8B44] hover:underline"
                  >Max</button>
                </div>
                <div className="flex flex-col gap-2">
                  {web3Payout && !web3RecipientOverridden ? (
                    <div className="flex items-start gap-3 bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-lg px-3 py-3">
                      <Shield className="w-4 h-4 text-[#0C8B44] mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#E5E5E5] font-medium truncate">{web3Payout.label || 'Verdexis payout address'}</p>
                        <p className="text-[11px] text-[#A0A0A0] font-mono truncate">{web3Payout.address}</p>
                        {web3Payout.notes && <p className="text-[10px] text-[#737373] mt-1">{web3Payout.notes}</p>}
                      </div>
                      <button
                        onClick={() => { setWeb3RecipientOverridden(true); setWeb3Recipient('') }}
                        className="text-[10px] uppercase tracking-wider text-[#0C8B44] hover:underline whitespace-nowrap shrink-0"
                      >Use other</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-3 py-2.5">
                      <input
                        type="text"
                        value={web3Recipient}
                        onChange={(e) => setWeb3Recipient(e.target.value)}
                        placeholder="Recipient address (0x…) — leave empty to credit dashboard"
                        aria-label="Recipient wallet address"
                        spellCheck={false}
                        className="flex-1 bg-transparent text-[#E5E5E5] text-sm font-mono focus:outline-none placeholder:font-sans placeholder:text-[#555]"
                      />
                      {web3Payout && (
                        <button
                          onClick={() => { setWeb3RecipientOverridden(false); setWeb3Recipient(web3Payout.address) }}
                          className="text-[10px] uppercase tracking-wider text-[#0C8B44] hover:underline whitespace-nowrap"
                        >Use payout</button>
                      )}
                      {!web3Payout && web3Recipient && (
                        <button
                          onClick={() => setWeb3Recipient('')}
                          className="text-[10px] uppercase tracking-wider text-[#737373] hover:text-[#E5E5E5]"
                        >Clear</button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-3 py-2.5">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={web3TransferAmount}
                        onChange={(e) => setWeb3TransferAmount(e.target.value)}
                        placeholder="0.0000"
                        aria-label="ETH amount to transfer"
                        className="flex-1 bg-transparent text-[#E5E5E5] text-sm focus:outline-none"
                      />
                      <span className="text-xs text-[#737373] font-mono">ETH</span>
                    </div>
                    <button
                      onClick={handleWeb3Transfer}
                      disabled={web3Sending || !web3TransferAmount}
                      className="px-5 py-2.5 text-sm text-white bg-[#0C8B44] rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:min-w-[180px]"
                    >
                      {web3Sending ? (
                        <><Clock className="w-4 h-4 animate-spin" /> Awaiting signature…</>
                      ) : web3Recipient.trim() ? (
                        <><ArrowUpRight className="w-4 h-4" /> Send ETH</>
                      ) : (
                        <><ArrowDownRight className="w-4 h-4" /> Transfer to Dashboard</>
                      )}
                    </button>
                  </div>
                </div>
                {web3LastTx && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[#A0A0A0]">
                    <CheckCircle className="w-3.5 h-3.5 text-[#0C8B44]" />
                    <span>Last transfer: <span className="font-mono text-[#E5E5E5]">{web3LastTx.amount} ETH</span></span>
                    <a
                      href={explorerTxUrl(web3LastTx.hash, web3.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[#0C8B44] hover:underline flex items-center gap-1"
                    >View on explorer <ExternalLink className="w-3 h-3" /></a>
                  </div>
                )}
                <p className="text-[10px] text-[#737373] mt-2">
                  Network fees apply. Verdexis never holds your keys — your wallet remains in self-custody.
                </p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="-mx-2 px-2 mb-6 overflow-x-auto no-scrollbar">
            <div className="inline-flex gap-1 p-1 bg-[#1a1a1a] rounded-xl">
              {([{ key: 'overview', label: 'Overview' }, { key: 'deposit', label: 'Deposit' }, { key: 'withdraw', label: 'Withdraw' }, { key: 'transfer', label: 'Transfer' }, { key: 'income', label: 'Income' }] as const).map((tab) => (              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'bg-[#0C8B44] text-white' : 'text-[#737373] hover:text-[#E5E5E5]'}`}>
                {tab.label}
              </button>
            ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="glass-card overflow-hidden">
              <div className="p-6 border-b border-[#ffffff08] flex items-center justify-between gap-4">
                <h3 className="text-lg font-medium text-[#E5E5E5]">Transaction History</h3>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#A0A0A0] border border-[#ffffff10] rounded-lg hover:text-[#E5E5E5] hover:border-[#ffffff25] transition-colors cursor-pointer">
                    <Download className="w-3.5 h-3.5 rotate-180" />Import CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) importTransactionsCsv(f); e.currentTarget.value = '' }}
                    />
                  </label>
                  <button
                    onClick={() => exportTransactionsCsv(transactions)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#A0A0A0] border border-[#ffffff10] rounded-lg hover:text-[#E5E5E5] hover:border-[#ffffff25] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />Export CSV
                  </button>
                </div>
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
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, {
                          minimumFractionDigits: tx.currency === 'USD' ? 2 : 0,
                          maximumFractionDigits: tx.currency === 'USD' ? 2 : 8,
                        })} {tx.currency}
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-medium text-[#E5E5E5]">Deposit Funds</h3>
                {adminMode && (
                  <Link to="/admin/deposits" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.05em] text-[#0C8B44] hover:text-[#0a7539]">
                    <Shield className="w-3 h-3" />Admin
                  </Link>
                )}
              </div>
              <div className="mb-6">
                <label className="text-sm text-[#A0A0A0] mb-2 block">Select Currency</label>
                <div className="grid grid-cols-2 gap-3">
                  {wallet.map((w) => (
                    <button key={w.currency} onClick={() => setSelectedCurrency(w.currency)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCurrency === w.currency ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50'}`}>
                      <CurrencyIcon currency={w.currency} size={32} />
                      <span className="text-sm text-[#E5E5E5]">{w.currency}</span>
                    </button>
                  ))}
                </div>
              </div>
              {selectedCurrency === 'USD' ? (
                <div className="space-y-4">
                  {/* ACH vs Wire method picker */}
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Funding method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setUsdMethod('ach')}
                        className={`p-3 rounded-xl border text-left transition-all ${usdMethod === 'ach' ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Banknote className={`w-4 h-4 ${usdMethod === 'ach' ? 'text-[#0C8B44]' : 'text-[#A0A0A0]'}`} />
                          <span className="text-sm font-medium text-[#E5E5E5]">ACH</span>
                        </div>
                        <p className="text-[11px] text-[#737373]">Link a bank · 1–3 business days · No fee</p>
                      </button>
                      <button
                        onClick={() => setUsdMethod('wire')}
                        className={`p-3 rounded-xl border text-left transition-all ${usdMethod === 'wire' ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className={`w-4 h-4 ${usdMethod === 'wire' ? 'text-[#0C8B44]' : 'text-[#A0A0A0]'}`} />
                          <span className="text-sm font-medium text-[#E5E5E5]">Wire transfer</span>
                        </div>
                        <p className="text-[11px] text-[#737373]">Same-day · No limit · Fees may apply</p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block" htmlFor="deposit-amt">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]">$</span>
                      <input id="deposit-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                        className="w-full pl-8 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[100, 500, 1000, 5000].map((v) => (
                        <button key={v} onClick={() => setAmount(String(v))} className="flex-1 py-1.5 text-xs text-[#A0A0A0] bg-[#1a1a1a] border border-[#ffffff08] rounded-lg hover:text-[#0C8B44] hover:border-[#0C8B44]/40 transition-colors">${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</button>
                      ))}
                    </div>
                  </div>

                  {usdMethod === 'ach' ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-[#A0A0A0]">Funding source</label>
                        <button onClick={() => setLinkBankOpen(true)} className="flex items-center gap-1 text-xs text-[#0C8B44] hover:text-[#0a7539] transition-colors">
                          <Plus className="w-3 h-3" /> Add bank
                        </button>
                      </div>
                      {banks.length === 0 ? (
                        <button onClick={() => setLinkBankOpen(true)} className="w-full p-5 rounded-xl border-2 border-dashed border-[#0C8B44]/30 hover:border-[#0C8B44] hover:bg-[#0C8B44]/5 transition-all text-left group">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center shrink-0">
                              <Banknote className="w-5 h-5 text-[#0C8B44]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#E5E5E5]">Link a bank account</p>
                              <p className="text-xs text-[#A0A0A0] mt-1">Required to fund USD deposits via ACH. Verified instantly with your bank login or in 1–2 days with micro-deposits.</p>
                            </div>
                          </div>
                        </button>
                      ) : (
                        <div className="space-y-2">
                          {banks.map((b) => {
                            const checked = selectedBankId === b.id
                            return (
                              <label key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'}`}>
                                <input
                                  type="radio"
                                  name="funding-bank"
                                  value={b.id}
                                  checked={checked}
                                  onChange={() => setSelectedBankId(b.id)}
                                  className="sr-only"
                                />
                                <Banknote className={`w-7 h-7 shrink-0 ${checked ? 'text-[#0C8B44]' : 'text-[#A0A0A0]'}`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[#E5E5E5] truncate">{b.institution}</p>
                                  <p className="text-xs text-[#737373] capitalize">{b.type} ····{b.accountMask}</p>
                                </div>
                                {b.status === 'verified' ? (
                                  <span className="flex items-center gap-1 text-[10px] text-[#4CAF50] uppercase tracking-wider shrink-0"><CheckCircle className="w-3 h-3" /> Verified</span>
                                ) : b.status === 'pending' ? (
                                  <span className="flex items-center gap-1 text-[10px] text-[#F57C00] uppercase tracking-wider shrink-0"><Clock className="w-3 h-3" /> Pending</span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] text-[#f44336] uppercase tracking-wider shrink-0"><AlertCircle className="w-3 h-3" /> Failed</span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); if (confirm(`Remove ${b.institution} ····${b.accountMask}?`)) { removeBank(b.id); toast.success('Bank removed') } }}
                                  className="p-1.5 rounded-lg text-[#737373] hover:text-[#f44336] hover:bg-red-500/10 transition-colors shrink-0"
                                  aria-label="Remove bank"
                                  title="Remove bank"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <WireInstructionsPanel currency={selectedCurrency} info={wireInstructions} adminMode={adminMode} />
                  )}

                  <button
                    onClick={handleDeposit}
                    disabled={
                      !amount || (
                        usdMethod === 'ach'
                          ? !banks.find((b) => b.id === selectedBankId && b.status === 'verified')
                          : !wireInstructions
                      )
                    }
                    className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {usdMethod === 'wire'
                      ? wireInstructions
                        ? `I sent $${amount || '0'} via wire`
                        : 'Wire instructions not available'
                      : banks.find((b) => b.id === selectedBankId && b.status === 'verified')
                        ? `Deposit $${amount || '0'} via ACH`
                        : 'Link a verified bank to continue'}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-[10px] text-[#737373]">
                    {usdMethod === 'wire'
                      ? <><Building2 className="w-3 h-3" /> Send the wire from your bank, then click above so we can match the credit.</>
                      : <><Banknote className="w-3 h-3" /> Same-day ACH up to $25k. Standard ACH 1–3 business days. No fees.</>}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Amount</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                  </div>

                  {cryptoInstructions ? (
                    <div className="p-6 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] text-center">
                      <div className="inline-block p-3 rounded-xl bg-[#070C0E] border border-[#ffffff08] mb-4">
                        <QrCode value={qrPayload(selectedCurrency, cryptoInstructions.address, amount)} size={176} />
                      </div>
                      <p className="text-sm text-[#A0A0A0] mb-1">Send {selectedCurrency} to this address</p>
                      <p className="text-[11px] text-[#737373] mb-3">Network: <span className="text-[#E5E5E5]">{cryptoInstructions.network}</span></p>
                      <div className="flex items-center gap-2 justify-center mb-2">
                        <code className="text-[11px] text-[#E5E5E5] bg-[#070C0E] px-3 py-1.5 rounded-lg break-all max-w-[280px]">{cryptoInstructions.address}</code>
                        <button type="button" aria-label="Copy address" onClick={() => copyToClipboard(cryptoInstructions.address, 'Address copied')} className="p-1.5 rounded-lg text-[#737373] hover:text-[#0C8B44] transition-colors shrink-0"><Copy className="w-4 h-4" /></button>
                      </div>
                      {cryptoInstructions.memo && (
                        <div className="flex items-center gap-2 justify-center mt-2">
                          <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373]">Memo</span>
                          <code className="text-[11px] text-[#E5E5E5] bg-[#070C0E] px-3 py-1.5 rounded-lg">{cryptoInstructions.memo}</code>
                          <button type="button" aria-label="Copy memo" onClick={() => copyToClipboard(cryptoInstructions.memo!, 'Memo copied')} className="p-1.5 rounded-lg text-[#737373] hover:text-[#0C8B44] transition-colors"><Copy className="w-4 h-4" /></button>
                        </div>
                      )}
                      {cryptoInstructions.notes && (
                        <p className="text-[11px] text-[#A0A0A0] mt-3">{cryptoInstructions.notes}</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-[#1a1a1a]/50 border border-dashed border-[#ffffff10] text-center">
                      <QrCodeIcon className="w-10 h-10 mx-auto mb-3 text-[#444]" />
                      <p className="text-sm text-[#E5E5E5] mb-1">No deposit address configured</p>
                      <p className="text-[11px] text-[#737373]">
                        Ask an admin to add a {selectedCurrency} wallet on the
                        {' '}<Link to="/admin/deposits" className="text-[#0C8B44] hover:text-[#0a7539]">deposit instructions</Link> page.
                      </p>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-[#F57C00]/10 border border-[#F57C00]/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#F57C00] shrink-0 mt-0.5" />
                      <div><p className="text-sm font-medium text-[#F57C00]">Important</p><p className="text-xs text-[#A0A0A0] mt-1">Send only {selectedCurrency}{cryptoInstructions ? ` on ${cryptoInstructions.network}` : ''} to this address. Other assets or networks may be lost.</p></div>
                    </div>
                  </div>
                  <button onClick={handleDeposit} disabled={!cryptoInstructions || !amount} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    I sent {amount || '0'} {selectedCurrency}
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
                      <CurrencyIcon currency={w.currency} size={32} />
                      <div><span className="text-sm text-[#E5E5E5]">{w.currency}</span><p className="text-xs text-[#737373]">Avail: {w.symbol}{w.available.toLocaleString(undefined, { minimumFractionDigits: w.currency === 'USD' ? 2 : 0, maximumFractionDigits: w.currency === 'USD' ? 2 : 4 })}</p></div>
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

              {/* Mode toggle: send to another user vs convert across own wallets */}
              <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-[#1a1a1a] rounded-xl border border-[#ffffff08]">
                <button
                  onClick={() => setTransferMode('send')}
                  className={`py-2.5 text-sm font-medium rounded-lg transition-all ${transferMode === 'send' ? 'bg-[#0C8B44] text-white' : 'text-[#A0A0A0] hover:text-[#E5E5E5]'}`}
                >Send to user</button>
                <button
                  onClick={() => {
                    setTransferMode('convert')
                    // If the user has only USD, selectedCurrency is still 'USD'
                    // which would make the Convert form a no-op. Default to BTC.
                    if (selectedCurrency === 'USD') setSelectedCurrency('BTC')
                  }}
                  className={`py-2.5 text-sm font-medium rounded-lg transition-all ${transferMode === 'convert' ? 'bg-[#0C8B44] text-white' : 'text-[#A0A0A0] hover:text-[#E5E5E5]'}`}
                >Convert (USD ↔ Crypto)</button>
              </div>

              {transferMode === 'send' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">From wallet</label>
                    <div className="grid grid-cols-3 gap-2">
                      {wallet.map((w) => (
                        <button key={w.currency} onClick={() => setTransferCurrency(w.currency)}
                          className={`p-3 rounded-xl border transition-all ${transferCurrency === w.currency ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50'}`}>
                          <div className="mx-auto mb-2 w-fit"><CurrencyIcon currency={w.currency} size={28} /></div>
                          <p className="text-xs text-[#E5E5E5]">{w.currency}</p>
                          <p className="text-[10px] text-[#737373]">
                            {w.symbol}{w.available.toLocaleString(undefined, { minimumFractionDigits: w.currency === 'USD' ? 2 : 0, maximumFractionDigits: w.currency === 'USD' ? 2 : 6 })}
                          </p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[#737373] mt-2">
                      Available: {wallet.find(w => w.currency === transferCurrency)?.symbol ?? '$'}
                      {(wallet.find(w => w.currency === transferCurrency)?.available ?? 0).toLocaleString(undefined, { minimumFractionDigits: transferCurrency === 'USD' ? 2 : 0, maximumFractionDigits: transferCurrency === 'USD' ? 2 : 6 })}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Recipient (email)</label>
                    <input type="email" value={transferRecipient} onChange={(e) => setTransferRecipient(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                    {transferRecipientStatus === 'checking' && (
                      <p className="text-[11px] text-[#737373] mt-1.5 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Checking…</p>
                    )}
                    {transferRecipientStatus === 'ok' && (
                      <p className="text-[11px] text-[#4CAF50] mt-1.5 flex items-center gap-1.5"><CheckCircle className="w-3 h-3" /> {transferRecipientName || 'Verified Verdexis user'}</p>
                    )}
                    {transferRecipientStatus === 'notfound' && (
                      <p className="text-[11px] text-[#f44336] mt-1.5 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> No Verdexis user with that email</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]">{wallet.find(w => w.currency === transferCurrency)?.symbol ?? '$'}</span>
                      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                        className="w-full pl-9 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">Note <span className="text-[#555]">(optional)</span></label>
                    <input type="text" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} maxLength={200}
                      placeholder="What's it for?"
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                  </div>

                  <button onClick={handleTransfer} disabled={transferSending || !amount || transferRecipientStatus === 'notfound' || transferRecipientStatus === 'checking'}
                    className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {transferSending ? 'Sending…' : `Send ${amount || '0'} ${transferCurrency}`}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">From</label>
                    <div className="p-4 rounded-xl bg-[#0C8B44]/10 border border-[#0C8B44]/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-sm font-bold text-[#0C8B44]">$</div>
                          <div>
                            <p className="text-sm font-medium text-[#E5E5E5]">USD Wallet</p>
                            <p className="text-xs text-[#737373]">
                              Available: ${(wallet.find(w => w.currency === 'USD')?.available ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
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
                    <label className="text-sm text-[#A0A0A0] mb-2 block">To (currency)</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                      {CONVERT_TARGETS.map((sym) => {
                        const rate = getUsdRate(sym)
                        return (
                          <button key={sym} onClick={() => setSelectedCurrency(sym)}
                            className={`p-3 rounded-xl border transition-all ${selectedCurrency === sym ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/40'}`}>
                            <div className="mx-auto mb-2 w-fit"><CurrencyIcon currency={sym} size={28} /></div>
                            <p className="text-xs text-[#E5E5E5]">{sym}</p>
                            <p className="text-[10px] text-[#737373] truncate">${rate < 1 ? rate.toFixed(4) : rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </button>
                        )
                      })}
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
                    Convert Now
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'income' && (
            <div className="glass-card p-8 max-w-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-[#0C8B44]" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-[#E5E5E5]">Log Income</h3>
                  <p className="text-xs text-[#737373]">Record dividends or interest credited to your wallet.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([{ k: 'dividend' as IncomeKind, label: 'Dividend', icon: Coins }, { k: 'interest' as IncomeKind, label: 'Interest', icon: Percent }]).map((opt) => (
                      <button key={opt.k} onClick={() => setIncomeKind(opt.k)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${incomeKind === opt.k ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50'}`}>
                        <opt.icon className="w-4 h-4 text-[#0C8B44]" />
                        <span className="text-sm text-[#E5E5E5]">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">Currency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {wallet.map((w) => (
                      <button key={w.currency} onClick={() => setSelectedCurrency(w.currency)}
                        className={`p-2 rounded-lg border text-xs transition-all ${selectedCurrency === w.currency ? 'border-[#0C8B44] bg-[#0C8B44]/10 text-[#E5E5E5]' : 'border-[#ffffff08] bg-[#1a1a1a]/50 text-[#A0A0A0]'}`}>
                        {w.currency}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">Amount</label>
                  <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                </div>
                <div>
                  <label className="text-sm text-[#A0A0A0] mb-2 block">Source <span className="text-[#555]">(optional)</span></label>
                  <input type="text" value={incomeSource} onChange={(e) => setIncomeSource(e.target.value)}
                    placeholder={incomeKind === 'dividend' ? 'e.g. AAPL Q4 dividend' : 'e.g. Savings interest'}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                </div>
                <button onClick={handleIncome} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors">
                  Record {incomeKind === 'dividend' ? 'Dividend' : 'Interest'}
                </button>
                <p className="text-[11px] text-[#737373] text-center">Income credits your wallet balance and shows in transaction history.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}

function copyToClipboard(value: string, message = 'Copied to clipboard') {
  if (!value) return
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    toast.error('Clipboard not available')
    return
  }
  navigator.clipboard.writeText(value).then(
    () => toast.success(message),
    () => toast.error('Failed to copy'),
  )
}

function qrPayload(currency: string, address: string, amount: string): string {
  const trimmed = amount.trim()
  const numeric = trimmed && Number.isFinite(parseFloat(trimmed)) && parseFloat(trimmed) > 0 ? parseFloat(trimmed) : null
  // BIP21-style URIs are widely supported by mobile wallets.
  switch (currency.toUpperCase()) {
    case 'BTC':
      return numeric ? `bitcoin:${address}?amount=${numeric}` : `bitcoin:${address}`
    case 'ETH':
    case 'USDT':
    case 'USDC':
      return numeric ? `ethereum:${address}?value=${numeric}` : `ethereum:${address}`
    case 'SOL':
      return numeric ? `solana:${address}?amount=${numeric}` : `solana:${address}`
    case 'DOGE':
      return numeric ? `dogecoin:${address}?amount=${numeric}` : `dogecoin:${address}`
    default:
      return address
  }
}

interface WireInstructionsPanelProps {
  currency: string
  info: ReturnType<typeof depositInstructions.getWire>
  adminMode: boolean
}

function WireInstructionsPanel({ currency, info, adminMode }: WireInstructionsPanelProps) {
  if (!info) {
    return (
      <div className="p-5 rounded-xl bg-[#1a1a1a]/50 border border-dashed border-[#ffffff10] text-center">
        <Building2 className="w-8 h-8 mx-auto mb-2 text-[#444]" />
        <p className="text-sm text-[#E5E5E5] mb-1">Wire instructions not configured</p>
        <p className="text-[11px] text-[#737373]">
          {adminMode ? (
            <>Add {currency} wire details on the <Link to="/admin/deposits" className="text-[#0C8B44] hover:text-[#0a7539]">admin page</Link>.</>
          ) : (
            <>Please contact support to receive {currency} wire transfer instructions.</>
          )}
        </p>
      </div>
    )
  }

  const rows: Array<{ label: string; value?: string; mono?: boolean }> = [
    { label: 'Beneficiary', value: info.beneficiaryName },
    { label: 'Beneficiary address', value: info.beneficiaryAddress },
    { label: 'Bank', value: info.bankName },
    { label: 'Bank address', value: info.bankAddress },
    { label: 'Routing / ABA', value: info.routingNumber, mono: true },
    { label: 'SWIFT / BIC', value: info.swiftCode, mono: true },
    { label: 'IBAN', value: info.iban, mono: true },
    { label: 'Account number', value: info.accountNumber, mono: true },
    { label: 'Reference / memo', value: info.reference, mono: true },
  ]

  return (
    <div className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Building2 className="w-4 h-4 text-[#0C8B44]" />
        <p className="text-sm font-medium text-[#E5E5E5]">{info.label || `${currency} Wire transfer`}</p>
      </div>
      <div className="divide-y divide-[#ffffff05]">
        {rows.filter((r) => r.value && r.value.trim()).map((r) => (
          <div key={r.label} className="flex items-start gap-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] w-32 shrink-0 pt-1">{r.label}</span>
            <code className={`flex-1 text-xs text-[#E5E5E5] break-all ${r.mono ? 'font-mono' : 'font-sans'}`}>{r.value}</code>
            <button type="button" onClick={() => copyToClipboard(r.value!, `${r.label} copied`)} className="p-1 rounded text-[#737373] hover:text-[#0C8B44] transition-colors shrink-0" aria-label={`Copy ${r.label}`}>
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      {info.notes && (
        <p className="text-[11px] text-[#A0A0A0] pt-2 border-t border-[#ffffff05]">{info.notes}</p>
      )}
    </div>
  )
}
