import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import AuthModal from '../components/AuthModal'
import ScrambleText from '../components/ScrambleText'
import TetrahedronCanvas from '../components/Tetrahedron'
import { aiService, type AIInsight } from '../lib/aiService'
import { marketData, type CryptoQuote } from '../lib/marketData'
import {
  TrendingUp, TrendingDown, ArrowRight, Sparkles, Shield,
  Zap, BarChart3, PieChart, Activity, Bot,
  ChevronRight, Wallet, LineChart, BrainCircuit, Lock,
  Globe, Server, Users, CheckCircle, Star, Play,
  Radio, FileText, Linkedin, Twitter, Fingerprint, Eye,
} from 'lucide-react'

const testimonials = [
  { name: 'Marcus Chen', role: 'Portfolio Manager', company: 'Apex Capital', image: '/assets/person-marcus.jpg', text: 'Verdexis transformed how I manage client portfolios. The AI insights improved our risk-adjusted returns by 23%. No more switching between Bloomberg and CoinGecko.', rating: 5 },
  { name: 'Sarah Williams', role: 'Retail Investor', company: 'Individual Trader', image: '/assets/person-sarah.jpg', text: 'I have tried dozens of platforms and none come close. The dashboard gives me a complete picture of my net worth across crypto and stocks.', rating: 5 },
  { name: 'David Okafor', role: 'CTO', company: 'Nexa Finance', image: '/assets/person-david.jpg', text: 'The WebSocket feeds are instant, charting is professional-grade, and the security architecture passed our compliance review with zero concerns.', rating: 5 },
  { name: 'Elena Rossi', role: 'Crypto Analyst', company: 'DeFi Research Lab', image: '/assets/person-elena.jpg', text: 'The depth of market data is unmatched for a free platform. Real-time prices, on-chain metrics, and AI sentiment analysis all in one interface.', rating: 5 },
  { name: 'James Park', role: 'Day Trader', company: 'Self-employed', image: '/assets/person-james.jpg', text: 'Execution speed matters in my world. Verdexis order routing is lightning fast and the charts rival TradingView at a fraction of the cost.', rating: 5 },
  { name: 'Amara Johnson', role: 'CFO', company: 'Greenfield Ventures', image: '/assets/person-amara.jpg', text: 'We needed a platform for treasury management and trading operations. Verdexis delivered with multi-sig wallets and full audit trails.', rating: 5 },
]

const howItWorks = [
  { step: '01', title: 'Connect Your Accounts', desc: 'Link your exchange accounts, wallets, and bank accounts securely. Verdexis supports 200+ exchanges and all major blockchains.', icon: Globe, color: '#0C8B44' },
  { step: '02', title: 'AI Analyzes Everything', desc: 'Our AI engine processes your entire financial picture — portfolio allocation, market conditions, and emerging opportunities — 24/7.', icon: BrainCircuit, color: '#6A0DAD' },
  { step: '03', title: 'Get Actionable Insights', desc: 'Receive personalized recommendations with confidence scores. Rebalance alerts, entry/exit signals, tax-loss harvesting — all instant.', icon: Zap, color: '#F57C00' },
  { step: '04', title: 'Execute With One Click', desc: 'Act on insights directly from the dashboard. Smart order routing finds the best prices. Set automated strategies.', icon: CheckCircle, color: '#2196F3' },
]

const pricingPlans = [
  { name: 'Starter', price: '0', period: 'forever free', desc: 'Perfect for new investors exploring the platform.', features: ['Real-time market data', 'Portfolio tracking (50 assets)', 'Basic AI insights', '1 connected exchange', 'Email support', 'Standard charting'], cta: 'Get Started Free', highlighted: false },
  { name: 'Pro', price: '29', period: '/month', desc: 'For serious traders who need professional tools.', features: ['Everything in Starter', 'Unlimited portfolio assets', 'Full AI analyst access', 'Unlimited exchanges', 'Priority execution routing', 'Advanced charting & indicators', 'Unlimited price alerts', 'API access (1K calls/day)'], cta: 'Start 14-Day Free Trial', highlighted: true },
  { name: 'Institution', price: '99', period: '/month', desc: 'For funds, family offices, and professional teams.', features: ['Everything in Pro', 'Multi-user team accounts', 'Custom AI model training', 'White-label options', 'Dedicated account manager', 'Custom integrations', 'Unlimited API access', '99.9% SLA guarantee', 'On-premise deployment'], cta: 'Contact Sales', highlighted: false },
]

