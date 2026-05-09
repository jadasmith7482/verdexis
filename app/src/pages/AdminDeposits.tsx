import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { ArrowLeft, Banknote, Coins, Shield, Trash2, Save, Wallet as WalletIcon } from 'lucide-react'
import Navigation from '../components/Navigation'
import RequireAuth from '../components/RequireAuth'
import {
  depositInstructions,
  setAdmin,
  onDepositInstructionsChanged,
  pushToServer,
  hydrateFromServer,
  type WireInstruction,
  type CryptoWallet,
  type Web3Payout,
} from '../lib/depositInstructions'

export default function AdminDeposits() {
  return (
    <RequireAuth>
      <AdminInner />
    </RequireAuth>
  )
}

const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP'] as const
const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'XRP', 'ADA', 'DOGE'] as const

const WEB3_CHAINS: { id: string; label: string }[] = [
  { id: 'default', label: 'Default (any chain)' },
  { id: '0x1',     label: 'Ethereum Mainnet (0x1)' },
  { id: '0x89',    label: 'Polygon (0x89)' },
  { id: '0xa4b1',  label: 'Arbitrum (0xa4b1)' },
  { id: '0xa',     label: 'Optimism (0xa)' },
  { id: '0x2105',  label: 'Base (0x2105)' },
  { id: '0x38',    label: 'BNB Chain (0x38)' },
  { id: '0xa86a',  label: 'Avalanche (0xa86a)' },
  { id: '0xaa36a7', label: 'Sepolia testnet (0xaa36a7)' },
]

const EMPTY_WEB3: Web3Payout = { label: '', chainId: 'default', address: '', notes: '' }

type FiatCurrency = (typeof FIAT_CURRENCIES)[number]
type CryptoCurrency = (typeof CRYPTO_CURRENCIES)[number]

const EMPTY_WIRE: WireInstruction = {
  label: '',
  beneficiaryName: '',
  beneficiaryAddress: '',
  bankName: '',
  bankAddress: '',
  routingNumber: '',
  swiftCode: '',
  iban: '',
  accountNumber: '',
  reference: '',
  notes: '',
}

const EMPTY_CRYPTO: CryptoWallet = {
  currency: '',
  network: '',
  address: '',
  memo: '',
  notes: '',
}

