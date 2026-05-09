import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, LogOut, Settings as SettingsIcon, Wallet as WalletIcon, LifeBuoy } from 'lucide-react'
import AuthModal from './AuthModal'
import NotificationBell from './NotificationBell'
import { getAvatar } from '../lib/userProfile'
import { api, clearStoredAuth, getToken } from '../lib/api'
import { useWeb3 } from '../hooks/use-web3'

const publicLinks = [
  { label: 'Markets', path: '/markets' },
  { label: 'Trade', path: '/trading' },
  { label: 'News', path: '/news' },
  { label: 'Pricing', path: '/#pricing' },
]

const privateLinks = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Markets', path: '/markets' },
  { label: 'Trade', path: '/trading' },
  { label: 'News', path: '/news' },
  { label: 'AI Analyst', path: '/ai' },
  { label: 'Wallet', path: '/wallet' },
  { label: 'Goals', path: '/goals' },
]

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userName, setUserName] = useState('User')
  const [isAdmin, setIsAdmin] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const { isConnected: web3Connected, isConnecting: web3Connecting, shortAddress, connect: connectWeb3, error: web3Error } = useWeb3()
  const location = useLocation()

  // Check auth state from localStorage
  const checkAuth = () => {
    const auth = localStorage.getItem('verdexis_auth')
    setIsAuthenticated(!!auth)
    if (auth) {
      try {
        const parsed = JSON.parse(auth)
        setUserName(parsed.name || 'User')
        setIsAdmin(parsed.role === 'admin')
      } catch {
        setUserName('User')
        setIsAdmin(false)
      }
    } else {
      setIsAdmin(false)
    }
    setAvatar(getAvatar())
  }

  useEffect(() => {
    checkAuth()
    const handleStorage = () => checkAuth()
    window.addEventListener('storage', handleStorage)
    window.addEventListener('verdexis:profile', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('verdexis:profile', handleStorage)
    }
  }, [])

  const isPrivatePage = ['/dashboard', '/ai', '/wallet'].includes(location.pathname)
  const showPrivateNav = isAuthenticated || isPrivatePage
  const baseLinks = showPrivateNav ? privateLinks : publicLinks
  const navLinks = isAdmin ? [...baseLinks, { label: 'Admin', path: '/admin' }] : baseLinks

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const openLogin = () => {
    setAuthMode('login')
    setAuthOpen(true)
    setMobileOpen(false)
  }

  const openSignup = () => {
    setAuthMode('signup')
    setAuthOpen(true)
    setMobileOpen(false)
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
    setIsAuthenticated(false)
    setUserName('User')
    window.location.reload()
  }

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center transition-all duration-300 ${mobileOpen ? 'nav-glass' : 'bg-transparent'}`}>
        <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img src="/assets/logo-icon-transparent.png" alt="Verdexis" className="logo-knockout" />
            <span className="text-lg sm:text-xl font-light tracking-[0.15em] uppercase text-[#E5E5E5]">VERDEXIS</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
            {navLinks.map((link) => (
              <Link key={link.path} to={link.path}
                className={`text-sm font-light tracking-[0.08em] uppercase whitespace-nowrap transition-colors hover:text-[#0C8B44] ${location.pathname === link.path ? 'text-[#0C8B44]' : 'text-[#A0A0A0]'}`}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <button
              onClick={() => { if (!web3Connected) connectWeb3() }}
              disabled={web3Connecting}
              title={web3Error ?? (web3Connected ? `Wallet ${shortAddress}` : 'Choose a wallet to connect')}
              className={`hidden xl:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-medium tracking-[0.04em] uppercase whitespace-nowrap transition-colors ${web3Connected ? 'bg-[#0C8B44]/15 text-[#0C8B44] border border-[#0C8B44]/40' : 'bg-[#1a1a1a] text-[#A0A0A0] border border-[#ffffff10] hover:text-[#0C8B44] hover:border-[#0C8B44]/40'} disabled:opacity-50`}
            >
              <WalletIcon className="w-3.5 h-3.5" />
              {web3Connecting ? 'Connecting…' : web3Connected ? shortAddress : 'Connect Wallet'}
            </button>
            {!isAuthenticated ? (
              <>
                <button onClick={openLogin} className="px-4 py-2.5 text-[#A0A0A0] text-sm font-light tracking-[0.04em] uppercase whitespace-nowrap hover:text-[#E5E5E5] transition-colors">Log In</button>
                <button onClick={openSignup} className="px-5 py-2.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase whitespace-nowrap rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Sign Up</button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#737373] hidden xl:inline">{userName}</span>
                <NotificationBell />
                <Link to="/dashboard" className="w-9 h-9 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-sm font-bold text-[#0C8B44] hover:bg-[#0C8B44]/30 transition-colors overflow-hidden" title="Dashboard">
                  {avatar ? (
                    <img src={avatar} alt="Your avatar" className="w-full h-full object-cover" />
                  ) : (
                    userName[0]?.toUpperCase() || 'U'
                  )}
                </Link>
                <Link to="/help" className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10 transition-colors" title="Help">
                  <LifeBuoy className="w-4 h-4" />
                </Link>
                <Link to="/settings" className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10 transition-colors" title="Settings">
                  <SettingsIcon className="w-4 h-4" />
                </Link>
                <button onClick={handleLogout} className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#f44336] hover:bg-red-500/10 transition-colors" title="Log out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile/tablet: notification bell (signed-in) + hamburger. The bar
             itself stays transparent while scrolling — only the icons float
             over the page. Tapping the hamburger reveals the solid menu. */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            {isAuthenticated && <NotificationBell />}
            <button
              className="text-[#E5E5E5] p-2 -mr-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="absolute top-16 left-0 right-0 nav-glass py-4 px-6 lg:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <div className="flex flex-col gap-4">
              {/* Auth buttons first so signed-out users see them without scrolling. */}
              {!isAuthenticated && (
                <div className="flex items-center gap-3 pb-3 border-b border-[#ffffff08]">
                  <button onClick={openLogin} className="flex-1 py-2.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff20] rounded-lg">Log In</button>
                  <button onClick={openSignup} className="flex-1 py-2.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg">Sign Up</button>
                </div>
              )}
              {navLinks.map((link) => (
                <Link key={link.path} to={link.path}
                  className="text-sm font-light tracking-[0.08em] uppercase text-[#A0A0A0] hover:text-[#0C8B44] transition-colors"
                  onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && (
                <div className="flex items-center justify-between pt-3 border-t border-[#ffffff08]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-sm font-bold text-[#0C8B44] overflow-hidden">{avatar ? <img src={avatar} alt="Your avatar" className="w-full h-full object-cover" /> : (userName[0]?.toUpperCase() || 'U')}</div>
                    <span className="text-sm text-[#A0A0A0]">{userName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to="/settings" onClick={() => setMobileOpen(false)} className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#0C8B44] transition-colors">
                      <SettingsIcon className="w-4 h-4" /> Settings
                    </Link>
                    <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#f44336] transition-colors">
                      <LogOut className="w-4 h-4" /> Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />
    </>
  )
}