const partnerLogos = [
  { name: 'CoinGecko', image: '/assets/logo-coingecko.png' },
  { name: 'Plaid', image: '/assets/logo-plaid.png' },
  { name: 'Stripe', image: '/assets/logo-stripe.png' },
  { name: 'Binance', image: '/assets/logo-binance.png' },
  { name: 'Alpha Vantage', image: '/assets/logo-alphavantage.png' },
  { name: 'Finnhub', image: '/assets/logo-finnhub.png' },
]

const cryptoLogos: Record<string, string> = {
  bitcoin: '/assets/logo-btc.png',
  ethereum: '/assets/logo-eth.png',
  solana: '/assets/logo-sol.png',
  cardano: '/assets/logo-ada.png',
  ripple: '/assets/logo-xrp.png',
  binancecoin: '/assets/logo-bnb.png',
  dogecoin: '/assets/logo-doge.png',
  tron: '/assets/logo-trx.png',
}

const securityFeatures = [
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit' },
  { icon: Fingerprint, title: 'Multi-Factor Authentication', desc: 'FIDO2 WebAuthn + TOTP support' },
  { icon: Eye, title: 'Privacy by Design', desc: 'Zero-knowledge architecture, no data selling' },
  { icon: Server, title: 'Cold Storage', desc: '98% of crypto assets in air-gapped cold wallets' },
  { icon: Shield, title: 'Insurance Coverage', desc: '$250M digital asset insurance policy' },
  { icon: FileText, title: 'Full Audit Trail', desc: 'Immutable logs of every action on your account' },
]