function AdminInner() {
  // The route is already gated by RequireAdmin (App.tsx) and the server
  // re-checks role==='admin' on every mutation, so anyone who reaches this
  // component is authorized. We just flip the local UI flag on mount so the
  // editor controls render immediately — no "unlock" prompt to fight with.
  useEffect(() => { setAdmin(true) }, [])

  // Currency being edited
  const [wireCurrency, setWireCurrency] = useState<FiatCurrency>('USD')
  const [cryptoCurrency, setCryptoCurrency] = useState<CryptoCurrency>('BTC')

  const [wireForm, setWireForm] = useState<WireInstruction>(EMPTY_WIRE)
  const [cryptoForm, setCryptoForm] = useState<CryptoWallet>({ ...EMPTY_CRYPTO, currency: 'BTC', network: 'Bitcoin' })
  const [web3ChainId, setWeb3ChainId] = useState<string>('default')
  const [web3Form, setWeb3Form] = useState<Web3Payout>(EMPTY_WEB3)

  // Refresh from store when currency changes or admin saves elsewhere
  useEffect(() => {
    const existing = depositInstructions.getWire(wireCurrency)
    setWireForm(existing ?? { ...EMPTY_WIRE, label: `${wireCurrency} Wire Transfer` })
  }, [wireCurrency])

  useEffect(() => {
    const existing = depositInstructions.getCrypto(cryptoCurrency)
    setCryptoForm(existing ?? { ...EMPTY_CRYPTO, currency: cryptoCurrency, network: defaultNetwork(cryptoCurrency) })
  }, [cryptoCurrency])

  useEffect(() => {
    const existing = depositInstructions.getWeb3Payout(web3ChainId)
    setWeb3Form(existing && existing.chainId === web3ChainId ? existing : { ...EMPTY_WEB3, chainId: web3ChainId, label: WEB3_CHAINS.find(c => c.id === web3ChainId)?.label ?? '' })
  }, [web3ChainId])

  useEffect(() => onDepositInstructionsChanged(() => { /* re-render on store change */ }), [])

  // On first mount, pull the canonical blob from the server so admin sees
  // what every other device sees (and isn't editing a stale local cache).
  useEffect(() => { void hydrateFromServer() }, [])

  function saveWire(e: FormEvent) {
    e.preventDefault()
    if (!wireForm.bankName.trim() || !wireForm.accountNumber.trim() || !wireForm.beneficiaryName.trim()) {
      toast.error('Bank name, beneficiary name, and account number are required')
      return
    }
    depositInstructions.setWire(wireCurrency, wireForm)
    void persistRemote(`${wireCurrency} wire instructions saved`)
  }

  function deleteWire() {
    if (!confirm(`Delete ${wireCurrency} wire instructions?`)) return
    depositInstructions.removeWire(wireCurrency)
    setWireForm({ ...EMPTY_WIRE, label: `${wireCurrency} Wire Transfer` })
    void persistRemote('Removed')
  }

  function saveCrypto(e: FormEvent) {
    e.preventDefault()
    if (!cryptoForm.address.trim() || !cryptoForm.network.trim()) {
      toast.error('Network and address are required')
      return
    }
    depositInstructions.setCrypto(cryptoCurrency, { ...cryptoForm, currency: cryptoCurrency })
    void persistRemote(`${cryptoCurrency} deposit address saved`)
  }

  function deleteCrypto() {
    if (!confirm(`Delete ${cryptoCurrency} deposit address?`)) return
    depositInstructions.removeCrypto(cryptoCurrency)
    setCryptoForm({ ...EMPTY_CRYPTO, currency: cryptoCurrency, network: defaultNetwork(cryptoCurrency) })
    void persistRemote('Removed')
  }

  function saveWeb3(e: FormEvent) {
    e.preventDefault()
    if (!/^0x[a-fA-F0-9]{40}$/.test(web3Form.address.trim())) {
      toast.error('Address must be a valid 0x… EVM address (40 hex chars)')
      return
    }
    depositInstructions.setWeb3Payout({ ...web3Form, address: web3Form.address.trim(), chainId: web3ChainId })
    void persistRemote(`Web3 payout saved for ${WEB3_CHAINS.find(c => c.id === web3ChainId)?.label ?? web3ChainId}`)
  }

  function deleteWeb3() {
    if (!confirm(`Delete Web3 payout for ${web3ChainId}?`)) return
    depositInstructions.removeWeb3Payout(web3ChainId)
    setWeb3Form({ ...EMPTY_WEB3, chainId: web3ChainId })
    void persistRemote('Removed')
  }

  /** Sync the latest local copy up to the server so the change reaches
   *  the database (audit trail + cross-device propagation). Falls back to
   *  a warning toast if the server rejects (e.g. not signed in as admin). */
  async function persistRemote(successMessage: string) {
    const ok = await pushToServer()
    if (ok) toast.success(successMessage)
    else toast.warning('Saved locally only — server rejected the update (are you signed in as an admin?)')
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <Toaster position="top-right" theme="dark" richColors />
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <Link to="/wallet" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-6">
          <ArrowLeft className="w-4 h-4" />Back to wallet
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-light text-[#E5E5E5]">Admin · Deposit Instructions</h1>
            <p className="text-xs text-[#737373]">Configure wire transfer details and crypto deposit addresses shown to users.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
            {/* WIRE TRANSFER */}
            <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <div className="flex items-center gap-3 mb-5">
                <Banknote className="w-5 h-5 text-[#0C8B44]" />
                <h2 className="text-base font-medium text-[#E5E5E5]">Wire transfer</h2>
              </div>

              <div className="mb-4">
                <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Currency</label>
                <div className="grid grid-cols-3 gap-2">
                  {FIAT_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setWireCurrency(c)}
                      className={`py-2 text-xs rounded-lg border transition-colors ${wireCurrency === c ? 'border-[#0C8B44] bg-[#0C8B44]/10 text-[#0C8B44]' : 'border-[#ffffff08] bg-[#1a1a1a] text-[#A0A0A0] hover:text-[#E5E5E5]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={saveWire} className="space-y-3">
                <Field label="Display label" value={wireForm.label} onChange={(v) => setWireForm({ ...wireForm, label: v })} placeholder="USD Wire (Domestic)" />
                <Field label="Beneficiary name *" value={wireForm.beneficiaryName} onChange={(v) => setWireForm({ ...wireForm, beneficiaryName: v })} placeholder="Verdexis Holdings LLC" />
                <Field label="Beneficiary address" value={wireForm.beneficiaryAddress ?? ''} onChange={(v) => setWireForm({ ...wireForm, beneficiaryAddress: v })} placeholder="1 Market St, San Francisco, CA 94105" />
                <Field label="Bank name *" value={wireForm.bankName} onChange={(v) => setWireForm({ ...wireForm, bankName: v })} placeholder="JPMorgan Chase Bank, N.A." />
                <Field label="Bank address" value={wireForm.bankAddress ?? ''} onChange={(v) => setWireForm({ ...wireForm, bankAddress: v })} placeholder="270 Park Ave, New York, NY 10017" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Routing / ABA" value={wireForm.routingNumber ?? ''} onChange={(v) => setWireForm({ ...wireForm, routingNumber: v })} placeholder="021000021" />
                  <Field label="SWIFT / BIC" value={wireForm.swiftCode ?? ''} onChange={(v) => setWireForm({ ...wireForm, swiftCode: v })} placeholder="CHASUS33" />
                </div>
                <Field label="IBAN (EU/UK)" value={wireForm.iban ?? ''} onChange={(v) => setWireForm({ ...wireForm, iban: v })} placeholder="GB82 WEST 1234 5698 7654 32" />
                <Field label="Account number *" value={wireForm.accountNumber} onChange={(v) => setWireForm({ ...wireForm, accountNumber: v })} placeholder="000123456789" />
                <Field label="Reference / memo" value={wireForm.reference ?? ''} onChange={(v) => setWireForm({ ...wireForm, reference: v })} placeholder="VRDX-{userId}" />
                <Textarea label="Notes" value={wireForm.notes ?? ''} onChange={(v) => setWireForm({ ...wireForm, notes: v })} placeholder="Funds typically credit within 1 business day." />

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">
                    <Save className="w-4 h-4" />Save {wireCurrency} wire
                  </button>
                  <button type="button" onClick={deleteWire} aria-label="Delete wire instructions" title="Delete wire instructions" className="px-3 py-2.5 text-[#A0A0A0] bg-[#1a1a1a] border border-[#ffffff10] rounded-lg hover:text-[#f44336] hover:border-[#f44336]/40 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </section>

            {/* CRYPTO */}
            <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6">
              <div className="flex items-center gap-3 mb-5">
                <Coins className="w-5 h-5 text-[#0C8B44]" />
                <h2 className="text-base font-medium text-[#E5E5E5]">Crypto deposit address</h2>
              </div>

              <div className="mb-4">
                <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Currency</label>
                <div className="grid grid-cols-4 gap-2">
                  {CRYPTO_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCryptoCurrency(c)}
                      className={`py-2 text-xs rounded-lg border transition-colors ${cryptoCurrency === c ? 'border-[#0C8B44] bg-[#0C8B44]/10 text-[#0C8B44]' : 'border-[#ffffff08] bg-[#1a1a1a] text-[#A0A0A0] hover:text-[#E5E5E5]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={saveCrypto} className="space-y-3">
                <Field label="Network *" value={cryptoForm.network} onChange={(v) => setCryptoForm({ ...cryptoForm, network: v })} placeholder="Bitcoin / Ethereum (ERC-20) / Solana / TRON (TRC-20)" />
                <Field label="Deposit address *" value={cryptoForm.address} onChange={(v) => setCryptoForm({ ...cryptoForm, address: v })} placeholder="bc1q... / 0x... / Tn1..." mono />
                <Field label="Memo / destination tag" value={cryptoForm.memo ?? ''} onChange={(v) => setCryptoForm({ ...cryptoForm, memo: v })} placeholder="Required for XRP / XLM / BNB Beacon" />
                <Textarea label="Notes" value={cryptoForm.notes ?? ''} onChange={(v) => setCryptoForm({ ...cryptoForm, notes: v })} placeholder="Credits after 3 confirmations. Send only on the indicated network." />

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">
                    <Save className="w-4 h-4" />Save {cryptoCurrency} address
                  </button>
                  <button type="button" onClick={deleteCrypto} aria-label="Delete deposit address" title="Delete deposit address" className="px-3 py-2.5 text-[#A0A0A0] bg-[#1a1a1a] border border-[#ffffff10] rounded-lg hover:text-[#f44336] hover:border-[#f44336]/40 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </section>

            {/* WEB3 PAYOUT */}
            <section className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-6 lg:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <WalletIcon className="w-5 h-5 text-[#0C8B44]" />
                <h2 className="text-base font-medium text-[#E5E5E5]">Web3 payout address</h2>
              </div>
              <p className="text-[11px] text-[#737373] mb-5">
                When set, users connecting an external Web3 wallet will see this address pre-filled as the recipient for on-chain ETH transfers.
                The user can still override it. Configure a per-chain address, or use <span className="text-[#E5E5E5]">Default</span> as the fallback for any chain.
              </p>

              <div className="mb-4">
                <label className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Chain</label>
                <select
                  value={web3ChainId}
                  onChange={(e) => setWeb3ChainId(e.target.value)}
                  aria-label="Web3 chain"
                  className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
                >
                  {WEB3_CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <form onSubmit={saveWeb3} className="space-y-3">
                <Field label="Display label" value={web3Form.label} onChange={(v) => setWeb3Form({ ...web3Form, label: v })} placeholder="Verdexis Treasury (ETH Mainnet)" />
                <Field label="Payout address *" value={web3Form.address} onChange={(v) => setWeb3Form({ ...web3Form, address: v })} placeholder="0x..." mono />
                <Textarea label="Notes" value={web3Form.notes ?? ''} onChange={(v) => setWeb3Form({ ...web3Form, notes: v })} placeholder="Funds typically credit within 1 confirmation." />

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">
                    <Save className="w-4 h-4" />Save Web3 payout
                  </button>
                  <button type="button" onClick={deleteWeb3} aria-label="Delete Web3 payout" title="Delete Web3 payout" className="px-3 py-2.5 text-[#A0A0A0] bg-[#1a1a1a] border border-[#ffffff10] rounded-lg hover:text-[#f44336] hover:border-[#f44336]/40 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </section>
          </div>
      </div>
    </div>
  )
}

function defaultNetwork(c: CryptoCurrency): string {
  switch (c) {
    case 'BTC': return 'Bitcoin'
    case 'ETH': return 'Ethereum (ERC-20)'
    case 'SOL': return 'Solana'
    case 'USDT': return 'Ethereum (ERC-20)'
    case 'USDC': return 'Ethereum (ERC-20)'
    case 'XRP': return 'XRP Ledger'
    case 'ADA': return 'Cardano'
    case 'DOGE': return 'Dogecoin'
    default: return ''
  }
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}

function Field({ label, value, onChange, placeholder, mono }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44] ${mono ? 'font-mono text-xs' : ''}`}
      />
    </label>
  )
}

function Textarea({ label, value, onChange, placeholder }: Omit<FieldProps, 'mono'>) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44] resize-none"
      />
    </label>
  )
}
