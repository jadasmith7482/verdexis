import { Link } from 'react-router-dom'
import { Shield, Lock, Activity } from 'lucide-react'

const openCookiePrefs = () => {
  try { localStorage.removeItem('verdexis_cookie_consent') } catch { /* ignore */ }
  window.dispatchEvent(new Event('verdexis:open-cookie-prefs'))
}

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-12 border-t border-[#ffffff08] bg-[#070C0E]">
      <div className="max-w-[1280px] mx-auto px-6 py-12">

        {/* Brand row */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-10 pb-10 border-b border-[#ffffff05]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <img
                src="/assets/logo-icon-transparent.png"
                alt="Verdexis"
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                  const fb = t.nextElementSibling as HTMLElement | null
                  if (fb) fb.style.display = 'flex'
                }}
              />
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0C8B44] to-[#00E676] items-center justify-center hidden">
                <span className="text-white text-xs font-bold">V</span>
              </div>
              <span className="text-sm font-medium text-[#E5E5E5] tracking-wide">VERDEXIS</span>
            </div>
            <p className="text-xs text-[#737373] leading-relaxed">
              Institutional-grade trading and portfolio analytics. Live market data,
              AI insights and bank-level security.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-[#A0A0A0]">
            <span className="flex items-center gap-1.5" title="All traffic encrypted with TLS 1.3"><Lock className="w-3 h-3 text-[#0C8B44]" /> TLS 1.3 Encrypted</span>
            <span className="flex items-center gap-1.5" title="Data at rest encrypted with AES-256"><Shield className="w-3 h-3 text-[#0C8B44]" /> AES-256 at Rest</span>
            <Link to="/status" className="flex items-center gap-1.5 hover:text-[#0C8B44] transition-colors"><Activity className="w-3 h-3 text-[#0C8B44]" /> System Status</Link>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Company</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li><Link to="/about" className="hover:text-[#0C8B44] transition-colors">About</Link></li>
              <li><Link to="/about#mission" className="hover:text-[#0C8B44] transition-colors">Mission</Link></li>
              <li><Link to="/legal#security" className="hover:text-[#0C8B44] transition-colors">Security</Link></li>
              <li><Link to="/disclosures" className="hover:text-[#0C8B44] transition-colors">Disclosures</Link></li>
              <li><a href="mailto:hello@verdexis.com" className="hover:text-[#0C8B44] transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Product</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li><Link to="/dashboard" className="hover:text-[#0C8B44] transition-colors">Dashboard</Link></li>
              <li><Link to="/trading" className="hover:text-[#0C8B44] transition-colors">Trading</Link></li>
              <li><Link to="/wallet" className="hover:text-[#0C8B44] transition-colors">Wallet</Link></li>
              <li><Link to="/ai" className="hover:text-[#0C8B44] transition-colors">AI Assistant</Link></li>
              <li><Link to="/alerts" className="hover:text-[#0C8B44] transition-colors">Alerts</Link></li>
              <li><Link to="/goals" className="hover:text-[#0C8B44] transition-colors">Goals</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Markets</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li><Link to="/trading" className="hover:text-[#0C8B44] transition-colors">Explore crypto</Link></li>
              <li><Link to="/trading" className="hover:text-[#0C8B44] transition-colors">Explore stocks</Link></li>
              <li><Link to="/news" className="hover:text-[#0C8B44] transition-colors">Market news</Link></li>
              <li><Link to="/dashboard" className="hover:text-[#0C8B44] transition-colors">Portfolio overview</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Asset prices</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li><Link to="/coin/bitcoin" className="hover:text-[#0C8B44] transition-colors">Bitcoin price</Link></li>
              <li><Link to="/coin/ethereum" className="hover:text-[#0C8B44] transition-colors">Ethereum price</Link></li>
              <li><Link to="/coin/solana" className="hover:text-[#0C8B44] transition-colors">Solana price</Link></li>
              <li><Link to="/coin/ripple" className="hover:text-[#0C8B44] transition-colors">XRP price</Link></li>
              <li><Link to="/coin/cardano" className="hover:text-[#0C8B44] transition-colors">Cardano price</Link></li>
              <li><Link to="/coin/dogecoin" className="hover:text-[#0C8B44] transition-colors">Dogecoin price</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Support</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li><Link to="/help" className="hover:text-[#0C8B44] transition-colors">Help center</Link></li>
              <li><a href="mailto:hello@verdexis.com" className="hover:text-[#0C8B44] transition-colors">Contact us</a></li>
              <li><Link to="/settings" className="hover:text-[#0C8B44] transition-colors">Account settings</Link></li>
              <li><Link to="/wallet" className="hover:text-[#0C8B44] transition-colors">Payment methods</Link></li>
              <li><Link to="/status" className="hover:text-[#0C8B44] transition-colors">Status</Link></li>
              <li><a href="mailto:security@verdexis.com" className="hover:text-[#0C8B44] transition-colors">Report a vulnerability</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-6 border-t border-[#ffffff05]">
          <p className="text-[11px] text-[#737373]">© {year} Verdexis. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px] text-[#737373] flex-wrap justify-center">
            <Link to="/legal#privacy" className="hover:text-[#A0A0A0] transition-colors">Privacy</Link>
            <Link to="/legal#terms" className="hover:text-[#A0A0A0] transition-colors">Terms</Link>
            <Link to="/legal#cookies" className="hover:text-[#A0A0A0] transition-colors">Cookie policy</Link>
            <button type="button" onClick={openCookiePrefs} className="hover:text-[#A0A0A0] transition-colors">Cookie preferences</button>
            <Link to="/disclosures" className="hover:text-[#A0A0A0] transition-colors">Digital asset disclosures</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
