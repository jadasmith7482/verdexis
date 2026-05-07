import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Mail, Lock, User, Eye, EyeOff, ArrowRight, Shield, Fingerprint, KeyRound, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api, setToken, setStoredUser, type ApiError } from '../lib/api'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultMode?: 'login' | 'signup'
}

type Mode = 'login' | 'signup' | 'forgot'

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'forgot') {
      if (!form.email) {
        setError('Enter your email')
        return
      }
      setLoading(true)
      try {
        await api.forgot(form.email)
        setResetSent(true)
        toast.success('Reset link sent', { description: `Check ${form.email} for next steps.` })
      } catch (err) {
        // Even on error, show generic success to avoid user enumeration UX surprises.
        const e = err as ApiError
        if (e.status && e.status >= 400 && e.status < 500) {
          setResetSent(true)
          toast.success('Reset link sent', { description: 'If that email exists, a link is on the way.' })
        } else {
          setError('Could not reach the server. Please try again.')
        }
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)

    try {
      const res = mode === 'signup'
        ? await api.signup(form.email, form.password, `${form.firstName} ${form.lastName}`.trim() || 'User')
        : await api.login(form.email, form.password)
      setToken(res.token)
      setStoredUser(res.user)
      toast.success(mode === 'signup' ? 'Account created' : 'Welcome back')
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      // Admins land on the admin console; everyone else on dashboard.
      const dest = res.user?.role === 'admin' ? '/admin' : '/dashboard'
      navigate(dest, { replace: true })
      return
    } catch (err) {
      const e = err as ApiError
      // Network/server unreachable -> fall back to localStorage-only auth so the
      // user can still navigate the app while the API is down. We do NOT seed any
      // fake holdings/balances — they would look like real money to the user.
      const offline = !e.status || e.status === 0 || e.status >= 500
      if (!offline) {
        setError(e.error || 'Authentication failed')
        setLoading(false)
        return
      }
      console.warn('[verdexis] API offline, using local mock auth')
      localStorage.setItem('verdexis_auth', JSON.stringify({ email: form.email, name: form.firstName || 'User' }))
      setLoading(false)
      onClose()
      window.dispatchEvent(new Event('storage'))
      window.dispatchEvent(new Event('verdexis:profile'))
      navigate('/dashboard', { replace: true })
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
    setResetSent(false)
  }

  const goForgot = () => {
    setMode('forgot')
    setError('')
    setResetSent(false)
  }

  const goBackToLogin = () => {
    setMode('login')
    setError('')
    setResetSent(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md glass-card overflow-hidden" style={{ background: 'rgba(15,22,25,0.95)', backdropFilter: 'blur(24px)' }}>
        {/* Close button */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center mx-auto mb-4 overflow-hidden">
              {mode === 'login' ? (
                <Fingerprint className="w-8 h-8 text-white" />
              ) : mode === 'forgot' ? (
                <KeyRound className="w-8 h-8 text-white" />
              ) : (
                <img
                  src="/assets/logo-icon-transparent.png"
                  alt="Verdexis"
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    const img = e.currentTarget
                    img.onerror = null
                    img.style.display = 'none'
                    const parent = img.parentElement
                    if (parent) parent.innerHTML = '<span class="text-white text-2xl font-light tracking-tight">V</span>'
                  }}
                />
              )}
            </div>
            <h2 className="text-2xl font-light tracking-[-0.02em] text-[#E5E5E5]">
              {mode === 'login' ? 'Welcome Back' : mode === 'forgot' ? 'Reset Password' : 'Create Account'}
            </h2>
            <p className="text-sm text-[#737373] mt-2">
              {mode === 'login'
                ? 'Sign in to access your dashboard'
                : mode === 'forgot'
                ? "We'll email you a secure reset link"
                : 'Join 127,000+ investors on Verdexis'}
            </p>
          </div>

          {/* OAuth Buttons */}
          {mode !== 'forgot' && (
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
          )}

          {/* Divider */}
          {mode !== 'forgot' && (
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-[#ffffff10]" />
              <span className="text-xs text-[#737373] uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-[#ffffff10]" />
            </div>
          )}

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
              <label className="text-xs text-[#737373] mb-1.5 block">{mode === 'login' ? 'Email or username' : 'Email'}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-[#ffffff08] rounded-xl text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44] transition-colors"
                  placeholder={mode === 'login' ? 'you@example.com or janedoe' : 'you@example.com'}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>

            {mode !== 'forgot' && (
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
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={goForgot}
                  className="mt-2 text-xs text-[#737373] hover:text-[#0C8B44] transition-colors"
                >
                  Forgot password?
                </button>
              )}
              {mode === 'signup' && form.password.length > 0 && <PasswordStrength password={form.password} />}
            </div>
            )}

            {mode === 'forgot' && resetSent && (
              <div className="p-3 rounded-lg bg-[#0C8B44]/10 border border-[#0C8B44]/30 text-sm text-[#00E676]">
                If an account exists for that email, a reset link is on its way.
              </div>
            )}

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
                  {mode === 'login' ? 'Sign In' : mode === 'forgot' ? 'Send Reset Link' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-[#737373] mt-6">
            {mode === 'forgot' ? (
              <button
                onClick={goBackToLogin}
                className="inline-flex items-center gap-1 text-[#0C8B44] hover:text-[#00E676] transition-colors font-medium"
              >
                <ArrowLeft className="w-3 h-3" /> Back to sign in
              </button>
            ) : mode === 'login' ? (
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
            <span className="flex items-center gap-1 text-xs text-[#737373]" title="All traffic encrypted with TLS 1.3">
              <Lock className="w-3 h-3" /> TLS 1.3
            </span>
            <span className="flex items-center gap-1 text-xs text-[#737373]" title="Data at rest encrypted with AES-256">
              <Shield className="w-3 h-3" /> AES-256
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

function PasswordStrength({ password }: { password: string }) {
  const checks = [password.length >= 8, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)]
  const score = checks.filter(Boolean).length
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  const colors = ['#f44336', '#f44336', '#F57C00', '#FFC107', '#9CCC65', '#0C8B44']
  const tone = colors[score]
  const tips: string[] = []
  if (!checks[0]) tips.push('8+ characters')
  if (!checks[1]) tips.push('lowercase')
  if (!checks[2]) tips.push('UPPERCASE')
  if (!checks[3]) tips.push('a digit')
  if (!checks[4]) tips.push('a symbol')
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < score ? tone : '#1a1a1a' }} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: tone }}>
        {labels[score]}
        {tips.length > 0 && <span className="text-[#737373]"> � add {tips.join(', ')}</span>}
      </p>
    </div>
  )
}
