import { Link } from 'react-router-dom'
import { Shield, Lock, MapPin } from 'lucide-react'

const openCookiePrefs = () => {
  try { localStorage.removeItem('verdexis_cookie_consent') } catch { /* ignore */ }
  window.dispatchEvent(new Event('verdexis:open-cookie-prefs'))
}

// Contact info — phone routes to WhatsApp / Telegram via deep links.
// E.164: +17196798790 (no spaces, used for wa.me / t.me URLs).
const CONTACT_PHONE_DISPLAY = '+1 (719) 679-8790'
const CONTACT_PHONE_E164 = '17196798790'
const WHATSAPP_URL = `https://wa.me/${CONTACT_PHONE_E164}`
const TELEGRAM_URL = `https://t.me/+${CONTACT_PHONE_E164}`
const OFFICE_ADDRESS_LINES = ['Verdexis HQ', '102 S. Tejon Street, Suite 1100', 'Colorado Springs, CO 80903, USA']
const OFFICE_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=102+S+Tejon+Street+Colorado+Springs+CO+80903'

function WhatsAppIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M19.11 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.43 1.32 4.92L2 22l5.32-1.4a9.86 9.86 0 0 0 4.71 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.84-6.98zM12.04 20.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.16.83.84-3.08-.2-.32a8.21 8.21 0 0 1-1.26-4.32c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.21-8.22 8.21zm4.74-6.16c-.26-.13-1.54-.76-1.78-.85-.24-.09-.41-.13-.59.13-.17.26-.67.85-.83 1.02-.15.17-.31.2-.57.07-.26-.13-1.1-.4-2.1-1.29-.78-.69-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.26-.31.39-.46.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.07-.13-.59-1.42-.81-1.95-.21-.51-.43-.44-.59-.45h-.5c-.17 0-.45.06-.69.32-.24.26-.91.89-.91 2.17 0 1.28.93 2.51 1.06 2.69.13.17 1.83 2.79 4.43 3.91.62.27 1.1.43 1.48.55.62.2 1.19.17 1.64.1.5-.07 1.54-.63 1.76-1.24.22-.61.22-1.13.15-1.24-.07-.11-.24-.17-.5-.3z"/>
    </svg>
  )
}

function TelegramIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M9.78 15.96l-.4 4.05c.57 0 .82-.24 1.13-.54l2.71-2.55 5.62 4.04c1.03.56 1.77.27 2.04-.94L23.92 3.6c.36-1.5-.55-2.09-1.55-1.72L1.4 9.66c-1.46.56-1.44 1.37-.25 1.74l5.32 1.65 12.36-7.71c.58-.36 1.11-.16.68.21L9.78 15.96z"/>
    </svg>
  )
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

            {/* Office address */}
            <a
              href={OFFICE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-start gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] transition-colors not-italic"
            >
              <MapPin className="w-3.5 h-3.5 text-[#0C8B44] mt-0.5 shrink-0" />
              <address className="not-italic leading-relaxed">
                {OFFICE_ADDRESS_LINES.map((line, i) => (
                  <span key={line} className="block">
                    {i === 0 ? <span className="text-[#E5E5E5]">{line}</span> : line}
                  </span>
                ))}
              </address>
            </a>

            {/* Contact channels: WhatsApp + Telegram */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Chat on WhatsApp at ${CONTACT_PHONE_DISPLAY}`}
                title={`WhatsApp ${CONTACT_PHONE_DISPLAY}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[11px] text-[#E5E5E5] hover:bg-[#25D366]/20 transition-colors"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                <span>WhatsApp</span>
              </a>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Message on Telegram at ${CONTACT_PHONE_DISPLAY}`}
                title={`Telegram ${CONTACT_PHONE_DISPLAY}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#229ED9]/10 border border-[#229ED9]/30 text-[11px] text-[#E5E5E5] hover:bg-[#229ED9]/20 transition-colors"
              >
                <TelegramIcon className="w-3.5 h-3.5 text-[#229ED9]" />
                <span>Telegram</span>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-[#A0A0A0]">
            <span className="flex items-center gap-1.5" title="All traffic encrypted with TLS 1.3"><Lock className="w-3 h-3 text-[#0C8B44]" /> TLS 1.3 Encrypted</span>
            <span className="flex items-center gap-1.5" title="Data at rest encrypted with AES-256"><Shield className="w-3 h-3 text-[#0C8B44]" /> AES-256 at Rest</span>
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
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#0C8B44] transition-colors"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                  Contact
                </a>
              </li>
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
              <li><Link to="/markets" className="hover:text-[#0C8B44] transition-colors">All markets</Link></li>
              <li><Link to="/trading?symbol=BTC" className="hover:text-[#0C8B44] transition-colors">Explore crypto</Link></li>
              <li><Link to="/trading?symbol=AAPL" className="hover:text-[#0C8B44] transition-colors">Explore stocks</Link></li>
              <li><Link to="/news" className="hover:text-[#0C8B44] transition-colors">Market news</Link></li>
              <li><Link to="/dashboard#watchlist" className="hover:text-[#0C8B44] transition-colors">Watchlist</Link></li>
              <li><Link to="/dashboard" className="hover:text-[#0C8B44] transition-colors">Portfolio overview</Link></li>
              <li><Link to="/alerts" className="hover:text-[#0C8B44] transition-colors">Price alerts</Link></li>
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
              <li><Link to="/help#getting-started" className="hover:text-[#0C8B44] transition-colors">Getting started</Link></li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#0C8B44] transition-colors"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                  WhatsApp support
                </a>
              </li>
              <li><Link to="/settings" className="hover:text-[#0C8B44] transition-colors">Account settings</Link></li>
              <li><Link to="/wallet?action=deposit" className="hover:text-[#0C8B44] transition-colors">Payment methods</Link></li>
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
