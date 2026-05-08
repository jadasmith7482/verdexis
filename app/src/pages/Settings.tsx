import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { Toaster, toast } from 'sonner'
import {
  User, Shield, Bell, Palette, Globe, Key, LogOut, Mail,
  Smartphone, Check, ChevronRight, Trash2, Camera, Download, AtSign,
  Building2, Wallet as WalletIcon, Eye, EyeOff, TrendingUp, Plug, Lock,
  Phone, FileText, Plus,
} from 'lucide-react'
import { fileToAvatarDataUrl, getAvatar, updateProfile } from '../lib/userProfile'
import { applyTheme } from '../lib/themeApplier'
import { api, clearStoredAuth, getToken, setStoredUser, setToken } from '../lib/api'
import { listBanks, removeBank, onBanksChanged, type BankAccount } from '../lib/bankLink'
import LinkBankModal from '../components/LinkBankModal'

type Section = 'profile' | 'security' | 'trading' | 'connections' | 'notifications' | 'preferences' | 'privacy'

type OrderType = 'market' | 'limit' | 'stop'
type LandingPage = 'home' | 'dashboard' | 'trading' | 'wallet'
type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
type Language = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'zh'
type Visibility = 'public' | 'private'

interface UserPrefs {
  email: string
  username: string
  name: string
  phone: string
  country: string
  bio: string
  twoFactorEnabled: boolean
  // Notifications
  emailAlerts: boolean
  pushAlerts: boolean
  priceAlerts: boolean
  newsDigest: boolean
  smsAlerts: boolean
  marketingEmails: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string  // "22:00"
  quietHoursEnd: string    // "07:00"
  // Display
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY'
  theme: 'dark' | 'light' | 'auto'
  language: Language
  timezone: string
  dateFormat: DateFormat
  defaultLandingPage: LandingPage
  compactDensity: boolean
  reducedMotion: boolean
  // Trading
  hideBalances: boolean
  hideSmallBalances: boolean
  requireTradeConfirmation: boolean
  defaultOrderType: OrderType
  slippageTolerance: number   // percent
  maxSingleTrade: number      // USD
  // Privacy
  analyticsOptOut: boolean
  profileVisibility: Visibility
  blurOnFocusLoss: boolean
}

const DEFAULT_PREFS: UserPrefs = {
  email: '',
  username: '',
  name: 'User',
  phone: '',
  country: '',
  bio: '',
  twoFactorEnabled: false,
  emailAlerts: true,
  pushAlerts: true,
  priceAlerts: true,
  newsDigest: false,
  smsAlerts: false,
  marketingEmails: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  currency: 'USD',
  theme: 'dark',
  language: 'en',
  timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  dateFormat: 'MM/DD/YYYY',
  defaultLandingPage: 'dashboard',
  compactDensity: false,
  reducedMotion: false,
  hideBalances: false,
  hideSmallBalances: false,
  requireTradeConfirmation: true,
  defaultOrderType: 'market',
  slippageTolerance: 0.5,
  maxSingleTrade: 0,
  analyticsOptOut: false,
  profileVisibility: 'private',
  blurOnFocusLoss: false,
}

function loadPrefs(): UserPrefs {
  try {
    const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
    const stored = JSON.parse(localStorage.getItem('verdexis_prefs') || '{}')
    return { ...DEFAULT_PREFS, ...stored, email: auth.email || '', username: auth.username || stored.username || '', name: auth.name || stored.name || 'User' }
  } catch {
    return DEFAULT_PREFS
  }
}

