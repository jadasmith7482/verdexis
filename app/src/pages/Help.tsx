import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Search, ChevronRight, LifeBuoy, Mail, BookOpen, Shield,
  Wallet as WalletIcon, TrendingUp, Bell, AlertCircle,
} from 'lucide-react'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'

interface QA { q: string; a: string }
interface Section { id: string; title: string; icon: typeof BookOpen; items: QA[] }

// Hand-curated knowledge base. Keeping it inline keeps the bundle tiny and
// avoids an extra round-trip — these answers rarely change. If we ever
// outgrow this, lift to /server/src/routes/help.ts and fetch.
const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: BookOpen,
    items: [
      {
        q: 'How do I create an account?',
        a: 'Click "Get Started" in the top-right, enter your email and a strong password (12+ chars with letters, numbers, and a symbol). Verify your email and you\'re in. You can also sign in with Google.',
      },
      {
        q: 'What can I do with the free plan?',
        a: 'Real-time market data, portfolio tracking for up to 50 assets, basic AI insights, price alerts, and watchlists. No credit card required.',
      },
      {
        q: 'Is Verdexis available worldwide?',
        a: 'Account creation is open globally. Some funding methods (ACH, instant bank link) are US-only. Crypto deposits and withdrawals work everywhere.',
      },
    ],
  },
  {
    id: 'deposits',
    title: 'Deposits & Withdrawals',
    icon: WalletIcon,
    items: [
      {
        q: 'How do I deposit funds?',
        a: 'Open Wallet → Deposit. Choose Bank (instant verification or micro-deposits) or Crypto (we display a deposit address generated for your account, per supported network). ACH minimum is $10, maximum $100,000 per transaction. Crypto deposits have no Verdexis-imposed minimum, but please respect the dust thresholds of the underlying network.',
      },
      {
        q: 'Which crypto networks can I deposit?',
        a: 'BTC (Bitcoin), ETH and ERC-20 tokens (USDT, USDC) on Ethereum mainnet, SOL on Solana, XRP on the XRP Ledger, and DOGE on Dogecoin. Each currency is shown on its own deposit screen with the correct network label — always send on the matching network or your funds may be lost.',
      },
      {
        q: 'How do I deposit crypto?',
        a: 'Wallet → Deposit → Crypto, then pick the currency. Copy the address (or scan the QR code) and send the desired amount from your external wallet or exchange. If the network requires a memo / destination tag (e.g. XRP), include it exactly — omitting it can result in lost funds. Once the network confirms the transaction, we credit it to your Verdexis wallet.',
      },
      {
        q: 'How long do deposits take?',
        a: 'Instant bank link: same business day. Micro-deposits: 1–3 business days for verification, then funds available immediately. Crypto: typically a few network confirmations (a few minutes for SOL/XRP/USDC, ~10–60 minutes for ETH/BTC). Large or first-time deposits may be held for a brief compliance review before being credited.',
      },
      {
        q: 'Why is my deposit pending?',
        a: 'Deposits over $1,000 or first-time deposits are reviewed before crediting (typically under 4 hours). For crypto, we also wait until the transaction has the required number of network confirmations. You’ll get a notification when it clears.',
      },
      {
        q: 'I sent crypto on the wrong network — can you recover it?',
        a: 'In most cases, no. Funds sent on a network we do not display for that asset (e.g. USDT on Tron when only ERC-20 is shown) cannot be recovered. Always send on the exact network shown on the deposit screen.',
      },
      {
        q: 'How do I withdraw?',
        a: 'Wallet → Withdraw → choose method. Withdrawals to your linked bank arrive in 1-2 business days. Crypto withdrawals require address confirmation and typically settle within minutes.',
      },
      {
        q: 'Are there withdrawal fees?',
        a: 'Bank withdrawals are free. Crypto withdrawals incur the network gas fee plus a Verdexis processing fee that scales with the withdrawal amount (approximately 0.8% on small withdrawals down to a flat tier on very large ones). The exact fee is shown in the Withdraw screen before you confirm.',
      },
    ],
  },
  {
    id: 'fees',
    title: 'Fees & Charges',
    icon: WalletIcon,
    items: [
      {
        q: 'What fees does Verdexis charge?',
        a: 'Three things to know: (1) a 0.10% trading fee is added to buys and deducted from sells, shown in the Review modal before you confirm; (2) crypto withdrawals carry a small processing fee plus the network gas cost (always shown before you confirm); (3) funded accounts are subject to a 0.4% monthly account & management fee, debited from your USD wallet on the 26th of each month. Bank deposits, bank withdrawals, market data, alerts, and portfolio tracking are free.',
      },
      {
        q: 'When is the monthly account fee taken?',
        a: 'On the 26th of each calendar month, the 0.4% account & management fee is debited from your USD wallet. The fee is itemised in your transaction history with a clear description so you can reconcile it.',
      },
      {
        q: 'Are there any subscription fees?',
        a: 'The Starter plan is free forever. Pro and Enterprise plans (shown on the home page) are billed monthly and can be cancelled at any time from Settings.',
      },
    ],
  },
  {
    id: 'trading',
    title: 'Trading',
    icon: TrendingUp,
    items: [
      {
        q: 'How are trade fees calculated?',
        a: 'A flat 0.10% (10 basis points) is added to buys and deducted from sells. The fee is shown in the order Review modal before you confirm — no hidden costs.',
      },
      {
        q: 'What\'s the difference between market, limit, and stop orders?',
        a: 'Market: fills immediately at the best available price. Limit: only fills at your specified price or better. Stop: triggers when the market crosses your trigger price, then becomes a market order.',
      },
      {
        q: 'Why was my trade rejected?',
        a: 'Most common reasons: insufficient balance (we now pre-check this), market closed for the asset class, or limit/stop trigger not met. The error toast will tell you which.',
      },
      {
        q: 'Can I cancel an order?',
        a: 'Market orders fill instantly so they cannot be cancelled. Open limit/stop orders can be cancelled from the Activity page until they trigger.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & 2FA',
    icon: Shield,
    items: [
      {
        q: 'How is my data protected?',
        a: 'AES-256 encryption at rest, TLS 1.3 in transit, and security controls designed to align with the SOC 2 framework (we are not yet SOC 2 certified — certification work is in progress). Passwords are hashed with bcrypt. We never sell user data.',
      },
      {
        q: 'How do I enable two-factor authentication?',
        a: 'Settings → Security → toggle "Two-factor authentication". Scan the QR code with Google Authenticator, Authy, or 1Password and verify a 6-digit code. Save your backup codes somewhere safe.',
      },
      {
        q: 'I lost my 2FA device — how do I recover?',
        a: 'Use one of the 10 backup codes saved when you enabled 2FA. If you lost those too, email support with proof of identity — recovery typically takes 1-2 business days.',
      },
      {
        q: 'Does Verdexis hold my crypto?',
        a: 'For tracked wallets: no — we use read-only API connections. For deposits to your Verdexis address: yes, we custody until you withdraw, with the same controls as a regulated exchange.',
      },
    ],
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    icon: Bell,
    items: [
      {
        q: 'How do I set a price alert?',
        a: 'On any asset detail page or the Trading page, click "Set price alert". Choose above/below and a target price. We\'ll notify you in-app, by email, or push depending on your Settings.',
      },
      {
        q: 'How do I turn off email notifications?',
        a: 'Settings → Notifications. Toggle individual channels (email, push, SMS) and set quiet hours so nothing buzzes overnight.',
      },
    ],
  },
]

export default function Help() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SECTIONS
    return SECTIONS
      .map((s) => ({ ...s, items: s.items.filter((i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0)
  }, [query])

  return (
    <div className="min-h-screen bg-[#0a0f11] text-[#E5E5E5]">
      <Navigation />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[#737373] hover:text-[#0C8B44] transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>

        <div className="flex items-start gap-4 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-[#0C8B44]" />
          </div>
          <div>
            <h1 className="text-3xl font-light tracking-[-0.02em] text-[#E5E5E5]">Help Center</h1>
            <p className="text-sm text-[#A0A0A0] mt-1">Answers to common questions about your account, funds, and trades.</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="w-full pl-11 pr-4 py-3 bg-[#0f1619]/50 border border-[#ffffff10] rounded-xl text-sm placeholder-[#555] focus:outline-none focus:border-[#0C8B44]/40"
          />
        </div>

        {/* Section nav */}
        {!query && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
            {SECTIONS.map((s) => {
              const Icon = s.icon
              return (
                <a key={s.id} href={`#${s.id}`} className="p-3 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-colors text-center">
                  <Icon className="w-4 h-4 text-[#0C8B44] mx-auto mb-2" />
                  <p className="text-xs text-[#E5E5E5]">{s.title}</p>
                </a>
              )
            })}
          </div>
        )}

        {/* Sections */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle className="w-8 h-8 text-[#444] mx-auto mb-3" />
            <p className="text-sm text-[#A0A0A0]">No articles match "{query}". Try a different search or contact support below.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {filtered.map((section) => {
              const Icon = section.icon
              return (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-[#0C8B44]" />
                    <h2 className="text-lg font-medium text-[#E5E5E5]">{section.title}</h2>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <details key={item.q} className="group p-4 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/20 transition-colors">
                        <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-[#E5E5E5] list-none">
                          <span>{item.q}</span>
                          <ChevronRight className="w-4 h-4 text-[#0C8B44] transition-transform group-open:rotate-90 flex-shrink-0 ml-3" />
                        </summary>
                        <p className="text-sm text-[#A0A0A0] mt-3 leading-relaxed">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* Contact card */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-[#0C8B44]/10 to-transparent border border-[#0C8B44]/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-[#0C8B44]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#E5E5E5]">Still need help?</p>
              <p className="text-xs text-[#A0A0A0] mt-1">Our support team typically responds within 4 hours during business hours (Mon-Fri, 9am-6pm ET).</p>
            </div>
            <a href="mailto:support@verdexis.com" className="px-5 py-2.5 rounded-lg bg-[#0C8B44] text-white text-xs font-medium hover:bg-[#0a7539] transition-colors whitespace-nowrap">
              Email support
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
