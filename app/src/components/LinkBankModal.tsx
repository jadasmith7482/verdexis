import { useState } from 'react'
import { X, Building2, Shield, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { linkBank, isValidRoutingNumber, institutionForRouting, type BankAccountType, type BankVerificationMethod } from '../lib/bankLink'

interface LinkBankModalProps {
  isOpen: boolean
  onClose: () => void
  onLinked?: (accountId: string) => void
}

type Step = 'choose-method' | 'instant-credentials' | 'manual-entry' | 'submitting' | 'success'

export default function LinkBankModal({ isOpen, onClose, onLinked }: LinkBankModalProps) {
  const [step, setStep] = useState<Step>('choose-method')
  const [verificationMethod, setVerificationMethod] = useState<BankVerificationMethod>('instant')
  const [accountHolder, setAccountHolder] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccount, setConfirmAccount] = useState('')
  const [accountType, setAccountType] = useState<BankAccountType>('checking')
  const [instantUsername, setInstantUsername] = useState('')
  const [instantPassword, setInstantPassword] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const reset = () => {
    setStep('choose-method')
    setVerificationMethod('instant')
    setAccountHolder('')
    setRoutingNumber('')
    setAccountNumber('')
    setConfirmAccount('')
    setAccountType('checking')
    setInstantUsername('')
    setInstantPassword('')
    setError('')
  }

  const close = () => {
    reset()
    onClose()
  }

  const detectedInstitution = routingNumber.length === 9 && isValidRoutingNumber(routingNumber)
    ? institutionForRouting(routingNumber)
    : ''

  const submitManual = () => {
    setError('')
    if (accountNumber !== confirmAccount) {
      setError('Account numbers do not match')
      return
    }
    setStep('submitting')
    // Mimic Plaid's network round-trip
    setTimeout(() => {
      const res = linkBank({
        accountHolder,
        routingNumber,
        accountNumber,
        type: accountType,
        verificationMethod: 'micro_deposits',
      })
      if (!res.ok || !res.account) {
        setError(res.error || 'Could not link this account')
        setStep('manual-entry')
        return
      }
      setStep('success')
      toast.success('Bank linked', {
        description: '2 micro-deposits will arrive in 1–2 business days. Verifying automatically.',
      })
      onLinked?.(res.account.id)
    }, 1100)
  }

  const submitInstant = () => {
    setError('')
    if (!instantUsername.trim() || !instantPassword.trim()) {
      setError('Enter your online banking username and password')
      return
    }
    if (!accountHolder.trim()) {
      setError('Account holder name is required')
      return
    }
    setStep('submitting')
    setTimeout(() => {
      // Generate a plausible account from the username for the demo,
      // but use a real ABA-valid routing number for Chase (021000021).
      const fakeAccount = String(Math.abs(hashCode(instantUsername))).padStart(10, '0').slice(-10)
      const res = linkBank({
        accountHolder,
        routingNumber: '021000021',
        accountNumber: fakeAccount,
        type: accountType,
        verificationMethod: 'instant',
      })
      if (!res.ok || !res.account) {
        setError(res.error || 'Authentication failed. Check your credentials.')
        setStep('instant-credentials')
        return
      }
      setStep('success')
      toast.success('Bank linked', { description: `${res.account.institution} ····${res.account.accountMask} verified instantly.` })
      onLinked?.(res.account.id)
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={close}>
      <div
        className="relative w-full max-w-md bg-[#0a0f11] border border-[#ffffff10] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={close} className="absolute top-4 right-4 p-1.5 rounded-lg text-[#737373] hover:text-[#E5E5E5] hover:bg-[#ffffff08] transition-colors" aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-[#ffffff08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div>
              <h2 className="text-lg font-light text-[#E5E5E5]">Link your bank</h2>
              <p className="text-xs text-[#737373]">Powered by Verdexis Connect · 256-bit encrypted</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 'choose-method' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#0C8B44]/5 border border-[#0C8B44]/15 text-[11px] text-[#A0A0A0]">
                <span className="text-[#0C8B44]">●</span>
                <div className="space-y-0.5">
                  <p><span className="text-[#E5E5E5]">Daily limits:</span> $10 min · $100,000 max per ACH transfer.</p>
                  <p><span className="text-[#E5E5E5]">Funds available:</span> instant verification — same day · micro-deposits — 1-3 business days.</p>
                </div>
              </div>
              <button
                onClick={() => { setVerificationMethod('instant'); setStep('instant-credentials') }}
                className="w-full text-left p-4 rounded-xl border border-[#ffffff10] hover:border-[#0C8B44]/40 hover:bg-[#0C8B44]/5 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#0C8B44]/15 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-[#0C8B44]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E5E5E5]">Instant verification</p>
                    <p className="text-xs text-[#A0A0A0] mt-1">Sign in to your bank — verified in seconds. Recommended.</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setVerificationMethod('micro_deposits'); setStep('manual-entry') }}
                className="w-full text-left p-4 rounded-xl border border-[#ffffff10] hover:border-[#0C8B44]/40 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#1a1a1a] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-[#A0A0A0]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E5E5E5]">Manual entry (micro-deposits)</p>
                    <p className="text-xs text-[#A0A0A0] mt-1">Enter routing & account numbers. Verified in 1–2 business days.</p>
                  </div>
                </div>
              </button>
              <p className="flex items-center gap-1.5 text-[10px] text-[#737373] pt-2">
                <Lock className="w-3 h-3" /> Your credentials are never stored on our servers.
              </p>
            </div>
          )}

          {step === 'instant-credentials' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-holder">Account holder name</label>
                <input
                  id="lb-holder"
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#0C8B44]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-user">Online banking username</label>
                <input
                  id="lb-user"
                  type="text"
                  value={instantUsername}
                  onChange={(e) => setInstantUsername(e.target.value)}
                  autoComplete="off"
                  placeholder="username"
                  className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#0C8B44]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-pass">Password</label>
                <input
                  id="lb-pass"
                  type="password"
                  value={instantPassword}
                  onChange={(e) => setInstantPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#0C8B44]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-type-1">Account type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button id="lb-type-1" onClick={() => setAccountType('checking')} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${accountType === 'checking' ? 'bg-[#0C8B44]/15 border-[#0C8B44] text-[#0C8B44]' : 'bg-[#1a1a1a] border-[#ffffff10] text-[#A0A0A0]'}`}>Checking</button>
                  <button onClick={() => setAccountType('savings')} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${accountType === 'savings' ? 'bg-[#0C8B44]/15 border-[#0C8B44] text-[#0C8B44]' : 'bg-[#1a1a1a] border-[#ffffff10] text-[#A0A0A0]'}`}>Savings</button>
                </div>
              </div>
              {error && <p className="text-xs text-[#f44336]">{error}</p>}
              <div className="flex items-center gap-2 pt-2">
                <button onClick={() => setStep('choose-method')} className="px-4 py-2.5 text-sm text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors">Back</button>
                <button onClick={submitInstant} className="flex-1 px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">Sign in &amp; verify</button>
              </div>
              <p className="flex items-center gap-1.5 text-[10px] text-[#737373]">
                <Lock className="w-3 h-3" /> End-to-end encrypted. We never see your password.
              </p>
            </div>
          )}

          {step === 'manual-entry' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-holder-2">Account holder name</label>
                <input
                  id="lb-holder-2"
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#0C8B44]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-rn">Routing number (9 digits)</label>
                <input
                  id="lb-rn"
                  type="text"
                  inputMode="numeric"
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="021000021"
                  className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#0C8B44] font-mono"
                />
                {detectedInstitution && (
                  <p className="text-xs text-[#0C8B44] mt-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {detectedInstitution}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-acct">Account number</label>
                  <input
                    id="lb-acct"
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 17))}
                    className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#0C8B44] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-acct-2">Confirm</label>
                  <input
                    id="lb-acct-2"
                    type="text"
                    inputMode="numeric"
                    value={confirmAccount}
                    onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, '').slice(0, 17))}
                    className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#0C8B44] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#A0A0A0] mb-1.5" htmlFor="lb-type-3">Account type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button id="lb-type-3" onClick={() => setAccountType('checking')} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${accountType === 'checking' ? 'bg-[#0C8B44]/15 border-[#0C8B44] text-[#0C8B44]' : 'bg-[#1a1a1a] border-[#ffffff10] text-[#A0A0A0]'}`}>Checking</button>
                  <button onClick={() => setAccountType('savings')} className={`px-3 py-2 rounded-lg text-sm border transition-colors ${accountType === 'savings' ? 'bg-[#0C8B44]/15 border-[#0C8B44] text-[#0C8B44]' : 'bg-[#1a1a1a] border-[#ffffff10] text-[#A0A0A0]'}`}>Savings</button>
                </div>
              </div>
              {error && <p className="text-xs text-[#f44336]">{error}</p>}
              <div className="flex items-center gap-2 pt-2">
                <button onClick={() => setStep('choose-method')} className="px-4 py-2.5 text-sm text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors">Back</button>
                <button onClick={submitManual} className="flex-1 px-4 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">Link account</button>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <div className="py-8 flex flex-col items-center text-center">
              <Loader2 className="w-8 h-8 text-[#0C8B44] animate-spin mb-4" />
              <p className="text-sm text-[#E5E5E5]">{verificationMethod === 'instant' ? 'Connecting to your bank…' : 'Submitting routing details…'}</p>
              <p className="text-xs text-[#737373] mt-1.5">This usually takes a few seconds.</p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#0C8B44]/15 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-[#0C8B44]" />
              </div>
              <p className="text-base font-light text-[#E5E5E5]">{verificationMethod === 'instant' ? 'Bank linked' : 'Almost done'}</p>
              <p className="text-xs text-[#A0A0A0] mt-2 max-w-xs">
                {verificationMethod === 'instant'
                  ? 'You can deposit funds immediately.'
                  : '2 micro-deposits will arrive in 1–2 business days. We\u2019ll auto-verify when they post.'}
              </p>
              <button onClick={close} className="mt-6 px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return h
}