export default function Settings() {
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('profile')
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS)
  const [isAuthed, setIsAuthed] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const auth = localStorage.getItem('verdexis_auth')
    if (!auth) {
      setIsAuthed(false)
      return
    }
    setIsAuthed(true)
    setPrefs(loadPrefs())
    setAvatar(getAvatar())
  }, [])

  const update = <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    localStorage.setItem('verdexis_prefs', JSON.stringify(next))
    if (key === 'name' || key === 'email' || key === 'username') {
      const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
      localStorage.setItem('verdexis_auth', JSON.stringify({ ...auth, [key]: value }))
      window.dispatchEvent(new Event('verdexis:profile'))
    }
    if (key === 'theme') {
      applyTheme(value as UserPrefs['theme'])
      window.dispatchEvent(new Event('verdexis:prefs'))
    }
    if (key === 'reducedMotion') document.documentElement.classList.toggle('reduce-motion', !!value)
    if (key === 'compactDensity') document.documentElement.classList.toggle('compact-ui', !!value)
    if (key === 'hideBalances') document.documentElement.classList.toggle('hide-balances', !!value)
    // Best-effort sync to API; ignore if offline.
    if (getToken()) {
      const patch: Record<string, unknown> = {}
      if (key === 'name') patch.name = value
      else if (key === 'username') patch.username = (value as string).trim().toLowerCase() || null
      else if (key === 'twoFactorEnabled') patch.twoFactor = value
      else patch.prefs = next
      api.patchProfile(patch).catch((err) => {
        if (key === 'username') toast.error((err as { error?: string }).error || 'Username unavailable')
      })
    }
    if (key !== 'username') toast.success('Saved')
  }

  // Apply visual prefs once on mount so a reload still respects them.
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion)
    document.documentElement.classList.toggle('compact-ui', prefs.compactDensity)
    document.documentElement.classList.toggle('hide-balances', prefs.hideBalances)
  }, [prefs.reducedMotion, prefs.compactDensity, prefs.hideBalances])

  // Blur the whole app when the window loses focus (privacy in screenshares).
  useEffect(() => {
    if (!prefs.blurOnFocusLoss) {
      document.documentElement.style.removeProperty('filter')
      return
    }
    const onBlur = () => { document.documentElement.style.filter = 'blur(8px)' }
    const onFocus = () => { document.documentElement.style.removeProperty('filter') }
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.documentElement.style.removeProperty('filter')
    }
  }, [prefs.blurOnFocusLoss])

  const handleAvatarPick = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      updateProfile({ avatar: dataUrl })
      setAvatar(dataUrl)
      if (getToken()) {
        try {
          const res = await api.patchProfile({ avatar: dataUrl })
          setStoredUser(res.user)
        } catch { /* offline ok */ }
      }
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update avatar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAvatarRemove = async () => {
    updateProfile({ avatar: null })
    setAvatar(null)
    if (getToken()) {
      try { await api.patchProfile({ avatar: null }) } catch { /* offline ok */ }
    }
    toast.success('Avatar removed')
  }

  const handleLogout = () => {
    if (getToken()) {
      api.logout().catch(() => { /* ignore */ })
    }
    clearStoredAuth()
    localStorage.removeItem('verdexis_holdings')
    localStorage.removeItem('verdexis_wallet')
    localStorage.removeItem('verdexis_trades')
    localStorage.removeItem('verdexis_transactions')
    toast.success('Logged out')
    setTimeout(() => { window.location.href = '/' }, 600)
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return
    if (getToken()) {
      try { await api.deleteAccount() } catch { /* offline ok */ }
    }
    localStorage.clear()
    toast.success('Account deleted')
    setTimeout(() => { window.location.href = '/' }, 600)
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#070C0E]">
        <Navigation />
        <div className="pt-32 pb-16 px-6">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mx-auto mb-6">
              <Key className="w-8 h-8 text-[#0C8B44]" />
            </div>
            <h1 className="text-3xl font-light text-[#E5E5E5] mb-3">Sign in required</h1>
            <p className="text-[#A0A0A0] mb-8">You need an account to access settings.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sections: Array<{ key: Section; label: string; icon: typeof User }> = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'trading', label: 'Trading', icon: TrendingUp },
    { key: 'connections', label: 'Connections', icon: Plug },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'preferences', label: 'Preferences', icon: Palette },
    { key: 'privacy', label: 'Privacy', icon: Lock },
  ]

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Toaster position="top-right" theme="dark" />
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1080px] mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">Settings</h1>
            <p className="text-sm text-[#737373] mt-1">Manage your account, security and preferences</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
            {/* Sidebar */}
            <nav className="glass-card p-3 h-fit">
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                    section === s.key
                      ? 'bg-[#0C8B44]/15 text-[#0C8B44]'
                      : 'text-[#A0A0A0] hover:text-[#E5E5E5] hover:bg-[#ffffff05]'
                  }`}
                >
                  <s.icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{s.label}</span>
                  {section === s.key && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              ))}
              <div className="border-t border-[#ffffff08] my-3" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-[#A0A0A0] hover:text-[#f44336] hover:bg-[#f44336]/10 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Log Out
              </button>
            </nav>

            {/* Content */}
            <div className="glass-card p-8">
              {section === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Profile</h2>

                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center text-3xl font-light text-white overflow-hidden">
                      {avatar ? (
                        <img src={avatar} alt="Your avatar" className="w-full h-full object-cover" />
                      ) : (
                        prefs.name[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        aria-label="Upload avatar"
                        onChange={(e) => handleAvatarPick(e.target.files?.[0])}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-[#A0A0A0] border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#0C8B44] transition-colors disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" /> {uploading ? 'Uploading…' : avatar ? 'Replace avatar' : 'Change avatar'}
                      </button>
                      {avatar && (
                        <button
                          onClick={handleAvatarRemove}
                          className="text-xs text-[#737373] hover:text-[#f44336] transition-colors text-left"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <Field label="Full name">
                    <input
                      type="text"
                      aria-label="Full name"
                      placeholder="Your name"
                      defaultValue={prefs.name}
                      onBlur={(e) => e.target.value !== prefs.name && update('name', e.target.value)}
                      className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                    />
                  </Field>

                  <Field label="Username" hint="3-40 chars: letters, numbers, _, ., -. You can sign in with this instead of your email.">
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                      <input
                        type="text"
                        aria-label="Username"
                        placeholder="janedoe"
                        defaultValue={prefs.username}
                        onBlur={(e) => {
                          const v = e.target.value.trim().toLowerCase()
                          if (v === prefs.username) return
                          if (v && !/^[a-z0-9_.-]{3,40}$/.test(v)) {
                            toast.error('Invalid username')
                            e.target.value = prefs.username
                            return
                          }
                          update('username', v)
                        }}
                        className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg pl-10 pr-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                  </Field>

                  <Field label="Email" hint="Used for sign-in and security alerts">
                    <input
                      type="email"
                      aria-label="Email address"
                      placeholder="you@example.com"
                      defaultValue={prefs.email}
                      onBlur={(e) => e.target.value !== prefs.email && update('email', e.target.value)}
                      className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Phone" hint="For SMS alerts and account recovery">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
                        <input
                          type="tel"
                          aria-label="Phone number"
                          placeholder="+1 555 123 4567"
                          defaultValue={prefs.phone}
                          onBlur={(e) => e.target.value !== prefs.phone && update('phone', e.target.value)}
                          className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg pl-10 pr-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                        />
                      </div>
                    </Field>
                    <Field label="Country">
                      <select
                        aria-label="Country"
                        value={prefs.country}
                        onChange={(e) => update('country', e.target.value)}
                        className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                      >
                        <option value="">Select country…</option>
                        {['United States','United Kingdom','Canada','Australia','Germany','France','Spain','Netherlands','Switzerland','Singapore','Japan','South Korea','Brazil','Mexico','India','South Africa','Other'].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Bio" hint="Optional, max 280 characters. Visible only to you unless your profile is public.">
                    <textarea
                      aria-label="Bio"
                      rows={3}
                      maxLength={280}
                      placeholder="A short note about your investing style…"
                      defaultValue={prefs.bio}
                      onBlur={(e) => e.target.value !== prefs.bio && update('bio', e.target.value)}
                      className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none resize-none"
                    />
                  </Field>

                  <div className="pt-6 border-t border-[#ffffff08]">
                    <h3 className="text-sm font-medium text-[#f44336] mb-2">Danger zone</h3>
                    <p className="text-xs text-[#737373] mb-4">Permanently delete your account and all stored data.</p>
                    <button
                      onClick={handleDeleteAccount}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#f44336] border border-[#f44336]/30 rounded-lg hover:bg-[#f44336]/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Delete account
                    </button>
                  </div>
                </div>
              )}

              {section === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Security</h2>

                  <Toggle
                    icon={<Smartphone className="w-5 h-5 text-[#0C8B44]" />}
                    title="Two-factor authentication"
                    description="Require a 6-digit code from your authenticator app on every sign-in."
                    enabled={prefs.twoFactorEnabled}
                    onChange={(v) => update('twoFactorEnabled', v)}
                  />

                  <ChangePasswordCard email={prefs.email} />

                  <RecoveryCodesCard />

                  <ActiveSessionsCard />

                  <DataExportCard />
                </div>
              )}

              {section === 'trading' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Trading</h2>

                  <Toggle
                    icon={prefs.hideBalances ? <EyeOff className="w-5 h-5 text-[#0C8B44]" /> : <Eye className="w-5 h-5 text-[#0C8B44]" />}
                    title="Hide balances"
                    description="Mask account values across the app — useful in screenshares."
                    enabled={prefs.hideBalances}
                    onChange={(v) => update('hideBalances', v)}
                  />

                  <Toggle
                    icon={<Eye className="w-5 h-5 text-[#737373]" />}
                    title="Hide small balances"
                    description="Hide assets worth less than $1 in your portfolio views."
                    enabled={prefs.hideSmallBalances}
                    onChange={(v) => update('hideSmallBalances', v)}
                  />

                  <Toggle
                    icon={<Check className="w-5 h-5 text-[#0C8B44]" />}
                    title="Require trade confirmation"
                    description="Show a final review modal before every buy or sell."
                    enabled={prefs.requireTradeConfirmation}
                    onChange={(v) => update('requireTradeConfirmation', v)}
                  />

                  <Field label="Default order type">
                    <div className="grid grid-cols-3 gap-2">
                      {(['market','limit','stop'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => update('defaultOrderType', t)}
                          className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                            prefs.defaultOrderType === t
                              ? 'bg-[#0C8B44] text-white'
                              : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Slippage tolerance" hint="Maximum acceptable price slippage on market orders.">
                    <div className="grid grid-cols-4 gap-2">
                      {[0.1, 0.5, 1, 2].map((s) => (
                        <button
                          key={s}
                          onClick={() => update('slippageTolerance', s)}
                          className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            prefs.slippageTolerance === s
                              ? 'bg-[#0C8B44] text-white'
                              : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                          }`}
                        >
                          {s}%
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Max single-trade size (USD)" hint="Block trades larger than this. Set to 0 to disable.">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      aria-label="Maximum single trade size"
                      defaultValue={prefs.maxSingleTrade}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0)
                        if (v !== prefs.maxSingleTrade) update('maxSingleTrade', v)
                      }}
                      className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none"
                    />
                  </Field>
                </div>
              )}

              {section === 'connections' && (
                <ConnectionsSection />
              )}

              {section === 'notifications' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-light text-[#E5E5E5] mb-2">Notifications</h2>
                  <Toggle
                    icon={<Mail className="w-5 h-5 text-[#0C8B44]" />}
                    title="Email alerts"
                    description="Account activity, security events, and large account changes."
                    enabled={prefs.emailAlerts}
                    onChange={(v) => update('emailAlerts', v)}
                  />
                  <Toggle
                    icon={<Bell className="w-5 h-5 text-[#0C8B44]" />}
                    title="Push notifications"
                    description="Real-time price moves and order fills."
                    enabled={prefs.pushAlerts}
                    onChange={(v) => update('pushAlerts', v)}
                  />
                  <Toggle
                    icon={<Bell className="w-5 h-5 text-[#FF9800]" />}
                    title="Price alerts"
                    description="Notify me when watchlist assets cross my targets."
                    enabled={prefs.priceAlerts}
                    onChange={(v) => update('priceAlerts', v)}
                  />
                  <Toggle
                    icon={<Mail className="w-5 h-5 text-[#9C27B0]" />}
                    title="Weekly news digest"
                    description="Curated market news and AI insights every Monday."
                    enabled={prefs.newsDigest}
                    onChange={(v) => update('newsDigest', v)}
                  />
                  <Toggle
                    icon={<Smartphone className="w-5 h-5 text-[#2196F3]" />}
                    title="SMS alerts"
                    description={prefs.phone ? `Texts sent to ${prefs.phone}.` : 'Add a phone number on the Profile tab first.'}
                    enabled={prefs.smsAlerts}
                    onChange={(v) => {
                      if (v && !prefs.phone) { toast.error('Add a phone number first'); return }
                      update('smsAlerts', v)
                    }}
                  />
                  <Toggle
                    icon={<Mail className="w-5 h-5 text-[#737373]" />}
                    title="Marketing emails"
                    description="Product updates, promotions, and partner offers."
                    enabled={prefs.marketingEmails}
                    onChange={(v) => update('marketingEmails', v)}
                  />

                  <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08] space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#E5E5E5]">Quiet hours</p>
                        <p className="text-xs text-[#737373] mt-0.5">Mute push & SMS alerts during these hours.</p>
                      </div>
                      <button
                        onClick={() => update('quietHoursEnabled', !prefs.quietHoursEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${prefs.quietHoursEnabled ? 'bg-[#0C8B44]' : 'bg-[#1a1a1a] border border-[#ffffff15]'}`}
                        aria-label="Toggle quiet hours"
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${prefs.quietHoursEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {prefs.quietHoursEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-[#737373]">From
                          <input type="time" value={prefs.quietHoursStart} onChange={(e) => update('quietHoursStart', e.target.value)} className="mt-1 w-full bg-[#0f1619] border border-[#ffffff10] rounded-lg px-3 py-2 text-sm text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                        </label>
                        <label className="text-xs text-[#737373]">To
                          <input type="time" value={prefs.quietHoursEnd} onChange={(e) => update('quietHoursEnd', e.target.value)} className="mt-1 w-full bg-[#0f1619] border border-[#ffffff10] rounded-lg px-3 py-2 text-sm text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {section === 'preferences' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-light text-[#E5E5E5]">Preferences</h2>

                  <Field label="Display currency" hint="Used to value your portfolio">
                    <div className="grid grid-cols-4 gap-2">
                      {(['USD', 'EUR', 'GBP', 'JPY'] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => update('currency', c)}
                          className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            prefs.currency === c
                              ? 'bg-[#0C8B44] text-white'
                              : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Theme" hint="Light theme is in preview — most surfaces remain dark.">
                    <div className="grid grid-cols-3 gap-2">
                      {(['dark', 'light', 'auto'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => update('theme', t)}
                          className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                            prefs.theme === t
                              ? 'bg-[#0C8B44] text-white'
                              : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Language">
                      <select aria-label="Language" value={prefs.language} onChange={(e) => update('language', e.target.value as Language)} className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none">
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="pt">Português</option>
                        <option value="ja">日本語</option>
                        <option value="zh">中文</option>
                      </select>
                    </Field>
                    <Field label="Date format">
                      <select aria-label="Date format" value={prefs.dateFormat} onChange={(e) => update('dateFormat', e.target.value as DateFormat)} className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none">
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                      </select>
                    </Field>
                  </div>

                  <Field label="Timezone" hint="Used for charts, alerts and history timestamps.">
                    <select aria-label="Timezone" value={prefs.timezone} onChange={(e) => update('timezone', e.target.value)} className="w-full bg-[#0a0e10] border border-[#ffffff10] rounded-lg px-4 py-3 text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none">
                      {commonTimezones.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Default landing page" hint="Where to send you after sign-in.">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['home','dashboard','trading','wallet'] as const).map((p) => (
                        <button key={p} onClick={() => update('defaultLandingPage', p)} className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${prefs.defaultLandingPage === p ? 'bg-[#0C8B44] text-white' : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'}`}>{p}</button>
                      ))}
                    </div>
                  </Field>

                  <Toggle
                    icon={<Palette className="w-5 h-5 text-[#0C8B44]" />}
                    title="Compact mode"
                    description="Tighten spacing and shrink controls for more on-screen data."
                    enabled={prefs.compactDensity}
                    onChange={(v) => update('compactDensity', v)}
                  />

                  <Toggle
                    icon={<Palette className="w-5 h-5 text-[#737373]" />}
                    title="Reduce motion"
                    description="Disable non-essential animations and transitions."
                    enabled={prefs.reducedMotion}
                    onChange={(v) => update('reducedMotion', v)}
                  />

                  <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
                    <div className="flex items-center gap-3 mb-2">
                      <Globe className="w-5 h-5 text-[#0C8B44]" />
                      <p className="text-sm font-medium text-[#E5E5E5]">Detected region</p>
                    </div>
                    <p className="text-xs text-[#737373]">{prefs.timezone || 'Unknown'} — auto-detected from your browser.</p>
                  </div>

                  <Link
                    to="/legal"
                    className="flex items-center justify-between p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08] hover:border-[#0C8B44]/30 transition-colors"
                  >
                    <span className="text-sm text-[#A0A0A0]">Privacy &amp; Terms</span>
                    <ChevronRight className="w-4 h-4 text-[#737373]" />
                  </Link>
                </div>
              )}

              {section === 'privacy' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-light text-[#E5E5E5] mb-2">Privacy</h2>

                  <Field label="Profile visibility" hint="Public profiles can be discovered by username.">
                    <div className="grid grid-cols-2 gap-2">
                      {(['private','public'] as const).map((v) => (
                        <button key={v} onClick={() => update('profileVisibility', v)} className={`py-2.5 rounded-lg text-sm font-medium capitalize transition-colors ${prefs.profileVisibility === v ? 'bg-[#0C8B44] text-white' : 'bg-[#0a0e10] border border-[#ffffff10] text-[#A0A0A0] hover:text-[#E5E5E5]'}`}>{v}</button>
                      ))}
                    </div>
                  </Field>

                  <Toggle
                    icon={<Shield className="w-5 h-5 text-[#0C8B44]" />}
                    title="Opt out of usage analytics"
                    description="Stop sending anonymized telemetry that helps us improve the app."
                    enabled={prefs.analyticsOptOut}
                    onChange={(v) => update('analyticsOptOut', v)}
                  />

                  <Toggle
                    icon={<EyeOff className="w-5 h-5 text-[#FF9800]" />}
                    title="Blur app when window loses focus"
                    description="Automatically blur sensitive data when you switch tabs or share your screen."
                    enabled={prefs.blurOnFocusLoss}
                    onChange={(v) => update('blurOnFocusLoss', v)}
                  />

                  <Toggle
                    icon={prefs.hideBalances ? <EyeOff className="w-5 h-5 text-[#0C8B44]" /> : <Eye className="w-5 h-5 text-[#0C8B44]" />}
                    title="Hide balances by default"
                    description="Replace dollar amounts with '••••' until you tap to reveal."
                    enabled={prefs.hideBalances}
                    onChange={(v) => update('hideBalances', v)}
                  />

                  <Link to="/legal#cookies" className="flex items-center justify-between p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08] hover:border-[#0C8B44]/30 transition-colors">
                    <span className="text-sm text-[#A0A0A0]">Cookie preferences</span>
                    <ChevronRight className="w-4 h-4 text-[#737373]" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[#737373] mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#737373] mt-2">{hint}</p>}
    </div>
  )
}

const commonTimezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Amsterdam',
  'Europe/Zurich', 'Europe/Stockholm', 'Europe/Moscow',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Pacific/Auckland',
]

