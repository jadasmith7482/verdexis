import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { Toaster, toast } from 'sonner'
import {
  User, Shield, Bell, Palette, Globe, Key, LogOut, Mail,
  Smartphone, Check, ChevronRight, Trash2, Camera,
} from 'lucide-react'
import { fileToAvatarDataUrl, getAvatar, updateProfile } from '../lib/userProfile'
import { applyTheme } from '../lib/themeApplier'

type Section = 'profile' | 'security' | 'preferences' | 'notifications'

interface UserPrefs {
  email: string
  name: string
  twoFactorEnabled: boolean
  emailAlerts: boolean
  pushAlerts: boolean
  priceAlerts: boolean
  newsDigest: boolean
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY'
  theme: 'dark' | 'light' | 'auto'
}

const DEFAULT_PREFS: UserPrefs = {
  email: '',
  name: 'User',
  twoFactorEnabled: false,
  emailAlerts: true,
  pushAlerts: true,
  priceAlerts: true,
  newsDigest: false,
  currency: 'USD',
  theme: 'dark',
}

function loadPrefs(): UserPrefs {
  try {
    const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
    const stored = JSON.parse(localStorage.getItem('verdexis_prefs') || '{}')
    return { ...DEFAULT_PREFS, ...stored, email: auth.email || '', name: auth.name || stored.name || 'User' }
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
    if (key === 'name' || key === 'email') {
      const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}')
      localStorage.setItem('verdexis_auth', JSON.stringify({ ...auth, [key]: value }))
      window.dispatchEvent(new Event('verdexis:profile'))
    }
    if (key === 'theme') {
      applyTheme(value as UserPrefs['theme'])
      window.dispatchEvent(new Event('verdexis:prefs'))
    }
    toast.success('Saved')
  }

  const handleAvatarPick = async (file?: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      updateProfile({ avatar: dataUrl })
      setAvatar(dataUrl)
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update avatar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAvatarRemove = () => {
    updateProfile({ avatar: null })
    setAvatar(null)
    toast.success('Avatar removed')
  }

  const handleLogout = () => {
    localStorage.removeItem('verdexis_auth')
    localStorage.removeItem('verdexis_holdings')
    localStorage.removeItem('verdexis_wallet')
    localStorage.removeItem('verdexis_trades')
    localStorage.removeItem('verdexis_transactions')
    toast.success('Logged out')
    setTimeout(() => { window.location.href = '/' }, 600)
  }

  const handleDeleteAccount = () => {
    if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return
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
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'preferences', label: 'Preferences', icon: Palette },
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

                  <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
                    <div className="flex items-start gap-3">
                      <Key className="w-5 h-5 text-[#A0A0A0] mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#E5E5E5]">Password</p>
                        <p className="text-xs text-[#737373] mt-1">Last changed: never</p>
                      </div>
                      <button
                        onClick={() => toast.info('Password reset email sent')}
                        className="text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
                    <p className="text-sm font-medium text-[#E5E5E5] mb-2">Active sessions</p>
                    <p className="text-xs text-[#737373] mb-4">1 device — this browser</p>
                    <button
                      onClick={() => toast.success('Other sessions revoked')}
                      className="text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors"
                    >
                      Sign out all other sessions
                    </button>
                  </div>
                </div>
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

                  <div className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
                    <div className="flex items-center gap-3 mb-2">
                      <Globe className="w-5 h-5 text-[#0C8B44]" />
                      <p className="text-sm font-medium text-[#E5E5E5]">Region</p>
                    </div>
                    <p className="text-xs text-[#737373]">Auto-detected from your browser. Region cannot be changed manually.</p>
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
