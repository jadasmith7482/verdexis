import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import LinkBankModal from '../components/LinkBankModal'
import LinkedWalletsPanel from '../components/LinkedWalletsPanel'
import WalletPickerModal from '../components/WalletPickerModal'
import QrCode from '../components/QrCode'
import { portfolioStore, type WalletTransaction } from '../lib/portfolioStore'
import { listBanks, removeBank, onBanksChanged, type BankAccount } from '../lib/bankLink'
import { depositInstructions, onDepositInstructionsChanged, isAdmin, hydrateFromServer } from '../lib/depositInstructions'
import type { Web3Payout } from '../lib/depositInstructions'
import { verifyDepositTx, isVerifiableCurrency, type VerifyStatus } from '../lib/onchainVerify'
import { userWallets, USER_WALLETS_EVENT, hydrateUserWalletsFromServer } from '../lib/userWallets'
import { feeProofs } from '../lib/feeProofs'
import { getProfile } from '../lib/userProfile'
import { useWeb3 } from '../hooks/use-web3'
import { cryptoIconFor, assetIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'
import { api, getToken, newIdempotencyKey } from '../lib/api'
import { headlineAmountClass } from '../lib/utils'
import { Toaster, toast } from 'sonner'
import {
  ArrowDownRight, ArrowUpRight, ArrowLeftRight,
  Clock, CheckCircle, AlertCircle, XCircle, Copy,
  Eye, EyeOff, Banknote, QrCode as QrCodeIcon, Download,
  Coins, Percent, Plus, Trash2, Wallet as WalletIcon,
  ExternalLink, Building2, Shield,
} from 'lucide-react'

type TabType = 'overview' | 'deposit' | 'withdraw' | 'transfer' | 'income'
type IncomeKind = 'dividend' | 'interest'
type UsdMethod = 'ach' | 'wire'
type UsdWithdrawMethod = 'ach' | 'wire' | 'cashiers_check' | 'check'

interface WireRecipientInfo {
  beneficiaryName: string
  beneficiaryAddress: string
  bankName: string
  routingNumber: string
  accountNumber: string
  swiftCode: string
  memo: string
}

interface CheckDeliveryInfo {
  payTo: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  delivery: 'standard' | 'priority' | 'overnight'
  memo: string
}

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
  // Optional on-chain transaction hash the user can paste after sending
  // a crypto deposit — lets the operations team match the credit faster.
  const [cryptoTxHash, setCryptoTxHash] = useState('')
  // On-chain verification state for the current deposit form. Drives the
  // submit button's spinner + the inline status message under the tx field.
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyStatus | null>(null)
  const [recipient, setRecipient] = useState('')
  // Transfer-tab mode: convert USD to crypto in your own wallet, OR send funds
  // to another Verdexis user identified by email.
  const [transferMode, setTransferMode] = useState<'convert' | 'send'>('send')
  // Convert direction: 'usd-to-crypto' buys crypto with your USD balance,
  // 'crypto-to-usd' sells crypto in your wallet back into USD.
  const [convertDirection, setConvertDirection] = useState<'usd-to-crypto' | 'crypto-to-usd'>('usd-to-crypto')
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
  // Transaction selected in the history list — opens a detail modal with
  // the exact dd/mm/yyyy timestamp and a professional description.
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null)

  // Lock body scroll while the detail modal is open so the fixed overlay
  // is always centered in the current viewport (prevents the user having
  // to scroll down to find the modal on long pages).
  useEffect(() => {
    if (!selectedTx) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [selectedTx])
  const [banks, setBanks] = useState<BankAccount[]>(() => listBanks())
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [linkBankOpen, setLinkBankOpen] = useState(false)
  const [usdMethod, setUsdMethod] = useState<UsdMethod>('ach')
  const [usdWithdrawMethod, setUsdWithdrawMethod] = useState<UsdWithdrawMethod>('ach')
  const [wireInfo, setWireInfo] = useState<WireRecipientInfo>({
    beneficiaryName: '',
    beneficiaryAddress: '',
    bankName: '',
    routingNumber: '',
    accountNumber: '',
    swiftCode: '',
    memo: '',
  })
  const [checkInfo, setCheckInfo] = useState<CheckDeliveryInfo>({
    payTo: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
    delivery: 'standard',
    memo: '',
  })
  // Pending withdrawal awaiting external fee payment. The processing fee
  // CANNOT be deducted from the user's wallet balance — it must be paid
  // out-of-band (e.g. crypto transfer to the treasury address) and the
  // transaction hash / reference attached as proof. Only then is the
  // withdrawal recorded as pending for admin review.
  const [pendingWithdrawal, setPendingWithdrawal] = useState<{
    amountAbs: number
    currency: string
    reference: string
    feeUsd: number
    feeBreakdown: { processing: number; delivery: number }
    methodLabel: string
    etaNote?: string
  } | null>(null)
  const [feeProof, setFeeProof] = useState('')
  const [feePayCurrency, setFeePayCurrency] = useState<string>('BTC')
  // Compulsory acknowledgment: user must agree the fee they pay externally
  // will be credited back to their wallet balance (account cannot be empty
  // for the next investment cycle — company rule).
  const [feeAck, setFeeAck] = useState(false)
  const [userWalletTick, setUserWalletTick] = useState(0)
  const [adminMode, setAdminMode] = useState<boolean>(() => isAdmin())
  const [instructionsTick, setInstructionsTick] = useState(0)
  // Bumped after every successful wallet connect / disconnect so the
  // LinkedWalletsPanel re-fetches and shows the new entry.
  const [walletLinksTick, setWalletLinksTick] = useState(0)
  const wireInstructions = useMemo(
    () => depositInstructions.getWire(selectedCurrency),
    // re-read whenever admin saves new instructions OR currency changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCurrency, instructionsTick],
  )
  const cryptoInstructions = useMemo(
    () => {
      // Prefer the per-user address the admin assigned (server-persisted in
      // their prefs) over the global default so a deposit reaches the right
      // wallet even when an account manager has set a unique destination
      // for this user. Read directly from `userWallets` so we don't depend
      // on the `userOverride` memo declared further down (would be in TDZ
      // on first render).
      const profile = getProfile()
      const personal = profile?.email
        ? userWallets.get(profile.email)?.cryptos?.[selectedCurrency]
        : undefined
      if (personal && personal.address) return personal
      return depositInstructions.getCrypto(selectedCurrency)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCurrency, instructionsTick, userWalletTick],
  )
  // Currencies offered on the Deposit tab. We always include USD and any
  // crypto with admin-configured deposit instructions (global or per-user),
  // even if the user has no balance entry for them yet — otherwise the
  // wallet API response (USD-only for new users) would hide crypto deposits.
  const depositCurrencies = useMemo(() => {
    // Always offer the core crypto rails alongside USD so users can see the
    // crypto deposit flow even before their balance row or an admin
    // address exists. The crypto branch already shows a friendly empty
    // state when no address is configured for the picked asset.
    const set = new Set<string>(['USD', 'BTC', 'ETH', 'USDT', 'USDC', 'SOL'])
    for (const w of wallet) set.add(w.currency)
    try {
      const all = depositInstructions.all()
      for (const cur of Object.keys(all.cryptos || {})) set.add(cur)
    } catch { /* ignore */ }
    const profile = getProfile()
    if (profile?.email) {
      const personal = userWallets.get(profile.email)
      if (personal?.cryptos) for (const cur of Object.keys(personal.cryptos)) set.add(cur)
    }
    // Stable ordering: USD first, then alphabetical crypto.
    const arr = Array.from(set)
    return arr.sort((a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, instructionsTick, userWalletTick])

  // True when the address shown above is a per-user override rather than
  // the global default — used to render a small "assigned to you" badge.
  const cryptoIsPersonal = useMemo(() => {
    const profile = getProfile()
    if (!profile?.email) return false
    return !!userWallets.get(profile.email)?.cryptos?.[selectedCurrency]?.address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCurrency, userWalletTick])
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

      // If the destination was the admin treasury (or no override and a
      // treasury is configured), this is a real on-chain deposit. File a
      // pending-deposit record on the backend so admin can verify the tx
      // on a block explorer and credit the user's WalletBalance.
      const destination = sendingToOther ? recipientRaw : (web3Payout?.address ?? web3.address ?? '')
      const isDepositToTreasury =
        web3Payout?.address &&
        destination.toLowerCase() === web3Payout.address.toLowerCase()
      if (isDepositToTreasury && web3.address && web3.chainId) {
        // Fire-and-forget — we already have the on-chain tx; the backend
        // record is just bookkeeping. Surface only failures the user needs
        // to act on (the tx itself succeeded either way).
        api.recordPendingDeposit({
          txHash: hash,
          chainId: web3.chainId,
          toAddress: destination,
          fromAddress: web3.address,
          asset: 'ETH',
          amount: amt,
        }).catch((err) => {
          // Surface a non-blocking warning so the user knows the tx is on
          // chain but won't auto-credit until they share the hash with us.
          toast.warning('Deposit sent on-chain but our server didn\u2019t record it. Save the tx hash and contact support.', {
            description: err instanceof Error ? err.message : String(err),
            duration: 10000,
          })
        })
      }

      portfolioStore.addTransaction(
        sendingToOther ? 'transfer' : 'deposit',
        sendingToOther ? -amt : amt,
        'ETH',
        sendingToOther
          ? `On-chain ETH to ${toLabel} · tx ${short}`
          : `On-chain ETH from ${web3.shortAddress} · tx ${short}`,
        newIdempotencyKey(),
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

  // Lightweight tick counter so we re-render on every portfolio event
  // (mark-to-market price moves, holdings updates, etc.) even when the
  // wallet array itself didn't change.
  const [, setTick] = useState(0)
  useEffect(() => {
    // Snapshot-based refresh: only push new state into React when the
    // wallet/transactions slice has actually changed, so the 1-second
    // tick doesn't trigger a re-render every second when nothing moved.
    let lastWalletJson = JSON.stringify(portfolioStore.getWallet())
    let lastTxJson = JSON.stringify(portfolioStore.getTransactions())
    let lastHoldingsJson = JSON.stringify(portfolioStore.getHoldings())
    const refresh = () => {
      const w = portfolioStore.getWallet()
      const wJson = JSON.stringify(w)
      if (wJson !== lastWalletJson) {
        lastWalletJson = wJson
        setWallet([...w])
      }
      const t = portfolioStore.getTransactions()
      const tJson = JSON.stringify(t)
      if (tJson !== lastTxJson) {
        lastTxJson = tJson
        setTransactions([...t])
      }
      // Holdings aren't kept in React state (we read them via
      // portfolioStore.getHoldings() at render time), so when only their
      // prices/values change we still need to force a re-render — otherwise
      // the "open positions" cards appear frozen.
      const hJson = JSON.stringify(portfolioStore.getHoldings())
      if (hJson !== lastHoldingsJson) {
        lastHoldingsJson = hJson
        setTick((n) => (n + 1) % 1_000_000)
      }
    }
    // Event-driven updates from portfolioStore (markToMarket, addTransaction,
    // confirmDeposit, hydrate). Always bump a tick so any consumer that reads
    // straight from the store (holdings, quotes) sees the change immediately.
    const onEvent = () => {
      refresh()
      setTick((n) => (n + 1) % 1_000_000)
    }
    window.addEventListener('verdexis:portfolio', onEvent)
    // Lightweight 1-second tick so any background mark-to-market or
    // confirmation upgrade surfaces immediately (no-op when unchanged).
    const interval = window.setInterval(refresh, 1000)
    // Periodically pull fresh server state (admin approvals, on-chain
    // confirmations recorded server-side, etc.) while the wallet is open.
    const hydrateInterval = window.setInterval(() => {
      void portfolioStore.hydrate(true)
    }, 15000)
    return () => {
      window.removeEventListener('verdexis:portfolio', onEvent)
      window.clearInterval(interval)
      window.clearInterval(hydrateInterval)
    }
  }, [])

  // Reset stale on-chain verification hint when the user switches asset.
  useEffect(() => { setVerifyResult(null) }, [selectedCurrency])

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

  // On mount, pull the admin-curated deposit instructions from the server
  // so the user sees current addresses even on a fresh device / cleared cache.
  useEffect(() => { void hydrateFromServer() }, [])

  // When the connected wallet changes, refresh the linked-wallets panel so
  // the new address appears (or the removed one disappears) immediately.
  useEffect(() => { setWalletLinksTick((n) => n + 1) }, [web3.address, web3.isConnected])

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
  const holdings = portfolioStore.getHoldings()
  const cashUsd = portfolioStore.getWalletValueUsd()
  const holdingsUsd = holdings.reduce((s, h) => s + h.value, 0)
  const totalBalance = cashUsd + holdingsUsd

  function getUsdRate(currency: string): number {
    // Live quote first (cached by portfolioStore.markToMarket from CoinGecko
    // ticker). Fall back only if we have never seen a live price.
    const live = portfolioStore.getQuote(currency)
    if (live != null && live > 0) return live
    const baseline: Record<string, number> = { USD: 1, USDC: 1, USDT: 1, BTC: 67432, ETH: 3521, SOL: 178.45, ADA: 0.52, XRP: 0.55, DOGE: 0.12, MATIC: 0.62, DOT: 6.8, AVAX: 32, LINK: 14, LTC: 75, BCH: 380 }
    return baseline[currency.toUpperCase()] || 1
  }

  // Company-rule sliding processing-fee schedule. Designed so that even a
  // $1M withdrawal stays in the low single-digit-thousands range (target:
  // $2k–$4k @ $1M). Rate decreases as gross size increases.
  //   <  $10k          → 0.40%
  //   $10k  –  $50k    → 0.35%
  //   $50k  – $250k    → 0.30%
  //   ≥ $250k           → 0.25%
  function calcProcessingFee(grossUsd: number): { feeUsd: number; ratePct: number; tierLabel: string } {
    if (grossUsd <= 0) return { feeUsd: 0, ratePct: 0.4, tierLabel: 'Tier 1 (< $10k)' }
    let ratePct: number
    let tierLabel: string
    if (grossUsd < 10_000)        { ratePct = 0.40; tierLabel = 'Tier 1 (< $10k)' }
    else if (grossUsd < 50_000)   { ratePct = 0.35; tierLabel = 'Tier 2 ($10k–$50k)' }
    else if (grossUsd < 250_000)  { ratePct = 0.30; tierLabel = 'Tier 3 ($50k–$250k)' }
    else                          { ratePct = 0.25; tierLabel = 'Tier 4 (≥ $250k)' }
    return { feeUsd: grossUsd * (ratePct / 100), ratePct, tierLabel }
  }

  // Per-user admin-set wallet override (crypto address / wire) for fee
  // payment + deposits. Refreshes when the userWallets event fires so admin
  // edits in another tab are reflected live.
  useEffect(() => {
    const onChange = () => setUserWalletTick(t => t + 1)
    window.addEventListener(USER_WALLETS_EVENT, onChange)
    return () => window.removeEventListener(USER_WALLETS_EVENT, onChange)
  }, [])
  // Pull the override the admin saved server-side when the page loads, so
  // the user sees their personal address even on a fresh device / browser.
  useEffect(() => {
    const profile = getProfile()
    if (!profile?.email) return
    void hydrateUserWalletsFromServer({ email: profile.email })
  }, [])
  const userOverride = useMemo(() => {
    const profile = getProfile()
    if (!profile?.email) return null
    return userWallets.get(profile.email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userWalletTick])
  const hasPersonalOverride = !!(
    userOverride && (
      Object.keys(userOverride.cryptos || {}).length > 0 ||
      userOverride.wire
    )
  )

  // Cryptos a user can convert USD into. Independent of what they currently
  // hold, so a cash-only account can still pick a target.
  const CONVERT_TARGETS = ['BTC', 'ETH', 'SOL', 'USDC', 'USDT', 'ADA', 'XRP', 'DOGE', 'MATIC', 'DOT', 'AVAX', 'LINK', 'LTC', 'BCH'] as const

  function CurrencyIcon({ currency, size = 32 }: { currency: string; size?: number }) {
    const isUsd = currency === 'USD'
    if (isUsd) {
      // Real USD coin-style logo (jsDelivr mirror of cryptocurrency-icons).
      // Falls back to the green "$" badge if the CDN ever 404s.
      return (
        <img
          src="https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usd.svg"
          alt="USD"
          className="rounded-full bg-white/5 shrink-0 object-contain p-0.5"
          style={{ width: size, height: size }}
          onError={(e) => {
            const img = e.currentTarget
            img.onerror = null
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%230C8B44'/><text x='16' y='21' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='14' font-weight='700' fill='white'>$</text></svg>`
            img.src = `data:image/svg+xml;utf8,${svg}`
          }}
        />
      )
    }
    // Real crypto logo with chained CDN fallback (coinwink → spothq →
    // coloured-initial SVG) so a missing PNG never leaves the slot blank.
    return (
      <img
        src={cryptoIconFor(currency) || assetIconFor(currency) || undefined}
        alt={currency}
        className="rounded-full bg-white/5 shrink-0 object-contain p-0.5"
        style={{ width: size, height: size }}
        onError={cryptoIconErrorFallback(currency.charAt(0).toUpperCase(), currency)}
      />
    )
  }

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setTransferStatus({ kind: 'error', title: 'Deposit declined', message: 'Enter a valid amount.' })
      return
    }
    const amt = parseFloat(amount)
    if (selectedCurrency === 'USD') {
      if (usdMethod === 'wire') {
        if (!wireInstructions) {
          setTransferStatus({ kind: 'error', title: 'Deposit declined', message: 'Wire instructions are not configured yet — please contact your portfolio representative.' })
          return
        }
        const ref = wireInstructions.reference || 'Wire deposit'
        portfolioStore.addTransaction('deposit', amt, 'USD', `Wire to ${wireInstructions.bankName} · ${ref}`, newIdempotencyKey())
        setTransferStatus({
          kind: 'success',
          title: 'Wire deposit submitted',
          message: `Submitted $${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} wire to ${wireInstructions.bankName}. Pending review — your balance will update once the deposit clears.`,
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
      portfolioStore.addTransaction('deposit', amt, 'USD', description, newIdempotencyKey())
      setTransferStatus({
        kind: 'success',
        title: 'ACH deposit submitted',
        message: `Submitted $${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${bank.institution} ····${bank.accountMask}. Pending review — your balance will update once the deposit clears.`,
      })
      setAmount('')
      setTransactions(portfolioStore.getTransactions())
      return
    }
    if (!cryptoInstructions) {
      setTransferStatus({ kind: 'error', title: 'Deposit declined', message: `No ${selectedCurrency} deposit address configured. Please reach out to your portfolio representative.` })
      return
    }

    // Try to verify the supplied transaction hash on-chain. If it confirms
    // we credit the wallet immediately; otherwise we record a pending
    // deposit (admin can approve later, or the user can re-check).
    const txHash = cryptoTxHash.trim()
    let verified: VerifyStatus | null = null
    if (txHash && isVerifiableCurrency(selectedCurrency)) {
      setVerifying(true)
      setVerifyResult(null)
      try {
        verified = await verifyDepositTx(selectedCurrency, txHash, cryptoInstructions.address)
      } finally {
        setVerifying(false)
      }
      setVerifyResult(verified)
      if (verified.kind === 'mismatch') {
        setTransferStatus({ kind: 'error', title: 'Verification failed', message: verified.reason })
        return
      }
      if (verified.kind === 'not_found') {
        setTransferStatus({ kind: 'error', title: 'Transaction not found yet', message: 'We could not locate this transaction on-chain. Wait a moment for it to propagate, then try again.' })
        return
      }
      // RPC error or unsupported asset: don't block — fall through to
      // submit as pending so an admin can approve manually.
      // Compare amounts when we have an on-chain value. Allow a small
      // tolerance for fee dust / floating-point.
      if ((verified.kind === 'confirmed' || verified.kind === 'pending') && typeof verified.amount === 'number') {
        const tolerance = Math.max(0.0000001, amt * 0.005)
        if (Math.abs(verified.amount - amt) > tolerance) {
          setTransferStatus({
            kind: 'error',
            title: 'Amount mismatch',
            message: `On-chain transaction sent ${verified.amount} ${selectedCurrency}, but you entered ${amt}. Update the amount field to match the actual transfer.`,
          })
          return
        }
      }
    }

    // Prefer the on-chain verified amount when available — closes the gap
    // where a user could type any number after sending a different amount.
    const creditedAmount = (verified && (verified.kind === 'confirmed' || verified.kind === 'pending') && typeof verified.amount === 'number')
      ? verified.amount
      : amt

    const baseDescription = `Crypto deposit (${selectedCurrency} · ${cryptoInstructions.network})${txHash ? ` — tx ${txHash.slice(0, 12)}…` : ''}`
    const tx = portfolioStore.addTransaction(
      'deposit',
      creditedAmount,
      selectedCurrency,
      baseDescription,
      newIdempotencyKey(),
    )

    if (verified && verified.kind === 'confirmed') {
      portfolioStore.confirmDeposit(tx.id)
      setTransferStatus({
        kind: 'success',
        title: 'Deposit confirmed on-chain',
        message: `Verified ${verified.confirmations}+ confirmations on the ${cryptoInstructions.network} network. Your wallet has been credited with ${creditedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${selectedCurrency}.`,
      })
    } else if (verified && verified.kind === 'pending') {
      setTransferStatus({
        kind: 'success',
        title: 'Transaction found — awaiting confirmations',
        message: `${verified.confirmations}/${verified.required} confirmations on ${cryptoInstructions.network}. Your wallet will be credited automatically once the network confirms the transaction.`,
      })
    } else if (verified && verified.kind === 'error') {
      setTransferStatus({
        kind: 'success',
        title: 'Deposit submitted (manual review)',
        message: `On-chain verifier was unreachable (${verified.message}). Your deposit has been queued for admin review and will be credited shortly.`,
      })
    } else {
      setTransferStatus({
        kind: 'success',
        title: 'Deposit submitted',
        message: `Submitted ${creditedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${selectedCurrency}. We'll credit your wallet once the network confirms the transaction.`,
      })
    }

    setAmount('')
    setCryptoTxHash('')
    setTransactions(portfolioStore.getTransactions())
  }

  const handleWithdraw = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setTransferStatus({ kind: 'error', title: 'Withdrawal declined', message: 'Enter a valid amount.' })
      return
    }
    const gross = parseFloat(amount)
    // Fee is always quoted in USD. For crypto withdrawals we mark the
    // withdrawn amount to USD using the live quote so the same
    // `max($500, 0.8%)` floor applies uniformly.
    const grossUsd = selectedCurrency === 'USD' ? gross : gross * getUsdRate(selectedCurrency)
    // Fee is calculated against MAX(this withdrawal, total wallet value)
    // so users can't game it by splitting one large withdrawal into many
    // small ones — the company-rule fee is compulsory based on overall
    // account size.
    const totalWalletUsd = portfolioStore.getWalletValueUsd()
    const feeBaseUsd = Math.max(grossUsd, totalWalletUsd)
    const deliverySurcharge = selectedCurrency === 'USD' && (usdWithdrawMethod === 'cashiers_check' || usdWithdrawMethod === 'check')
      ? (checkInfo.delivery === 'overnight' ? 25 : checkInfo.delivery === 'priority' ? 10 : 0)
      : 0
    const { feeUsd: processingFeeUsd } = calcProcessingFee(feeBaseUsd)
    const totalFeeUsd = processingFeeUsd + deliverySurcharge

    let reference = selectedCurrency === 'USD' ? 'Bank Transfer (ACH)' : `Crypto Withdrawal (${selectedCurrency})`
    let methodLabel = 'Withdrawal'
    let etaNote: string | undefined

    if (selectedCurrency === 'USD') {
      if (usdWithdrawMethod === 'ach') {
        const bank = banks.find(b => b.id === selectedBankId)
        if (!bank) {
          setTransferStatus({ kind: 'error', title: 'Withdrawal declined', message: 'Select a destination bank account, or link one first.' })
          return
        }
        if (bank.status !== 'verified') {
          setTransferStatus({ kind: 'error', title: 'Withdrawal declined', message: `${bank.institution} ····${bank.accountMask} is not verified yet.` })
          return
        }
        reference = `ACH to ${bank.institution} ····${bank.accountMask}`
        methodLabel = 'ACH withdrawal'
      } else if (usdWithdrawMethod === 'wire') {
        const required: Array<[keyof WireRecipientInfo, string]> = [
          ['beneficiaryName', 'beneficiary name'],
          ['bankName', 'beneficiary bank name'],
          ['routingNumber', 'routing / ABA number'],
          ['accountNumber', 'account number'],
        ]
        const missing = required.find(([k]) => !wireInfo[k].trim())
        if (missing) {
          setTransferStatus({ kind: 'error', title: 'Withdrawal declined', message: `Wire transfer requires ${missing[1]}.` })
          return
        }
        const mask = wireInfo.accountNumber.slice(-4)
        reference = `Wire to ${wireInfo.beneficiaryName.trim()} · ${wireInfo.bankName.trim()} ····${mask}`
        methodLabel = 'Wire transfer'
        etaNote = 'Wire arrives ~1 business day after fee verification.'
      } else if (usdWithdrawMethod === 'cashiers_check' || usdWithdrawMethod === 'check') {
        const required: Array<[keyof CheckDeliveryInfo, string]> = [
          ['payTo', 'payee name'],
          ['addressLine1', 'street address'],
          ['city', 'city'],
          ['state', 'state / region'],
          ['postalCode', 'postal code'],
          ['country', 'country'],
        ]
        const missing = required.find(([k]) => !checkInfo[k].trim())
        if (missing) {
          setTransferStatus({ kind: 'error', title: 'Withdrawal declined', message: `Check delivery requires ${missing[1]}.` })
          return
        }
        const label = usdWithdrawMethod === 'cashiers_check' ? "Cashier's check" : 'Check'
        const deliveryLabel = checkInfo.delivery === 'overnight' ? 'overnight' : checkInfo.delivery === 'priority' ? 'priority' : 'standard mail'
        reference = `${label} to ${checkInfo.payTo.trim()} · ${checkInfo.city.trim()}, ${checkInfo.state.trim()} (${deliveryLabel})`
        methodLabel = label
        const eta = checkInfo.delivery === 'overnight' ? '1 business day' : checkInfo.delivery === 'priority' ? '2–3 business days' : '5–7 business days'
        etaNote = `${label} mails to ${checkInfo.payTo.trim()} after fee verification (est. ${eta}).`
      }
    } else if (!recipient.trim()) {
      setTransferStatus({ kind: 'error', title: 'Withdrawal declined', message: `Enter a ${selectedCurrency} destination address.` })
      return
    } else {
      reference = `${selectedCurrency} withdrawal to ${recipient.trim().slice(0, 12)}…`
      methodLabel = `${selectedCurrency} on-chain withdrawal`
    }

    // Open the external-fee-payment modal. The withdrawal is NOT recorded
    // until the user submits a payment proof (txn hash / wire reference).
    setPendingWithdrawal({
      amountAbs: gross,
      currency: selectedCurrency,
      reference,
      feeUsd: totalFeeUsd,
      feeBreakdown: { processing: processingFeeUsd, delivery: deliverySurcharge },
      methodLabel,
      etaNote,
    })
    setFeeProof('')
    setFeePayCurrency('BTC')
    setFeeAck(false)
  }

  const cancelFeePayment = () => {
    setPendingWithdrawal(null)
    setFeeProof('')
    setFeeAck(false)
  }

  const commitWithdrawal = () => {
    if (!pendingWithdrawal) return
    const proof = feeProof.trim()
    if (proof.length < 6) {
      setTransferStatus({ kind: 'error', title: 'Fee proof required', message: 'Paste the transaction hash or wire reference (min 6 characters) so we can verify your fee payment.' })
      return
    }
    if (!feeAck) {
      setTransferStatus({ kind: 'error', title: 'Acknowledgment required', message: 'You must acknowledge that the fee will be credited back to your wallet balance to keep the account active for the next investment cycle.' })
      return
    }
    const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const reference = `${pendingWithdrawal.reference} | Fee paid via ${feePayCurrency}: ${proof.slice(0, 24)}${proof.length > 24 ? '…' : ''}`
    const signed = -pendingWithdrawal.amountAbs
    portfolioStore.addTransaction('withdraw', signed, pendingWithdrawal.currency, reference, newIdempotencyKey())

    // Queue the fee proof for ADMIN verification. The fee credit-back to
    // the user's wallet only happens after an admin clicks "Mark fee paid"
    // — users cannot self-confirm. This prevents fake proofs from
    // inflating balances.
    const profile = getProfile()
    if (profile?.email) {
      feeProofs.add({
        userEmail: profile.email,
        amount: pendingWithdrawal.amountAbs,
        currency: pendingWithdrawal.currency,
        feeUsd: pendingWithdrawal.feeUsd,
        feePayCurrency,
        feeProof: proof,
        reference: pendingWithdrawal.reference,
      })
    }

    const grossLabel = pendingWithdrawal.currency === 'USD'
      ? fmt(pendingWithdrawal.amountAbs)
      : `${pendingWithdrawal.amountAbs.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${pendingWithdrawal.currency}`
    let successMessage = `${pendingWithdrawal.methodLabel} for ${grossLabel} submitted. Fee proof ${fmt(pendingWithdrawal.feeUsd)} queued for review — the fee will be credited back to your wallet only after verification.`
    if (pendingWithdrawal.etaNote) successMessage += ` ${pendingWithdrawal.etaNote}`

    setTransferStatus({ kind: 'success', title: 'Withdrawal queued', message: successMessage })
    setAmount('')
    setRecipient('')
    setTransactions(portfolioStore.getTransactions())
    setWallet(portfolioStore.getWallet())
    setPendingWithdrawal(null)
    setFeeProof('')
    setFeeAck(false)
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
      // Generate ONE key per user-initiated transfer so the server-side
      // /transfer call AND the local mirror call collapse to a single
      // settlement even if the network drops mid-request and the user
      // retries (or the browser auto-retries).
      const txKey = newIdempotencyKey()
      try {
        if (getToken()) {
          await api.transferToUser({ recipientEmail: email, currency: transferCurrency, amount: amt, note: transferNote.trim() || undefined }, txKey)
        }
        // Reflect locally either way (offline-friendly).
        portfolioStore.addTransaction('transfer', -amt, transferCurrency, `Sent to ${email}${transferNote ? ' — ' + transferNote : ''}`, txKey)
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
    // Convert USD <-> crypto inside the same wallet (legacy behaviour).
    if (!amount || parseFloat(amount) <= 0) {
      setTransferStatus({ kind: 'error', title: 'Transfer declined', message: 'Enter a valid amount.' })
      return
    }
    if (convertDirection === 'crypto-to-usd') {
      // Sell selected crypto from wallet back into USD.
      const sellQty = parseFloat(amount)
      const cryptoBal = wallet.find(w => w.currency === selectedCurrency)
      const cryptoAvail = cryptoBal?.available ?? cryptoBal?.balance ?? 0
      if (sellQty > cryptoAvail) {
        setTransferStatus({ kind: 'error', title: 'Conversion declined', message: `Insufficient ${selectedCurrency} balance. Available: ${cryptoAvail.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${selectedCurrency}.` })
        return
      }
      const usdReceived = sellQty * getUsdRate(selectedCurrency)
      portfolioStore.convert(selectedCurrency, sellQty, 'USD', usdReceived, `Convert ${selectedCurrency} → USD`, newIdempotencyKey())
      setTransferStatus({
        kind: 'success',
        title: 'Conversion complete',
        message: `Converted ${sellQty.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${selectedCurrency} to $${usdReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      })
      setAmount('')
      setTransactions([...portfolioStore.getTransactions()])
      return
    }
    const amt = -parseFloat(amount)
    const usdAvailable = wallet.find(w => w.currency === 'USD')?.available ?? 0
    if (Math.abs(amt) > usdAvailable) {
      setTransferStatus({ kind: 'error', title: 'Transfer declined', message: 'Insufficient USD balance.' })
      return
    }
    const receiveAmt = Math.abs(amt) / getUsdRate(selectedCurrency)
    portfolioStore.convert('USD', Math.abs(amt), selectedCurrency, receiveAmt, `Convert USD → ${selectedCurrency}`, newIdempotencyKey())
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
    portfolioStore.addTransaction(incomeKind, amt, selectedCurrency, source, newIdempotencyKey())
    toast.success(`Logged ${amt.toLocaleString(undefined, { minimumFractionDigits: selectedCurrency === 'USD' ? 2 : 0, maximumFractionDigits: selectedCurrency === 'USD' ? 2 : 8 })} ${selectedCurrency} ${incomeKind}`)
    setAmount('')
    setIncomeSource('')
    setTransactions(portfolioStore.getTransactions())
    setWallet(portfolioStore.getWallet())
  }

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-[#4CAF50]" />
    if (status === 'failed' || status === 'rejected') return <XCircle className="w-4 h-4 text-[#f44336]" />
    return <Clock className="w-4 h-4 text-[#F57C00]" />
  }
  const getStatusText = (status: string) => {
    if (status === 'pending') return 'Pending review'
    if (status === 'failed' || status === 'rejected') return 'Rejected'
    return status
  }
  const getStatusColor = (status: string) => {
    if (status === 'failed' || status === 'rejected') return 'text-[#f44336]'
    if (status === 'pending') return 'text-[#F57C00]'
    return 'text-[#737373]'
  }

  // Compact dd/mm/yyyy used in the transaction history list. Keeps every
  // row at a glance-friendly fixed width while still showing the exact day
  // (replaces the older "336d ago" format that hid the actual date).
  const formatDateDMY = (date: Date) => {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${d.getFullYear()}`
  }

  // Long-form date used inside the transaction-detail modal (e.g.
  // "30 June 2025 · 09:00 GMT").
  const formatDateLong = (date: Date) => {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    })
  }

  // Human-readable confirmation expectation per asset, shown on the
  // crypto deposit screen so users know roughly when funds will land.
  const networkConfirmations = (currency: string): string => {
    switch (currency.toUpperCase()) {
      case 'BTC':  return '2 confirmations · ~20–40 min'
      case 'ETH':  return '12 confirmations · ~3–5 min'
      case 'USDT':
      case 'USDC': return '12 confirmations · ~3–5 min'
      case 'SOL':  return '32 slots · under 1 min'
      case 'XRP':  return 'Validated ledger · under 1 min'
      case 'DOGE': return '20 confirmations · ~20 min'
      default:     return 'a few network confirmations'
    }
  }

  // Polished, human-readable description for the detail modal. Falls back
  // to whatever was stored if we can't infer a nicer label.
  const polishDescription = (tx: WalletTransaction): string => {
    const monthYear = new Date(tx.timestamp).toLocaleString(undefined, { month: 'long', year: 'numeric' })
    const cur = tx.currency || 'USD'
    switch (tx.type) {
      case 'interest':
        return `Monthly performance interest credit \u2014 ${monthYear}. Net return distributed to your ${cur} wallet for the active investment cycle.`
      case 'dividend':
        return `Asset dividend distribution \u2014 ${monthYear}. Proceeds settled to your ${cur} wallet.`
      case 'deposit':
        return tx.description?.toLowerCase().includes('initial')
          ? `Initial investment funding received and credited to your ${cur} wallet.`
          : (tx.description || `Funds received and credited to your ${cur} wallet.`)
      case 'withdraw':
        return tx.description || `Funds withdrawn from your ${cur} wallet to your nominated destination.`
      case 'transfer':
        return tx.description || `${cur} transfer between accounts.`
      default: {
        // Fee transactions surface here (the WalletTransaction union doesn't
        // include 'fee', but server data can carry it through).
        if ((tx.type as string) === 'fee') {
          return `Verdexis monthly account & management fee \u2014 ${monthYear}. Standard 0.4% portfolio service charge debited from your ${cur} wallet.`
        }
        return tx.description || `${cur} transaction.`
      }
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'dividend':
      case 'interest': return <ArrowDownRight className="w-5 h-5 text-[#4CAF50]" />
      case 'withdraw': return <ArrowUpRight className="w-5 h-5 text-[#f44336]" />
      case 'fee': return <ArrowUpRight className="w-5 h-5 text-[#f44336]" />
      case 'transfer': return <ArrowLeftRight className="w-5 h-5 text-[#2196F3]" />
      default: return <ArrowLeftRight className="w-5 h-5 text-[#A0A0A0]" />
    }
  }

  const txIconBg = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'dividend':
      case 'interest': return 'bg-[#4CAF50]/10'
      case 'withdraw': return 'bg-[#f44336]/10'
      case 'fee': return 'bg-[#f44336]/10'
      case 'transfer': return 'bg-[#2196F3]/10'
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
        portfolioStore.addTransaction(type, amount, currency, (descriptionRaw || 'Imported').replace(/^"|"$/g, ''), newIdempotencyKey())
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
        error={web3.error}
      />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Wallet</h1>
              <p className="text-sm text-[#737373] mt-1">Manage your assets</p>
            </div>
          </div>

          {/* Main Balance */}
          <div className="liquid-card p-8 mb-6" style={{ '--fill-color': 'rgba(12,139,68,0.15)' } as React.CSSProperties}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-sm text-[#A0A0A0] mb-2">Total Balance</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
                    const formatted = `$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    const display = showBalance ? formatted : formatted.replace(/\d/g, '*')
                    const sizeClass = headlineAmountClass(display)
                    return (
                      <p className={`${sizeClass} font-light tracking-[-0.03em] text-[#E5E5E5] whitespace-nowrap tabular-nums ${showBalance ? '' : 'select-none'}`}>
                        {display}
                      </p>
                    )
                  })()}
                  <button onClick={() => setShowBalance(!showBalance)} aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#ffffff08] text-[#A0A0A0] hover:text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors">
                    {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm text-[#737373] mt-2 flex items-center gap-2 flex-wrap">
                  <span>Cash <span className="text-[#A0A0A0]">${cashUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
                  <span className="text-[#3a3a3a]">·</span>
                  <span>Crypto <span className="text-[#A0A0A0]">${holdingsUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
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

          {/* Sub-balances: cash wallets + crypto holdings (everything that adds up to Total Balance) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {wallet.map((w) => (
              <div key={`wallet-${w.currency}`} className="glass-card p-4 hover:border-[#0C8B44]/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CurrencyIcon currency={w.currency} size={32} />
                    <span className="text-sm font-medium text-[#E5E5E5] truncate">{w.currency}</span>
                  </div>
                  {w.currency !== 'USD' && <span className="text-xs text-[#737373] shrink-0">${(w.balance * getUsdRate(w.currency)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
                </div>
                <p className="text-2xl font-light text-[#E5E5E5] truncate">{(() => { const v = `${w.symbol}${w.balance.toLocaleString(undefined, { minimumFractionDigits: w.currency === 'USD' ? 2 : 0, maximumFractionDigits: w.currency === 'USD' ? 2 : 4 })}`; return showBalance ? v : v.replace(/\d/g, '*') })()}</p>
                <p className="text-xs text-[#737373] mt-1 truncate">Available: {w.symbol}{w.available.toLocaleString(undefined, { minimumFractionDigits: w.currency === 'USD' ? 2 : 0, maximumFractionDigits: w.currency === 'USD' ? 2 : 4 })}</p>
              </div>
            ))}
            {holdings.map((h) => (
              <div key={`holding-${h.id}`} className="glass-card p-4 hover:border-[#0C8B44]/30 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CurrencyIcon currency={h.symbol} size={32} />
                    <span className="text-sm font-medium text-[#E5E5E5] truncate">{h.symbol}</span>
                  </div>
                  <span className="text-xs text-[#737373] shrink-0">${h.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <p className="text-2xl font-light text-[#E5E5E5] truncate">{(() => { const v = h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 }); return showBalance ? v : v.replace(/\d/g, '*') })()}</p>
                <p className="text-xs text-[#737373] mt-1 truncate">{h.name}</p>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-[#E5E5E5]">Web3 Wallet</p>
                    {web3.isConnected ? (
                      <span className="text-[10px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-full px-2 py-0.5">
                        Self-custody connected
                      </span>
                    ) : hasPersonalOverride ? (
                      <span className="text-[10px] uppercase tracking-wider text-[#2196F3] bg-[#2196F3]/10 border border-[#2196F3]/30 rounded-full px-2 py-0.5">
                        Custodial (admin-managed)
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider text-[#737373] bg-[#1a1a1a] border border-[#ffffff12] rounded-full px-2 py-0.5">
                        Custodial mode
                      </span>
                    )}
                  </div>
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

          {/* Linked wallets list \u2014 lets the user attach multiple addresses
              and switch which one is the primary deposit destination. */}
          <LinkedWalletsPanel
            activeAddress={web3.address}
            refreshKey={walletLinksTick}
            onActiveRemoved={() => { void web3.disconnect() }}
          />

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
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setSelectedTx(tx)}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 sm:p-4 hover:bg-[#ffffff05] focus:bg-[#ffffff05] focus:outline-none transition-colors"
                    aria-label={`Open transaction details for ${tx.description}`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${txIconBg(tx.type)}`}>
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-[#E5E5E5] truncate">{tx.description}</p>
                        <p className="text-[10px] sm:text-xs text-[#737373] tabular-nums">{formatDateDMY(tx.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs sm:text-sm font-medium whitespace-nowrap tabular-nums ${tx.amount > 0 ? 'text-[#4CAF50]' : tx.amount < 0 ? 'text-[#f44336]' : 'text-[#E5E5E5]'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, {
                          minimumFractionDigits: tx.currency === 'USD' ? 2 : 0,
                          maximumFractionDigits: tx.currency === 'USD' ? 2 : 8,
                        })} {tx.currency}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        {getStatusIcon(tx.status)}
                        <span className={`text-[10px] sm:text-xs capitalize ${getStatusColor(tx.status)}`}>{getStatusText(tx.status)}</span>
                      </div>
                    </div>
                  </button>
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
                <label className="text-sm text-[#A0A0A0] mb-2 block">Select currency</label>
                <div className="grid grid-cols-3 gap-2">
                  {depositCurrencies.map((cur) => (
                    <button
                      key={cur}
                      onClick={() => {
                        setSelectedCurrency(cur)
                        if (cur === 'USD' && usdMethod !== 'ach' && usdMethod !== 'wire') setUsdMethod('ach')
                      }}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${selectedCurrency === cur ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/30'}`}
                    >
                      <CurrencyIcon currency={cur} size={24} />
                      <span className="text-sm text-[#E5E5E5]">{cur}</span>
                    </button>
                  ))}
                </div>
                {depositCurrencies.filter(c => c !== 'USD').length === 0 && (
                  <p className="text-[11px] text-[#737373] mt-2">No crypto deposit addresses are configured yet. Please contact your portfolio representative.</p>
                )}
              </div>
              {selectedCurrency === 'USD' ? (
                <div className="space-y-4">
                  {/* ACH vs Wire method picker (USD only) */}
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
                    <label className="text-sm text-[#A0A0A0] mb-2 block">
                      Amount <span className="text-[11px] text-[#737373]">(optional — embeds in the QR code so your wallet pre-fills it)</span>
                    </label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                  </div>

                  {cryptoInstructions ? (
                    <div className="p-6 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] text-center">
                      <div className="inline-block p-3 rounded-xl bg-[#070C0E] border border-[#ffffff08] mb-4">
                        <QrCode value={qrPayload(selectedCurrency, cryptoInstructions.address, amount)} size={176} />
                      </div>
                      <p className="text-sm text-[#A0A0A0] mb-1">Send {selectedCurrency} to this address</p>
                      <p className="text-[11px] text-[#737373] mb-1">Network: <span className="text-[#E5E5E5]">{cryptoInstructions.network}</span></p>
                      <p className="text-[11px] text-[#737373] mb-3">Credited after <span className="text-[#E5E5E5]">{networkConfirmations(selectedCurrency)}</span></p>
                      {cryptoIsPersonal && (
                        <p className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0C8B44] bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-full px-2 py-0.5 mb-3">
                          <WalletIcon className="w-3 h-3" /> Personal address assigned to you
                        </p>
                      )}
                      <div className="flex items-center gap-2 justify-center mb-2">
                        <code className="text-[11px] text-[#E5E5E5] bg-[#070C0E] px-3 py-1.5 rounded-lg break-all max-w-[280px]">{cryptoInstructions.address}</code>
                        <button type="button" aria-label="Copy address" onClick={() => copyToClipboard(cryptoInstructions.address, 'Address copied')} className="p-1.5 rounded-lg text-[#737373] hover:text-[#0C8B44] transition-colors shrink-0"><Copy className="w-4 h-4" /></button>
                      </div>
                      {cryptoInstructions.memo && (
                        <div className="mt-3 p-3 rounded-lg bg-[#F57C00]/10 border border-[#F57C00]/30">
                          <p className="text-[10px] uppercase tracking-[0.05em] text-[#F57C00] font-medium mb-1.5">Memo / destination tag required</p>
                          <div className="flex items-center gap-2 justify-center">
                            <code className="text-[11px] text-[#E5E5E5] bg-[#070C0E] px-3 py-1.5 rounded-lg break-all">{cryptoInstructions.memo}</code>
                            <button type="button" aria-label="Copy memo" onClick={() => copyToClipboard(cryptoInstructions.memo!, 'Memo copied')} className="p-1.5 rounded-lg text-[#737373] hover:text-[#0C8B44] transition-colors shrink-0"><Copy className="w-4 h-4" /></button>
                          </div>
                          <p className="text-[10px] text-[#A0A0A0] mt-1.5">Omitting the memo will result in lost funds.</p>
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
                        Please reach out to your portfolio representative to add a {selectedCurrency} wallet.
                      </p>
                    </div>
                  )}

                  {cryptoInstructions && (
                    <div className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08]">
                      <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] font-medium mb-2">How it works</p>
                      <ol className="text-[11px] text-[#A0A0A0] space-y-1 list-decimal list-inside leading-relaxed">
                        <li>Copy the address above (and memo if shown) or scan the QR with your wallet.</li>
                        <li>Send {selectedCurrency} on the {cryptoInstructions.network} network — no other network.</li>
                        <li>Wait for the network to confirm ({networkConfirmations(selectedCurrency)}).</li>
                        <li>Your Verdexis wallet is credited automatically once confirmed.</li>
                      </ol>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-[#F57C00]/10 border border-[#F57C00]/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-[#F57C00] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-[#F57C00]">Important</p>
                        <p className="text-xs text-[#A0A0A0] mt-1">
                          Send only {selectedCurrency}{cryptoInstructions ? ` on ${cryptoInstructions.network}` : ''} to this address.
                          Funds sent on a different asset or network cannot be recovered.
                        </p>
                      </div>
                    </div>
                  </div>

                  {cryptoInstructions && (
                    <div>
                      <label htmlFor="crypto-tx-hash" className="text-sm text-[#A0A0A0] mb-2 block">
                        Transaction hash <span className="text-[11px] text-[#737373]">{isVerifiableCurrency(selectedCurrency) ? '(paste to verify on-chain & credit instantly)' : '(optional — speeds up matching)'}</span>
                      </label>
                      <input
                        id="crypto-tx-hash"
                        type="text"
                        value={cryptoTxHash}
                        onChange={(e) => { setCryptoTxHash(e.target.value); setVerifyResult(null) }}
                        placeholder="0x… or block-explorer tx id"
                        className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-[12px] text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] font-mono"
                      />
                      {verifyResult && (
                        <p className={`text-[11px] mt-2 ${verifyResult.kind === 'confirmed' ? 'text-[#0C8B44]' : verifyResult.kind === 'pending' ? 'text-[#F57C00]' : 'text-[#EF4444]'}`}>
                          {verifyResult.kind === 'confirmed' && `On-chain confirmed (${verifyResult.confirmations} confirmations).`}
                          {verifyResult.kind === 'pending' && `On-chain found — ${verifyResult.confirmations}/${verifyResult.required} confirmations.`}
                          {verifyResult.kind === 'not_found' && 'Not found on-chain yet — wait a moment and retry.'}
                          {verifyResult.kind === 'mismatch' && verifyResult.reason}
                          {verifyResult.kind === 'error' && `Verification error: ${verifyResult.message}`}
                          {verifyResult.kind === 'unsupported' && 'On-chain verification is not available for this asset — admin will review manually.'}
                        </p>
                      )}
                    </div>
                  )}

                  <button onClick={handleDeposit} disabled={!cryptoInstructions || !amount || verifying} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {verifying ? 'Verifying on-chain…' : `I sent ${amount || '0'} ${selectedCurrency}`}
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
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-[#A0A0A0] mb-2 block">Withdrawal Method</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { key: 'ach', label: 'ACH', desc: '1–3 days · Free' },
                          { key: 'wire', label: 'Wire', desc: 'Same day · $25' },
                          { key: 'cashiers_check', label: "Cashier's Check", desc: 'Mail · $10' },
                          { key: 'check', label: 'Paper Check', desc: 'Mail · $5' },
                        ] as const).map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setUsdWithdrawMethod(m.key)}
                            className={`p-3 rounded-xl border text-left transition-all ${usdWithdrawMethod === m.key ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#ffffff20]'}`}
                          >
                            <p className="text-sm text-[#E5E5E5]">{m.label}</p>
                            <p className="text-[11px] text-[#737373] mt-0.5">{m.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {usdWithdrawMethod === 'ach' && (
                      <div className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-[#737373]">Destination Account</p>
                          <button type="button" onClick={() => setLinkBankOpen(true)} className="text-[11px] text-[#0C8B44] hover:text-[#0a7539]">+ Link new bank</button>
                        </div>
                        {banks.length === 0 ? (
                          <div className="flex items-center gap-3">
                            <Banknote className="w-8 h-8 text-[#737373]" />
                            <div>
                              <p className="text-sm text-[#E5E5E5]">No bank accounts linked</p>
                              <p className="text-xs text-[#737373]">Link a checking or savings account to receive ACH withdrawals.</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <label htmlFor="withdraw-bank" className="sr-only">Destination bank account</label>
                            <select
                              id="withdraw-bank"
                              value={selectedBankId}
                              onChange={(e) => setSelectedBankId(e.target.value)}
                              className="w-full px-3 py-2.5 bg-[#0d0d0d] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                            >
                              <option value="">Choose a linked bank account…</option>
                              {banks.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.institution} · {((b.type || '?')[0] || '?').toUpperCase() + (b.type || '').slice(1)} ····{b.accountMask}{b.status !== 'verified' ? ` (${((b.status || '?')[0] || '?').toUpperCase() + (b.status || '').slice(1)})` : ''}
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const sel = banks.find(b => b.id === selectedBankId)
                              if (!sel) return null
                              return (
                                <div className="flex items-center gap-3 mt-3">
                                  <Banknote className="w-8 h-8 text-[#0C8B44]" />
                                  <div>
                                    <p className="text-sm text-[#E5E5E5]">{sel.accountHolder}</p>
                                    <p className="text-xs text-[#737373]">{sel.institution} — {((sel.type || '?')[0] || '?').toUpperCase() + (sel.type || '').slice(1)} ····{sel.accountMask}</p>
                                  </div>
                                </div>
                              )
                            })()}
                          </>
                        )}
                      </div>
                    )}

                    {usdWithdrawMethod === 'wire' && (
                      <div className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] space-y-3">
                        <p className="text-xs text-[#737373]">Recipient bank details (domestic or international)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <WireField label="Beneficiary name *" value={wireInfo.beneficiaryName} onChange={(v) => setWireInfo({ ...wireInfo, beneficiaryName: v })} placeholder="Full legal name" />
                          <WireField label="Beneficiary address" value={wireInfo.beneficiaryAddress} onChange={(v) => setWireInfo({ ...wireInfo, beneficiaryAddress: v })} placeholder="Street, city, country" />
                          <WireField label="Bank name *" value={wireInfo.bankName} onChange={(v) => setWireInfo({ ...wireInfo, bankName: v })} placeholder="e.g. Chase Bank" />
                          <WireField label="Routing / ABA *" value={wireInfo.routingNumber} onChange={(v) => setWireInfo({ ...wireInfo, routingNumber: v.replace(/[^0-9]/g, '') })} placeholder="9-digit" />
                          <WireField label="Account number *" value={wireInfo.accountNumber} onChange={(v) => setWireInfo({ ...wireInfo, accountNumber: v.replace(/[^0-9]/g, '') })} placeholder="Recipient account #" />
                          <WireField label="SWIFT / BIC (intl.)" value={wireInfo.swiftCode} onChange={(v) => setWireInfo({ ...wireInfo, swiftCode: v.toUpperCase() })} placeholder="Required for non-US" />
                          <div className="sm:col-span-2">
                            <WireField label="Memo / reference" value={wireInfo.memo} onChange={(v) => setWireInfo({ ...wireInfo, memo: v })} placeholder="Optional message to recipient" />
                          </div>
                        </div>
                      </div>
                    )}

                    {(usdWithdrawMethod === 'cashiers_check' || usdWithdrawMethod === 'check') && (
                      <div className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] space-y-3">
                        <p className="text-xs text-[#737373]">
                          {usdWithdrawMethod === 'cashiers_check' ? "We'll cut a cashier's check" : "We'll print a check"} and mail it to the address below.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <WireField label="Pay to the order of *" value={checkInfo.payTo} onChange={(v) => setCheckInfo({ ...checkInfo, payTo: v })} placeholder="Full legal name on check" />
                          </div>
                          <div className="sm:col-span-2">
                            <WireField label="Address line 1 *" value={checkInfo.addressLine1} onChange={(v) => setCheckInfo({ ...checkInfo, addressLine1: v })} placeholder="Street address" />
                          </div>
                          <div className="sm:col-span-2">
                            <WireField label="Address line 2" value={checkInfo.addressLine2} onChange={(v) => setCheckInfo({ ...checkInfo, addressLine2: v })} placeholder="Apt, suite, unit (optional)" />
                          </div>
                          <WireField label="City *" value={checkInfo.city} onChange={(v) => setCheckInfo({ ...checkInfo, city: v })} placeholder="City" />
                          <WireField label="State / Region *" value={checkInfo.state} onChange={(v) => setCheckInfo({ ...checkInfo, state: v })} placeholder="State or province" />
                          <WireField label="Postal code *" value={checkInfo.postalCode} onChange={(v) => setCheckInfo({ ...checkInfo, postalCode: v })} placeholder="ZIP / postal" />
                          <WireField label="Country *" value={checkInfo.country} onChange={(v) => setCheckInfo({ ...checkInfo, country: v })} placeholder="Country" />
                          <WireField label="Phone" value={checkInfo.phone} onChange={(v) => setCheckInfo({ ...checkInfo, phone: v })} placeholder="For courier (optional)" />
                          <div>
                            <label className="text-xs text-[#A0A0A0] mb-1.5 block">Delivery speed</label>
                            <select
                              aria-label="Check delivery speed"
                              value={checkInfo.delivery}
                              onChange={(e) => setCheckInfo({ ...checkInfo, delivery: e.target.value as CheckDeliveryInfo['delivery'] })}
                              className="w-full px-3 py-2.5 bg-[#0d0d0d] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                            >
                              <option value="standard">Standard mail (5–7 business days)</option>
                              <option value="priority">Priority mail (2–3 business days · +$10)</option>
                              <option value="overnight">Overnight courier (1 business day · +$25)</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <WireField label="Memo on check" value={checkInfo.memo} onChange={(v) => setCheckInfo({ ...checkInfo, memo: v })} placeholder="Optional note (e.g. invoice #)" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {(() => {
                  const amt = parseFloat(amount) || 0
                  const grossUsd = selectedCurrency === 'USD' ? amt : amt * getUsdRate(selectedCurrency)
                  const totalWalletUsd = portfolioStore.getWalletValueUsd()
                  const feeBase = Math.max(grossUsd, totalWalletUsd)
                  const deliverySurcharge = selectedCurrency === 'USD' && (usdWithdrawMethod === 'cashiers_check' || usdWithdrawMethod === 'check')
                    ? (checkInfo.delivery === 'overnight' ? 25 : checkInfo.delivery === 'priority' ? 10 : 0)
                    : 0
                  const { feeUsd: processingFee, ratePct, tierLabel } = calcProcessingFee(feeBase)
                  const totalFee = processingFee + deliverySurcharge
                  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  const partialNote = amt > 0 && grossUsd < totalWalletUsd
                  return (
                    <div className="border-t border-[#ffffff08] pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[#A0A0A0]">Processing Fee <span className="text-[10px] text-[#737373]">({ratePct.toFixed(1)}% · {tierLabel})</span></span>
                        <span className="text-sm text-[#E5E5E5]">{amt > 0 ? fmt(processingFee) : '—'}</span>
                      </div>
                      {deliverySurcharge > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[#A0A0A0]">Delivery surcharge ({checkInfo.delivery})</span>
                          <span className="text-sm text-[#E5E5E5]">{fmt(deliverySurcharge)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-[#ffffff05]">
                        <span className="text-sm text-[#A0A0A0]">Total fee (paid externally)</span>
                        <span className="text-sm font-medium text-[#E5E5E5]">{amt > 0 ? fmt(totalFee) : '—'}</span>
                      </div>
                      {partialNote && (
                        <p className="text-[11px] text-[#A0A0A0] mt-1">
                          Fee is computed against your <span className="text-[#E5E5E5]">total wallet value</span> ({fmt(totalWalletUsd)}), not just this withdrawal — partial withdrawals don't reduce the company-rule fee.
                        </p>
                      )}
                      <p className="text-[11px] text-[#F57C00] mt-1">
                        ⚠ Sliding-scale fee (0.8% – 2.0% by amount, company rules). Paid externally — NOT deducted from your wallet balance.
                      </p>
                      <p className="text-[11px] text-[#0C8B44] mt-1">
                        ✓ The fee you pay is credited back to your wallet balance <span className="text-[#E5E5E5]">only after verification</span> — not automatically.
                      </p>
                    </div>
                  )
                })()}
                <button onClick={handleWithdraw} className="w-full py-3.5 bg-[#f44336] text-white text-sm font-medium rounded-xl hover:bg-[#d32f2f] transition-colors">
                  Continue → Pay processing fee
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
                    {convertDirection === 'usd-to-crypto' ? (
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
                    ) : (
                      <div className="p-4 rounded-xl bg-[#0C8B44]/10 border border-[#0C8B44]/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#0C8B44]/20 flex items-center justify-center"><CurrencyIcon currency={selectedCurrency} size={28} /></div>
                            <div>
                              <p className="text-sm font-medium text-[#E5E5E5]">{selectedCurrency} Wallet</p>
                              <p className="text-xs text-[#737373]">
                                Available: {(wallet.find(w => w.currency === selectedCurrency)?.available ?? wallet.find(w => w.currency === selectedCurrency)?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })} {selectedCurrency}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => { setConvertDirection((d) => d === 'usd-to-crypto' ? 'crypto-to-usd' : 'usd-to-crypto'); setAmount('') }}
                      title="Swap direction"
                      className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#ffffff10] hover:border-[#0C8B44]/40 flex items-center justify-center transition-colors"
                    >
                      <ArrowLeftRight className="w-5 h-5 text-[#0C8B44]" />
                    </button>
                  </div>
                  <div>
                    <label className="text-sm text-[#A0A0A0] mb-2 block">{convertDirection === 'usd-to-crypto' ? 'To (currency)' : 'Currency to sell'}</label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                      {CONVERT_TARGETS.map((sym) => {
                        const rate = getUsdRate(sym)
                        const bal = wallet.find(w => w.currency === sym)
                        const avail = bal?.available ?? bal?.balance ?? 0
                        return (
                          <button key={sym} onClick={() => setSelectedCurrency(sym)}
                            className={`p-3 rounded-xl border transition-all ${selectedCurrency === sym ? 'border-[#0C8B44] bg-[#0C8B44]/10' : 'border-[#ffffff08] bg-[#1a1a1a]/50 hover:border-[#0C8B44]/40'}`}>
                            <div className="mx-auto mb-2 w-fit"><CurrencyIcon currency={sym} size={28} /></div>
                            <p className="text-xs text-[#E5E5E5]">{sym}</p>
                            <p className="text-[10px] text-[#737373] truncate">${rate < 1 ? rate.toFixed(4) : rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            {convertDirection === 'crypto-to-usd' && (
                              <p className="text-[9px] text-[#0C8B44] truncate mt-0.5">{avail.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-[#A0A0A0]">Amount {convertDirection === 'crypto-to-usd' ? `(${selectedCurrency})` : '(USD)'}</label>
                      {convertDirection === 'crypto-to-usd' && (
                        <button
                          type="button"
                          onClick={() => {
                            const bal = wallet.find(w => w.currency === selectedCurrency)
                            const avail = bal?.available ?? bal?.balance ?? 0
                            setAmount(avail > 0 ? String(avail) : '')
                          }}
                          className="text-[11px] text-[#0C8B44] hover:underline"
                        >Max</button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373] text-xs">{convertDirection === 'usd-to-crypto' ? '$' : selectedCurrency}</span>
                      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                        className="w-full pl-12 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-[#ffffff08]">
                    <span className="text-sm text-[#A0A0A0]">Exchange Rate</span>
                    <span className="text-sm text-[#E5E5E5]">1 {selectedCurrency} = ${getUsdRate(selectedCurrency).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-[#ffffff08]">
                    <span className="text-sm text-[#A0A0A0]">You will receive</span>
                    <span className="text-sm font-medium text-[#E5E5E5]">
                      {convertDirection === 'usd-to-crypto'
                        ? `${amount ? (parseFloat(amount) / getUsdRate(selectedCurrency)).toFixed(8) : '0.00'} ${selectedCurrency}`
                        : `$${amount ? (parseFloat(amount) * getUsdRate(selectedCurrency)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`}
                    </span>
                  </div>
                  <button onClick={handleTransfer} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors">
                    {convertDirection === 'usd-to-crypto' ? `Convert to ${selectedCurrency}` : `Sell ${selectedCurrency} for USD`}
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

      {/* Transaction detail modal — opens when the user taps an amount in
          the history list. Shows the exact dd/mm/yyyy date and a polished
          professional description. Rendered via a portal so it always sits
          at the top of the DOM and centers in the viewport regardless of
          scroll position or any ancestor stacking/transform context. */}
      {selectedTx && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center bg-black/85 backdrop-blur-sm px-4 py-6 sm:py-8 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Transaction details"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-[#0d0d0d] border border-[#ffffff10] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-[#ffffff08] flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${txIconBg(selectedTx.type)}`}>
                  {getTransactionIcon(selectedTx.type)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-medium text-[#E5E5E5] capitalize truncate">{selectedTx.type}</h3>
                  <p className="text-[10px] sm:text-[11px] text-[#A0A0A0] tabular-nums">{formatDateLong(selectedTx.timestamp)}</p>
                </div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelectedTx(null)} className="text-[#737373] hover:text-[#E5E5E5] shrink-0">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="text-center">
                <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] mb-1">Amount</p>
                <p className={`text-xl sm:text-3xl font-semibold tabular-nums break-all ${selectedTx.amount > 0 ? 'text-[#4CAF50]' : selectedTx.amount < 0 ? 'text-[#f44336]' : 'text-[#E5E5E5]'}`}>
                  {selectedTx.amount > 0 ? '+' : ''}
                  {selectedTx.amount.toLocaleString(undefined, {
                    minimumFractionDigits: selectedTx.currency === 'USD' ? 2 : 0,
                    maximumFractionDigits: selectedTx.currency === 'USD' ? 2 : 8,
                  })}{' '}
                  <span className="text-sm sm:text-base font-medium text-[#A0A0A0]">{selectedTx.currency}</span>
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:gap-y-3 text-[11px] sm:text-xs">
                <dt className="text-[#737373]">Date</dt>
                <dd className="text-right text-[#E5E5E5] tabular-nums">{formatDateDMY(selectedTx.timestamp)}</dd>

                <dt className="text-[#737373]">Time</dt>
                <dd className="text-right text-[#E5E5E5] tabular-nums">
                  {new Date(selectedTx.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
                </dd>

                <dt className="text-[#737373]">Type</dt>
                <dd className="text-right text-[#E5E5E5] capitalize">{selectedTx.type}</dd>

                <dt className="text-[#737373]">Status</dt>
                <dd className={`text-right capitalize ${getStatusColor(selectedTx.status)}`}>{getStatusText(selectedTx.status)}</dd>

                <dt className="text-[#737373]">Currency</dt>
                <dd className="text-right text-[#E5E5E5]">{selectedTx.currency}</dd>

                <dt className="text-[#737373]">Reference</dt>
                <dd className="text-right text-[#E5E5E5] font-mono text-[10px] truncate" title={selectedTx.id}>{selectedTx.id}</dd>
              </dl>

              <div className="rounded-xl border border-[#ffffff08] bg-[#1a1a1a]/50 p-3 sm:p-4">
                <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-1.5">Description</p>
                <p className="text-[11px] sm:text-xs text-[#E5E5E5] leading-relaxed">{polishDescription(selectedTx)}</p>
                {selectedTx.description && selectedTx.description !== polishDescription(selectedTx) && (
                  <p className="text-[10px] text-[#737373] mt-2 italic">Original: {selectedTx.description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="w-full py-2.5 sm:py-3 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingWithdrawal && (() => {
        const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        const overrideCrypto = userOverride?.cryptos?.[feePayCurrency]
        const overrideWire = userOverride?.wire
        const cryptoWallet = overrideCrypto || depositInstructions.getCrypto(feePayCurrency)
        const wireFee = overrideWire || depositInstructions.getWire('USD')
        const cryptoOptions = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'XRP', 'DOGE']
        const usdAmount = pendingWithdrawal.feeUsd
        return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4 py-8 overflow-y-auto">
            <div className="w-full max-w-lg bg-[#0d0d0d] border border-[#ffffff10] rounded-2xl shadow-2xl">
              <div className="p-6 border-b border-[#ffffff08] flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-medium text-[#E5E5E5]">Pay processing fee</h3>
                  <p className="text-xs text-[#A0A0A0] mt-1">
                    {pendingWithdrawal.methodLabel} for{' '}
                    {pendingWithdrawal.currency === 'USD'
                      ? fmt(pendingWithdrawal.amountAbs)
                      : `${pendingWithdrawal.amountAbs.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${pendingWithdrawal.currency}`}
                  </p>
                </div>
                <button type="button" aria-label="Cancel" onClick={cancelFeePayment} className="text-[#737373] hover:text-[#E5E5E5]">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="rounded-xl border border-[#F57C00]/30 bg-[#F57C00]/5 p-4">
                  <p className="text-sm font-medium text-[#F57C00]">Fee due: {fmt(usdAmount)}</p>
                  <p className="text-[11px] text-[#A0A0A0] mt-1">
                    Processing {fmt(pendingWithdrawal.feeBreakdown.processing)}
                    {pendingWithdrawal.feeBreakdown.delivery > 0 ? ` + Delivery ${fmt(pendingWithdrawal.feeBreakdown.delivery)}` : ''}.
                    Verdexis cannot deduct this from your account balance — please pay it externally and submit the transaction proof below.
                  </p>
                  <p className="text-[11px] text-[#0C8B44] mt-2">
                    ✓ The {fmt(usdAmount)} you pay will be credited back to your wallet balance after verification, so the account isn't empty for your next investment cycle.
                  </p>
                </div>

                {userOverride && (
                  <div className="rounded-xl border border-[#0C8B44]/30 bg-[#0C8B44]/5 p-3">
                    <p className="text-[11px] text-[#0C8B44] font-medium">Personal payment destination assigned by your account manager.</p>
                    {userOverride.notes && <p className="text-[11px] text-[#A0A0A0] mt-1">{userOverride.notes}</p>}
                  </div>
                )}

                <div>
                  <p className="text-xs text-[#A0A0A0] mb-2">Pay the fee in:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {cryptoOptions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFeePayCurrency(c)}
                        className={`px-3 py-2 rounded-lg text-xs border transition-colors ${feePayCurrency === c ? 'border-[#0C8B44] bg-[#0C8B44]/10 text-[#E5E5E5]' : 'border-[#ffffff10] bg-[#1a1a1a] text-[#A0A0A0] hover:text-[#E5E5E5]'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {cryptoWallet ? (
                  <div className="rounded-xl bg-[#1a1a1a] border border-[#ffffff08] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[#737373]">Network</p>
                      <p className="text-xs text-[#E5E5E5]">{cryptoWallet.network}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#737373] mb-1.5">Send {fmt(usdAmount)} worth of {feePayCurrency} (≈ {(usdAmount / getUsdRate(feePayCurrency)).toFixed(8)} {feePayCurrency}) to:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-[11px] text-[#E5E5E5] bg-[#070C0E] px-3 py-2 rounded-lg break-all">{cryptoWallet.address}</code>
                        <button type="button" aria-label="Copy address" onClick={() => copyToClipboard(cryptoWallet.address, 'Address copied')} className="p-2 rounded-lg text-[#737373] hover:text-[#0C8B44]">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      {cryptoWallet.memo && (
                        <div className="mt-2">
                          <p className="text-[11px] text-[#737373] mb-1">Memo / Tag (required)</p>
                          <code className="text-[11px] text-[#E5E5E5] bg-[#070C0E] px-3 py-2 rounded-lg block">{cryptoWallet.memo}</code>
                        </div>
                      )}
                    </div>
                  </div>
                ) : wireFee ? (
                  <div className="rounded-xl bg-[#1a1a1a] border border-[#ffffff08] p-4 space-y-2">
                    <p className="text-xs text-[#737373]">No {feePayCurrency} address configured. Pay by wire instead:</p>
                    <p className="text-xs text-[#E5E5E5]">{wireFee.bankName} · {wireFee.beneficiaryName}</p>
                    <p className="text-[11px] text-[#A0A0A0]">Account: {wireFee.accountNumber}{wireFee.routingNumber ? ` · Routing ${wireFee.routingNumber}` : ''}</p>
                    <p className="text-[11px] text-[#737373]">Reference: VERDEXIS-FEE-{pendingWithdrawal.amountAbs.toFixed(0)}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#f44336]/30 bg-[#f44336]/5 p-4">
                    <p className="text-xs text-[#f44336]">No payment instructions configured for {feePayCurrency}. Please reach out to your portfolio representative to receive an address.</p>
                  </div>
                )}

                <div>
                  <label htmlFor="fee-proof" className="text-xs text-[#A0A0A0] mb-1.5 block">Transaction hash / wire reference *</label>
                  <input
                    id="fee-proof"
                    type="text"
                    value={feeProof}
                    onChange={(e) => setFeeProof(e.target.value)}
                    placeholder="0x… or wire confirmation number"
                    className="w-full px-3 py-2.5 bg-[#070C0E] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
                  />
                  <p className="text-[10px] text-[#737373] mt-1">We verify this on-chain (or via the bank) before releasing your withdrawal. False proofs cause permanent account suspension.</p>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl bg-[#1a1a1a] border border-[#ffffff08] p-3">
                  <input
                    type="checkbox"
                    checked={feeAck}
                    onChange={(e) => setFeeAck(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#0C8B44] cursor-pointer"
                  />
                  <span className="text-[11px] text-[#A0A0A0] leading-relaxed">
                    <span className="text-[#E5E5E5] font-medium">Required:</span> I understand the {fmt(usdAmount)} processing fee is paid externally (not from my balance) and will be credited back to my wallet ONLY after my payment is verified. I confirm this is a compulsory company policy.
                  </span>
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cancelFeePayment}
                    className="flex-1 py-3 rounded-xl bg-[#1a1a1a] border border-[#ffffff10] text-sm text-[#A0A0A0] hover:text-[#E5E5E5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitWithdrawal}
                    disabled={feeProof.trim().length < 6 || !feeAck}
                    className="flex-[2] py-3 rounded-xl bg-[#0C8B44] text-white text-sm font-medium hover:bg-[#0a7539] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    I've paid the fee — submit withdrawal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function WireField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-[#A0A0A0] mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-[#0d0d0d] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
      />
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
            <>Please reach out to your portfolio representative to receive {currency} wire transfer instructions.</>
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