function RecoveryCodesCard() {
  const [codes, setCodes] = useState<string[] | null>(null)
  const [open, setOpen] = useState(false)

  function generate() {
    const out: string[] = []
    for (let i = 0; i < 10; i++) {
      const bytes = new Uint8Array(5)
      crypto.getRandomValues(bytes)
      out.push(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').match(/.{1,5}/g)!.join('-'))
    }
    setCodes(out)
    setOpen(true)
    toast.success('New recovery codes generated', { description: 'Save them somewhere safe.' })
  }

  function downloadCodes() {
    if (!codes) return
    const blob = new Blob([`Verdexis recovery codes (generated ${new Date().toISOString()})\n\n${codes.join('\n')}\n`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'verdexis-recovery-codes.txt'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <div className="flex items-start gap-3">
        <FileText className="w-5 h-5 text-[#A0A0A0] mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[#E5E5E5]">Recovery codes</p>
          <p className="text-xs text-[#737373] mt-1">One-time codes to sign in if you lose access to your 2FA device. Each code works once.</p>
        </div>
        <button onClick={generate} className="text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors">
          {codes ? 'Regenerate' : 'Generate'}
        </button>
      </div>
      {open && codes && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 p-4 bg-[#0f1619] rounded-lg font-mono text-xs text-[#E5E5E5]">
            {codes.map((c) => <div key={c}>{c}</div>)}
          </div>
          <div className="flex gap-2">
            <button onClick={downloadCodes} className="px-3 py-1.5 text-xs text-[#A0A0A0] border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#0C8B44]">Download .txt</button>
            <button onClick={() => { navigator.clipboard.writeText(codes.join('\n')); toast.success('Copied to clipboard') }} className="px-3 py-1.5 text-xs text-[#A0A0A0] border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#0C8B44]">Copy</button>
            <button onClick={() => setOpen(false)} className="ml-auto px-3 py-1.5 text-xs text-[#737373] hover:text-[#E5E5E5]">Hide</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectionsSection() {
  const [banks, setBanks] = useState<BankAccount[]>(() => listBanks())
  const [linkOpen, setLinkOpen] = useState(false)

  useEffect(() => onBanksChanged(() => setBanks(listBanks())), [])

  const verifiedCount = useMemo(() => banks.filter((b) => b.status === 'verified').length, [banks])

  function disconnect(b: BankAccount) {
    if (!confirm(`Disconnect ${b.institution} (••${b.accountMask})?`)) return
    removeBank(b.id)
    toast.success('Bank disconnected')
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-light text-[#E5E5E5]">Connections</h2>

      <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#0C8B44]" />
            <div>
              <p className="text-sm font-medium text-[#E5E5E5]">Linked bank accounts</p>
              <p className="text-xs text-[#737373] mt-0.5">{banks.length === 0 ? 'No banks linked yet.' : `${banks.length} linked · ${verifiedCount} verified`}</p>
            </div>
          </div>
          <button onClick={() => setLinkOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#0C8B44] border border-[#0C8B44]/30 rounded-lg hover:bg-[#0C8B44]/10">
            <Plus className="w-3.5 h-3.5" /> Link bank
          </button>
        </div>
        {banks.length > 0 && (
          <ul className="space-y-2">
            {banks.map((b) => (
              <li key={b.id} className="flex items-center justify-between p-3 bg-[#0f1619] rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E5E5E5] truncate">{b.institution}</p>
                  <p className="text-xs text-[#737373] capitalize">{b.type} · ••{b.accountMask} · {b.status}</p>
                </div>
                <button onClick={() => disconnect(b)} className="text-xs text-[#737373] hover:text-[#f44336] px-2 py-1">Disconnect</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link to="/wallet" className="flex items-center justify-between p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08] hover:border-[#0C8B44]/30 transition-colors">
        <div className="flex items-center gap-3">
          <WalletIcon className="w-5 h-5 text-[#FF9800]" />
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">Crypto wallets</p>
            <p className="text-xs text-[#737373] mt-0.5">Manage MetaMask, Coinbase Wallet, and other Web3 connections.</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#737373]" />
      </Link>

      <Link to="/dashboard" className="flex items-center justify-between p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08] hover:border-[#0C8B44]/30 transition-colors">
        <div className="flex items-center gap-3">
          <Plug className="w-5 h-5 text-[#2196F3]" />
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">Connected accounts overview</p>
            <p className="text-xs text-[#737373] mt-0.5">See bank + wallet status in one place on your dashboard.</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#737373]" />
      </Link>

      <LinkBankModal
        isOpen={linkOpen}
        onClose={() => setLinkOpen(false)}
        onLinked={() => { setBanks(listBanks()); setLinkOpen(false); toast.success('Bank linked') }}
      />
    </div>
  )
}

function ChangePasswordCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (next.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (next !== confirm) { toast.error('Passwords do not match'); return }
    if (!getToken()) { toast.error('Sign in to change your password'); return }
    setBusy(true)
    try {
      const res = await api.changePassword(current, next)
      if (res.token) setToken(res.token)
      toast.success('Password changed', { description: 'Other devices have been signed out.' })
      setOpen(false); setCurrent(''); setNext(''); setConfirm('')
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Could not change password')
    } finally { setBusy(false) }
  }

  return (
    <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <div className="flex items-start gap-3">
        <Key className="w-5 h-5 text-[#A0A0A0] mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[#E5E5E5]">Password</p>
          <p className="text-xs text-[#737373] mt-1">Use a strong password unique to Verdexis.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors">
          {open ? 'Cancel' : 'Change'}
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input type="password" autoComplete="current-password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} required className="w-full bg-[#0f1619] border border-[#ffffff10] rounded-lg px-4 py-2.5 text-sm text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
          <input type="password" autoComplete="new-password" placeholder="New password (8+ chars)" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} className="w-full bg-[#0f1619] border border-[#ffffff10] rounded-lg px-4 py-2.5 text-sm text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
          <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="w-full bg-[#0f1619] border border-[#ffffff10] rounded-lg px-4 py-2.5 text-sm text-[#E5E5E5] focus:border-[#0C8B44] focus:outline-none" />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50">{busy ? 'Updating…' : 'Update password'}</button>
            <button type="button" onClick={async () => {
              if (!email) { toast.error('Set an email first'); return }
              try { await api.forgot(email); toast.success(`Reset link sent to ${email}`) } catch { toast.error('Could not send reset link') }
            }} className="text-xs text-[#737373] hover:text-[#0C8B44]">Forgot current password?</button>
          </div>
        </form>
      )}
    </div>
  )
}

function ActiveSessionsCard() {
  const [busy, setBusy] = useState(false)
  return (
    <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <p className="text-sm font-medium text-[#E5E5E5] mb-2">Active sessions</p>
      <p className="text-xs text-[#737373] mb-4">Signing out other sessions invalidates every other device that's signed in to your account.</p>
      <button
        disabled={busy}
        onClick={async () => {
          if (!getToken()) { toast.error('Not signed in'); return }
          setBusy(true)
          try {
            const res = await api.logoutAll()
            if (res.token) setToken(res.token)
            toast.success('Other sessions signed out')
          } catch (err) {
            toast.error((err as { error?: string }).error || 'Could not sign out other sessions')
          } finally { setBusy(false) }
        }}
        className="text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors disabled:opacity-50"
      >
        {busy ? 'Signing out…' : 'Sign out all other sessions'}
      </button>
    </div>
  )
}

function DataExportCard() {
  const [busy, setBusy] = useState(false)
  return (
    <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <div className="flex items-start gap-3">
        <Download className="w-5 h-5 text-[#A0A0A0] mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[#E5E5E5]">Download your data</p>
          <p className="text-xs text-[#737373] mt-1">A single JSON file with your profile, holdings, transactions, trades, watchlist, alerts and notifications.</p>
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            if (!getToken()) { toast.error('Sign in to export'); return }
            setBusy(true)
            try {
              const blob = await api.exportData()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `verdexis-export-${new Date().toISOString().slice(0, 10)}.json`
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)
              toast.success('Export downloaded')
            } catch (err) {
              toast.error((err as { error?: string }).error || 'Export failed')
            } finally { setBusy(false) }
          }}
          className="text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors disabled:opacity-50"
        >
          {busy ? 'Preparing…' : 'Export'}
        </button>
      </div>
    </div>
  )
}

function Toggle({
  icon,
  title,
  description,
  enabled,
  onChange,
}: {
  icon: React.ReactNode
  title: string
  description: string
  enabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
      <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#E5E5E5]">{title}</p>
        <p className="text-xs text-[#737373] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          enabled ? 'bg-[#0C8B44]' : 'bg-[#1a1a1a] border border-[#ffffff15]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform flex items-center justify-center ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        >
          {enabled && <Check className="w-3 h-3 text-[#0C8B44]" />}
        </span>
      </button>
    </div>
  )
}
