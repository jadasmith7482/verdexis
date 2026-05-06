import { useState } from 'react'
import { X, Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield, Fingerprint } from 'lucide-react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultMode?: 'login' | 'signup'
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      // Set mock auth state
      localStorage.setItem('verdexis_auth', JSON.stringify({ email: form.email, name: form.firstName || 'User' }))
      // Ensure demo portfolio data exists
      if (!localStorage.getItem('verdexis_holdings')) {
        localStorage.setItem('verdexis_holdings', JSON.stringify([
          { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', quantity: 2.45, avgBuyPrice: 67432, currentPrice: 97432, value: 238708, pnl: 12450, pnlPercent: 8.15, allocation: 45 },
          { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', quantity: 15.23, avgBuyPrice: 3521, currentPrice: 3847, value: 58625, pnl: 3210, pnlPercent: 6.37, allocation: 27 },
          { id: 'solana', symbol: 'SOL', name: 'Solana', quantity: 234.5, avgBuyPrice: 178.45, currentPrice: 248.73, value: 58327, pnl: -1240, pnlPercent: -2.87, allocation: 18 },
          { id: 'cardano', symbol: 'ADA', name: 'Cardano', quantity: 5000, avgBuyPrice: 0.52, currentPrice: 1.0478, value: 5239, pnl: 180, pnlPercent: 7.43, allocation: 5 },
          { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', quantity: 125430, avgBuyPrice: 1, currentPrice: 1, value: 125430, pnl: 0, pnlPercent: 0, allocation: 5 },
        ]))
      }
      if (!localStorage.getItem('verdexis_wallet')) {
        localStorage.setItem('verdexis_wallet', JSON.stringify([
          { currency: 'USD', symbol: '$', balance: 125430.50, available: 125430.50 },
          { currency: 'BTC', symbol: '₿', balance: 2.4538, available: 2.4538 },
          { currency: 'ETH', symbol: 'Ξ', balance: 15.2341, available: 15.2341 },
          { currency: 'SOL', symbol: '◎', balance: 234.56, available: 234.56 },
        ]))
      }
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.location.reload()
    }, 1200)
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card overflow-hidden" style={{ background: 'rgba(15,22,25,0.95)', backdropFilter: 'blur(24px)' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center mx-auto mb-4">
              {mode === 'login' ? (
                <Fingerprint className="w-8 h-8 text-white" />
              ) : (
                <Shield className="w-8 h-8 text-white" />
              )}
            </div>
            <h2 className="text-2xl font-light tracking-[-0.02em] text-[#E5E5E5]">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-sm text-[#737373] mt-2">
              {mode === 'login'
                ? 'Sign in to access your dashboard'
                : 'Join 127,000+ investors on Verdexis'}
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-[#1a1a1a] border border-[#ffffff08] text-sm text-[#E5E5E5] hover:bg-[#252525] transition-colors">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[#ffffff10]" />
            <span className="text-xs text-[#737373] uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-[#ffffff10]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block">First Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                      placeholder="John"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#737373] mb-1.5 block">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-[#737373] mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#737373] mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  placeholder="Min 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#E5E5E5]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-[#737373] mt-6">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button onClick={switchMode} className="text-[#0C8B44] hover:text-[#00E676] transition-colors font-medium">
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={switchMode} className="text-[#0C8B44] hover:text-[#00E676] transition-colors font-medium">
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#ffffff08]">
            <span className="flex items-center gap-1 text-xs text-[#737373]">
              <Shield className="w-3 h-3" /> 256-bit SSL
            </span>
            <span className="flex items-center gap-1 text-xs text-[#737373]">
              <Fingerprint className="w-3 h-3" /> 2FA Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