export default function Home() {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [cryptoData, setCryptoData] = useState<CryptoQuote[]>([])
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    marketData.getCryptoList().then(setCryptoData)
    aiService.getPortfolioInsights().then(setInsights)
    setLoading(false)
  }, [])

  const openSignup = () => { setAuthMode('signup'); setAuthOpen(true) }

  const topCryptos = cryptoData.slice(0, 5)
  const totalValue = 2847293.5

  const getCryptoLogo = (id: string) => cryptoLogos[id] || null

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '4px 4px' }}>
        <TetrahedronCanvas />
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto" style={{ marginTop: '-5vh' }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0C8B44]/10 border border-[#0C8B44]/30 mb-8">
            <Radio className="w-3 h-3 text-[#0C8B44] animate-pulse" />
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44]">{loading ? 'Loading market data...' : 'Live with real market data'}</span>
          </div>
          <h1 className="text-6xl md:text-7xl lg:text-[80px] font-light tracking-[-0.04em] text-[#E5E5E5] mb-4">
            <ScrambleText text="Multiply Your Wealth." />
          </h1>
          <p className="text-2xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">AI-Powered Trading Meets Complete Financial Clarity.</p>
          <p className="text-base md:text-lg text-[#A0A0A0] max-w-lg mx-auto mb-10 leading-relaxed">Connect your wallets, automate your trades, and watch your net worth grow with institutional-grade AI analysis powered by real-time market data.</p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={openSignup} className="px-8 py-3.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Start Free &mdash; Sign Up</button>
            <Link to="/trading" className="flex items-center gap-2 px-8 py-3.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 transition-colors"><Play className="w-4 h-4" />Explore Markets</Link>
          </div>
          <p className="text-xs text-[#737373] mt-4">No credit card required. Free forever plan available.</p>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="py-20 px-6 border-y border-[#ffffff08]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[{ value: '$2.4B+', label: 'Assets Tracked', icon: BarChart3 }, { value: '127K+', label: 'Active Traders', icon: Users }, { value: '200+', label: 'Exchanges Connected', icon: Globe }, { value: '99.9%', label: 'Uptime SLA', icon: Server }].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mx-auto mb-4"><stat.icon className="w-6 h-6 text-[#0C8B44]" /></div>
                <p className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">{stat.value}</p>
                <p className="text-sm text-[#737373] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PARTNER LOGOS ===== */}
      <section className="py-16 px-6 bg-[#070C0E] border-y border-[#ffffff08]">
        <div className="max-w-[1280px] mx-auto">
          <p className="text-center text-xs tracking-[0.05em] uppercase text-[#737373] mb-8">Trusted by leading platforms</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {partnerLogos.map((p) => (
              <div key={p.name} className="flex items-center px-4 py-2.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm">
                <img src={p.image} alt={p.name} className="h-5 w-auto object-contain" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">How It Works</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Four Steps to Smarter Investing</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">From account connection to AI-powered execution &mdash; a seamless journey.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step) => (
              <div key={step.step} className="relative">
                <div className="liquid-card p-8 h-full" style={{ '--fill-color': `${step.color}15` } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${step.color}15`, border: `1px solid ${step.color}30` }}>
                      <step.icon className="w-7 h-7" style={{ color: step.color }} />
                    </div>
                    <span className="text-4xl font-light text-[#ffffff08]">{step.step}</span>
                  </div>
                  <h3 className="text-xl font-medium text-[#E5E5E5] mb-3">{step.title}</h3>
                  <p className="text-sm text-[#A0A0A0] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HUMAN IMAGE + SOCIAL PROOF ===== */}
      <section className="py-24 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-[#ffffff08]">
                <img src="/assets/showcase-trading-desk.jpg" alt="Professional trading setup" className="w-full h-[400px] object-cover" />
              </div>
              <div className="absolute -bottom-6 -right-6 glass-card p-4 rounded-xl border border-[#0C8B44]/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#0C8B44]/20 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-[#0C8B44]" /></div>
                  <div><p className="text-lg font-light text-[#E5E5E5]">+156.8%</p><p className="text-xs text-[#737373]">Avg. user return (2024)</p></div>
                </div>
              </div>
            </div>
            <div>
              <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Why Traders Choose Us</span>
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">Built by Traders, for Traders</h2>
              <p className="text-[#A0A0A0] mb-8 leading-relaxed">We built Verdexis because we were frustrated with fragmented tools. No single platform combined professional-grade trading, AI analysis, and portfolio management. So we created it.</p>
              <div className="space-y-4">
                {[{ icon: Zap, title: 'Sub-second execution', desc: 'Smart order routing across 200+ exchanges' }, { icon: BrainCircuit, title: 'AI that actually helps', desc: 'Not generic advice &mdash; personalized, data-driven insights' }, { icon: Shield, title: 'Your keys, your crypto', desc: 'Non-custodial options with institutional security' }].map((item) => (
                  <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                    <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center shrink-0"><item.icon className="w-5 h-5 text-[#0C8B44]" /></div>
                    <div><p className="text-sm font-medium text-[#E5E5E5]">{item.title}</p><p className="text-xs text-[#737373]">{item.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== DASHBOARD PREVIEW with REAL CRYPTO LOGOS ===== */}
      <section className="py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Dashboard</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Your Financial Command Center</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">Real-time portfolio tracking, AI insights, and market analysis &mdash; all in one place.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Net Worth */}
            <div className="liquid-card col-span-1 md:col-span-2 p-8" style={{ '--fill-color': 'rgba(12,139,68,0.15)' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-[#A0A0A0] mb-1">Total Net Worth</p>
                  <p className="text-5xl font-light tracking-[-0.03em] text-[#E5E5E5]">${totalValue.toLocaleString()}</p>
                  <p className="text-sm text-[#4CAF50] mt-1 flex items-center gap-1"><TrendingUp className="w-4 h-4" />+$124,532 (+4.6%)</p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center"><Wallet className="w-8 h-8 text-[#0C8B44]" /></div>
              </div>
              <div className="h-24 flex items-end gap-1">
                {Array.from({ length: 30 }, (_, i) => <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${40 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%`, background: i > 25 ? 'linear-gradient(to top, #0C8B44, #00E676)' : 'rgba(12,139,68,0.3)' }} />)}
              </div>
              <div className="mt-6 space-y-3">
                {topCryptos.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getCryptoLogo(c.id) ? (
                        <img src={getCryptoLogo(c.id)!} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{c.symbol.toUpperCase()[0]}</div>
                      )}
                      <span className="text-sm text-[#E5E5E5]">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-2 bg-[#1a1a1a] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#0C8B44]" style={{ width: `${Math.random() * 60 + 20}%` }} /></div>
                      <span className="text-sm text-[#A0A0A0] w-20 text-right">${c.current_price.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* AI Strategy */}
            <div className="liquid-card p-8" style={{ '--fill-color': 'rgba(106,13,173,0.15)' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#6A0DAD]/20 flex items-center justify-center"><BrainCircuit className="w-6 h-6 text-[#9C27B0]" /></div>
                <div><h3 className="text-lg font-medium text-[#E5E5E5]">AI Strategy</h3><p className="text-xs text-[#737373]">Updated 2 min ago</p></div>
              </div>
              {insights[0] && (
                <div className="mb-6 p-4 rounded-xl bg-[#6A0DAD]/10 border border-[#6A0DAD]/20">
                  <p className="text-sm text-[#E5E5E5] leading-relaxed">{insights[0].description}</p>
                  <div className="flex items-center gap-2 mt-3"><span className="text-xs text-[#737373]">Confidence</span><div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[#6A0DAD] to-[#9C27B0]" style={{ width: `${insights[0].confidence}%` }} /></div><span className="text-xs text-[#9C27B0]">{insights[0].confidence}%</span></div>
                </div>
              )}
              <div className="space-y-3">
                {insights.slice(1, 3).map((ins, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#1a1a1a]/50">
                    {ins.type === 'alert' ? <Zap className="w-4 h-4 text-[#F57C00] mt-0.5 shrink-0" /> : <Sparkles className="w-4 h-4 text-[#0C8B44] mt-0.5 shrink-0" />}
                    <div><p className="text-xs font-medium text-[#E5E5E5]">{ins.title}</p><p className="text-xs text-[#737373] mt-1 line-clamp-2">{ins.description}</p></div>
                  </div>
                ))}
              </div>
              <Link to="/ai" className="flex items-center justify-center gap-2 mt-6 py-3 rounded-xl bg-[#6A0DAD]/20 text-[#9C27B0] text-sm font-medium hover:bg-[#6A0DAD]/30 transition-colors"><Bot className="w-4 h-4" />Ask AI Analyst</Link>
            </div>
            {/* Portfolio Breakdown */}
            <div className="liquid-card p-8" style={{ '--fill-color': 'rgba(0,131,143,0.15)' } as React.CSSProperties}>
              <h3 className="text-lg font-medium text-[#E5E5E5] mb-4">Portfolio Breakdown</h3>
              <div className="flex items-center justify-center mb-6">
                <svg viewBox="0 0 100 100" className="w-32 h-32">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#0C8B44" strokeWidth="20" strokeDasharray="125.6 125.6" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#2196F3" strokeWidth="20" strokeDasharray="75.4 175.8" strokeDashoffset="-125.6" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#FF9800" strokeWidth="20" strokeDasharray="50.2 201" strokeDashoffset="-201" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="25" fill="#070C0E" />
                </svg>
              </div>
              <div className="space-y-2">
                {[{ label: 'Bitcoin', value: '45%', color: '#0C8B44', logo: '/assets/logo-btc.png' }, { label: 'Ethereum', value: '27%', color: '#2196F3', logo: '/assets/logo-eth.png' }, { label: 'Solana', value: '18%', color: '#FF9800', logo: '/assets/logo-sol.png' }, { label: 'Cash', value: '10%', color: '#737373', logo: null }].map((item) => (
                  <div key={item.label} className="flex items-center justify-between"><div className="flex items-center gap-2">{item.logo ? <img src={item.logo} alt={item.label} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />}<span className="text-sm text-[#A0A0A0]">{item.label}</span></div><span className="text-sm text-[#E5E5E5]">{item.value}</span></div>
                ))}
              </div>
            </div>
            {/* Market Pulse with REAL crypto logos */}
            <div className="liquid-card col-span-1 md:col-span-2 p-8" style={{ '--fill-color': 'rgba(12,139,68,0.1)' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-[#E5E5E5]">Live Markets</h3>
                <Link to="/trading" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {topCryptos.slice(0, 3).map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCryptoLogo(c.id) ? (
                          <img src={getCryptoLogo(c.id)!} alt={c.name} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{c.symbol.toUpperCase()[0]}</div>
                        )}
                        <span className="text-sm font-medium text-[#E5E5E5]">{c.symbol.toUpperCase()}/USD</span>
                      </div>
                      {c.price_change_percentage_24h >= 0 ? <TrendingUp className="w-4 h-4 text-[#4CAF50]" /> : <TrendingDown className="w-4 h-4 text-[#f44336]" />}
                    </div>
                    <p className="text-2xl font-light text-[#E5E5E5]">${c.current_price.toLocaleString()}</p>
                    <p className={`text-xs mt-1 ${c.price_change_percentage_24h >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{c.price_change_percentage_24h >= 0 ? '+' : ''}{c.price_change_percentage_24h.toFixed(2)}%</p>
                    <div className="flex items-end gap-0.5 mt-3 h-8">
                      {c.sparkline_in_7d?.price.slice(-20).map((price, i, arr) => {
                        const min = Math.min(...arr), max = Math.max(...arr), height = ((price - min) / (max - min)) * 100
                        return <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(10, height)}%`, background: c.price_change_percentage_24h >= 0 ? '#4CAF50' : '#f44336', opacity: 0.4 + (i / arr.length) * 0.6 }} />
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== AI ASSISTANT with REAL AI ROBOT IMAGE ===== */}
      <section className="py-24 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">AI Assistant</span>
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">Your Personal AI Financial Analyst</h2>
              <p className="text-[#A0A0A0] mb-8 leading-relaxed">Get real-time portfolio analysis, market insights, and personalized trading strategies powered by advanced AI. Our assistant processes market data 24/7 to keep you ahead of the curve.</p>
              <div className="space-y-4">
                {[{ icon: BarChart3, text: 'Portfolio performance analysis' }, { icon: Activity, text: 'Real-time market sentiment tracking' }, { icon: Shield, text: 'Risk assessment and alerts' }, { icon: Zap, text: 'Automated trading strategies' }].map((f) => (
                  <div key={f.text} className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-[#0C8B44]/20 flex items-center justify-center"><f.icon className="w-4 h-4 text-[#0C8B44]" /></div><span className="text-sm text-[#E5E5E5]">{f.text}</span></div>
                ))}
              </div>
              <Link to="/ai" className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Try AI Analyst<ArrowRight className="w-4 h-4" /></Link>
            </div>
            {/* REAL AI ROBOT IMAGE */}
            <div className="rounded-2xl overflow-hidden border border-[#ffffff08]">
              <img src="/assets/ai-robot-hero.jpg" alt="AI Financial Analyst Robot" className="w-full h-[500px] object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Features</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Everything You Need to Win</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">A complete suite of professional-grade tools for modern investors.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ icon: LineChart, title: 'Advanced Trading', desc: 'Execute trades with precision using our professional-grade interface with real-time charts and full order book depth.', color: '#0C8B44' }, { icon: BrainCircuit, title: 'AI-Powered Insights', desc: 'Get personalized investment recommendations and market analysis from our advanced AI financial analyst.', color: '#6A0DAD' }, { icon: Shield, title: 'Bank-Grade Security', desc: 'Your assets are protected with multi-signature wallets, 2FA, and institutional-grade AES-256 encryption.', color: '#00838F' }, { icon: PieChart, title: 'Portfolio Tracking', desc: 'Track all your assets across crypto and traditional markets in one unified, real-time dashboard.', color: '#F57C00' }, { icon: Activity, title: 'Real-Time Data', desc: 'Access live market data from global exchanges with sub-second updates and comprehensive coverage.', color: '#2196F3' }, { icon: Wallet, title: 'Multi-Asset Wallet', desc: 'Manage crypto and fiat in one place. Deposit, withdraw, and transfer with ease and low fees.', color: '#4CAF50' }].map((f) => (
              <div key={f.title} className="p-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110" style={{ background: `${f.color}15` }}><f.icon className="w-7 h-7" style={{ color: f.color }} /></div>
                <h3 className="text-xl font-medium text-[#E5E5E5] mb-3">{f.title}</h3>
                <p className="text-sm text-[#A0A0A0] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-24 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Testimonials</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Trusted by 127,000+ Investors</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">From retail traders to institutional funds &mdash; hear what our users say.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="p-8 rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/20 transition-all">
                <div className="flex items-center gap-1 mb-6">
                  {Array.from({ length: t.rating }, (_, i) => <Star key={i} className="w-5 h-5 text-[#F57C00]" fill="#F57C00" />)}
                </div>
                <p className="text-base text-[#A0A0A0] leading-relaxed mb-8">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-4 pt-6 border-t border-[#ffffff08]">
                  <img src={t.image} alt={t.name} className="w-14 h-14 rounded-full object-cover" />
                  <div><p className="text-base font-medium text-[#E5E5E5]">{t.name}</p><p className="text-sm text-[#737373]">{t.role} at {t.company}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HUMAN IMAGE SHOWCASE ===== */}
      <section className="py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ img: '/assets/showcase-team.jpg', title: 'Built for teams and individuals', desc: 'From solo day traders to 50-person fund teams — everyone finds their edge.' }, { img: '/assets/showcase-mobile.jpg', title: 'Trade anywhere, anytime', desc: 'Professional-grade tools in your pocket. Never miss a market move.' }, { img: '/assets/showcase-success.jpg', title: 'Real traders, real results', desc: 'Our users report an average 156% portfolio growth in their first year.' }].map((card) => (
              <div key={card.title} className="rounded-2xl overflow-hidden border border-[#ffffff08] group">
                <img src={card.img} alt={card.title} className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="p-6"><p className="text-base font-medium text-[#E5E5E5]">{card.title}</p><p className="text-sm text-[#737373] mt-1">{card.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Pricing</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Choose Your Plan</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">Start free, scale as you grow. No hidden fees. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.map((plan) => (
              <div key={plan.name} className={`p-8 rounded-2xl border transition-all relative ${plan.highlighted ? 'bg-[#0C8B44]/5 border-[#0C8B44]/40' : 'bg-[#0f1619]/50 border-[#ffffff05]'}`}>
                {plan.highlighted && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0C8B44] rounded-full text-xs font-medium text-white tracking-wide">MOST POPULAR</div>}
                <h3 className="text-xl font-medium text-[#E5E5E5] mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2"><span className="text-4xl font-light text-[#E5E5E5]">${plan.price}</span><span className="text-sm text-[#737373]">{plan.period}</span></div>
                <p className="text-sm text-[#A0A0A0] mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm text-[#A0A0A0]"><CheckCircle className="w-4 h-4 text-[#0C8B44] shrink-0 mt-0.5" />{feature}</li>)}
                </ul>
                <button onClick={openSignup} className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${plan.highlighted ? 'bg-[#0C8B44] text-white hover:bg-[#0a7539]' : 'bg-[#1a1a1a] text-[#E5E5E5] hover:bg-[#252525]'}`}>{plan.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECURITY (NO DUPLICATE BADGES - just text features) ===== */}
      <section className="py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Security</span>
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">Institutional-Grade Protection</h2>
              <p className="text-[#A0A0A0] mb-8 leading-relaxed">Your assets and data are protected by the same security standards used by the world&apos;s largest financial institutions. SOC 2 Type II certified, with regular third-party audits.</p>
              <div className="space-y-4">
                {securityFeatures.map((s) => (
                  <div key={s.title} className="flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                    <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center shrink-0"><s.icon className="w-5 h-5 text-[#0C8B44]" /></div>
                    <div><p className="text-sm font-medium text-[#E5E5E5]">{s.title}</p><p className="text-xs text-[#737373]">{s.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            {/* Real certification seals */}
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <img src="/assets/seal-soc2.png" alt="SOC 2 Type II Certified" className="h-20 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity" />
                <img src="/assets/seal-iso27001.png" alt="ISO 27001 Certified" className="h-20 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-3 text-xs text-[#737373]">
                <Shield className="w-4 h-4 text-[#0C8B44]" />
                <span>SOC 2 Type II &middot; ISO 27001 &middot; PCI DSS &middot; GDPR Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-24 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="liquid-card p-12 md:p-16 text-center relative overflow-hidden" style={{ '--fill-color': 'rgba(12,139,68,0.08)' } as React.CSSProperties}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(rgba(12,139,68,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Ready to Transform Your Wealth?</h2>
              <p className="text-[#A0A0A0] max-w-xl mx-auto mb-8">Join 127,000+ investors who trust Verdexis for AI-powered trading, portfolio management, and real-time market intelligence.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={openSignup} className="px-8 py-3.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Get Started Free</button>
                <Link to="/trading" className="flex items-center gap-2 px-8 py-3.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#0C8B44] transition-colors">Explore Markets</Link>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8 text-xs text-[#737373]">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-[#0C8B44]" />No credit card required</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-[#0C8B44]" />Free forever plan</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-[#0C8B44]" />Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-16 px-6 border-t border-[#ffffff08]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="/assets/logo-icon-dark.png" alt="Verdexis" className="w-14 h-14" />
                <span className="text-xl font-light tracking-[0.15em] uppercase text-[#E5E5E5]">VERDEXIS</span>
              </div>
              <p className="text-sm text-[#737373] max-w-xs leading-relaxed">AI-powered trading and portfolio management for the modern investor. Real-time data. Institutional security.</p>
              <div className="flex items-center gap-4 mt-4">
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="text-[#737373] hover:text-[#0C8B44] transition-colors"><Twitter className="w-4 h-4" /></a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-[#737373] hover:text-[#0C8B44] transition-colors"><Linkedin className="w-4 h-4" /></a>
              </div>
            </div>
            {[
              { title: 'Product', links: [{ label: 'Markets', to: '/trading' }, { label: 'News', to: '/news' }, { label: 'AI Analyst', to: '/ai' }, { label: 'Pricing', to: '/#pricing' }] },
              { title: 'Resources', links: [{ label: 'Dashboard', to: '/dashboard' }, { label: 'Wallet', to: '/wallet' }, { label: 'Market Data', to: '/trading' }] },
              { title: 'Company', links: [{ label: 'About', to: '/about' }, { label: 'Contact', to: '/about#contact' }, { label: 'Settings', to: '/settings' }] },
              { title: 'Legal', links: [{ label: 'Privacy', to: '/legal#privacy' }, { label: 'Terms', to: '/legal#terms' }, { label: 'Security', to: '/legal#security' }] },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-sm font-medium text-[#E5E5E5] mb-4">{col.title}</p>
                <ul className="space-y-2">{col.links.map((link) => <li key={link.label}><Link to={link.to} className="text-sm text-[#737373] hover:text-[#0C8B44] transition-colors">{link.label}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-[#ffffff08]">
            <p className="text-xs text-[#737373]">&copy; 2025 Verdexis. All rights reserved.</p>
            <p className="text-xs text-[#737373]">SOC 2 Type II &middot; ISO 27001 &middot; PCI DSS &middot; GDPR Compliant</p>
          </div>
        </div>
      </footer>
    </div>
  )
}