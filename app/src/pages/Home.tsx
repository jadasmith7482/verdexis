import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'
import ScrambleText from '../components/ScrambleText'
import TetrahedronCanvas from '../components/Tetrahedron'
import { aiService, type AIInsight } from '../lib/aiService'
import { marketData, type CryptoQuote } from '../lib/marketData'
import { liveTicker } from '../lib/liveTicker'
import { formatPrice, formatUsdCompact } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, ArrowRight, Sparkles, Shield,
  Zap, BarChart3, PieChart, Activity, Bot,
  ChevronRight, Wallet, LineChart, BrainCircuit, Lock,
  Globe, Server, CheckCircle, Star, Play,
  FileText, Fingerprint, Eye,
} from 'lucide-react'

const testimonials: { name: string; role: string; company: string; image: string; text: string; rating: number }[] = []

const howItWorks = [
  { step: '01', title: 'Connect Your Accounts', desc: 'Link your exchange accounts, wallets, and bank accounts securely. Verdexis supports leading exchanges and major blockchains.', icon: Globe, color: '#0C8B44' },
  { step: '02', title: 'AI Analyzes Everything', desc: 'Our AI engine processes your entire financial picture — portfolio allocation, market conditions, and emerging opportunities — 24/7.', icon: BrainCircuit, color: '#6A0DAD' },
  { step: '03', title: 'Get Actionable Insights', desc: 'Receive personalized recommendations with confidence scores. Rebalance alerts, entry/exit signals, tax-loss harvesting — all instant.', icon: Zap, color: '#F57C00' },
  { step: '04', title: 'Execute With One Click', desc: 'Act on insights directly from the dashboard. Smart order routing finds the best prices. Set automated strategies.', icon: CheckCircle, color: '#2196F3' },
]

const pricingPlans = [
  { name: 'Starter', price: '0', period: 'forever free', desc: 'Perfect for new investors exploring the platform.', features: ['Real-time market data', 'Portfolio tracking (50 assets)', 'Basic AI insights', '1 connected exchange', 'Email support', 'Standard charting'], cta: 'Get Started Free', highlighted: false },
  { name: 'Pro', price: '29', period: '/month', desc: 'For serious traders who need professional tools.', features: ['Everything in Starter', 'Unlimited portfolio assets', 'Full AI analyst access', 'Unlimited exchanges', 'Priority execution routing', 'Advanced charting & indicators', 'Unlimited price alerts', 'API access (1K calls/day)'], cta: 'Upgrade to Pro', highlighted: true },
  { name: 'Institution', price: '99', period: '/month', desc: 'For funds, family offices, and professional teams.', features: ['Everything in Pro', 'Multi-user team accounts', 'Custom AI model training', 'White-label options', 'Dedicated account manager', 'Custom integrations', 'Unlimited API access', 'Priority support SLA', 'On-premise deployment'], cta: 'Contact Sales', highlighted: false },
]

const partnerLogos = [
  { name: 'CoinGecko', image: '/assets/logo-coingecko.png' },
  { name: 'Plaid', image: '/assets/logo-plaid.png' },
  { name: 'Stripe', image: '/assets/logo-stripe.png' },
  { name: 'Binance', image: '/assets/logo-binance.png' },
  { name: 'Alpha Vantage', image: '/assets/logo-alphavantage.png' },
  { name: 'Finnhub', image: '/assets/logo-finnhub.png' },
]

import { cryptoIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'

const securityFeatures = [
  { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit' },
  { icon: Fingerprint, title: 'Multi-Factor Authentication', desc: 'FIDO2 WebAuthn + TOTP support' },
  { icon: Eye, title: 'Privacy by Design', desc: 'Zero-knowledge architecture, no data selling' },
  { icon: Server, title: 'Cold Storage', desc: 'Majority of crypto assets held in air-gapped cold wallets' },
  { icon: Shield, title: 'Insurance Coverage', desc: 'Custodial assets covered by partner policies' },
  { icon: FileText, title: 'Full Audit Trail', desc: 'Immutable logs of every action on your account' },
]

export default function Home() {
  // If the user is already authenticated, send them straight to the
  // dashboard. Computed once per render — checked AFTER hooks below.
  const isAuthed = (() => {
    try {
      return !!localStorage.getItem('verdexis_token') || (!!localStorage.getItem('verdexis_auth') && !!localStorage.getItem('verdexis_holdings'))
    } catch {
      return false
    }
  })()

  const [insights, setInsights] = useState<AIInsight[]>([])
  const [cryptoData, setCryptoData] = useState<CryptoQuote[]>([])
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup')
  useEffect(() => {
    marketData.getCryptoList().then(setCryptoData)
    aiService.getPortfolioInsights().then(setInsights)
    // Refresh the snapshot list (sparklines, market caps, 24h %) every 30s
    // so even sections that key off CryptoQuote (not just liveTicker) stay
    // fresh while the visitor is on the landing page.
    const refresh = setInterval(() => {
      marketData.getCryptoList().then(setCryptoData)
    }, 30_000)
    return () => clearInterval(refresh)
  }, [])

  // Subscribe to live ticker for the top-5 coins so the marquee + preview
  // prices visibly tick every ~2s instead of being frozen on the snapshot
  // captured at mount. We key by coingecko id (the same id liveTicker uses
  // internally) and merge into a Record we read with useMemo below.
  const topIds = cryptoData.slice(0, 5).map((c) => c.id).join(',')
  useEffect(() => {
    if (!topIds) return
    const ids = topIds.split(',')
    const unsubs = ids.map((id) => liveTicker.subscribe(id, (p) => {
      setLivePrices((prev) => (prev[id] === p ? prev : { ...prev, [id]: p }))
    }))
    return () => { unsubs.forEach((u) => u()) }
  }, [topIds])

  const openSignup = () => { setAuthMode('signup'); setAuthOpen(true) }
  const openLogin = () => { setAuthMode('login'); setAuthOpen(true) }

  // Overlay live ticker prices on top of the CoinGecko snapshot so every
  // place that reads `current_price` automatically gets the fresh value.
  const liveCryptos = useMemo(() => cryptoData.map((c) => {
    const p = livePrices[c.id]
    return p != null && p > 0 ? { ...c, current_price: p } : c
  }), [cryptoData, livePrices])

  const topCryptos = liveCryptos.slice(0, 5)
  // Live total market cap of the top 5 cryptos shown in the preview. This is
  // an actual public market metric — not a fake "net worth".
  const totalValue = topCryptos.reduce((sum, c) => sum + (c.market_cap || 0), 0)
  // 24h weighted change across the same basket so the +/- next to the figure
  // reflects the same underlying numbers.
  const previousValue = topCryptos.reduce((sum, c) => {
    const mc = c.market_cap || 0
    const pct = c.price_change_percentage_24h || 0
    return sum + mc / (1 + pct / 100)
  }, 0)
  const change24hAbs = totalValue - previousValue
  const change24hPct = previousValue > 0 ? (change24hAbs / previousValue) * 100 : 0
  // BTC 7-day sparkline drives the preview chart so what the user sees on the
  // landing page is the same data the dashboard would show. Append the live
  // BTC price to the tail so the rightmost bar visibly grows/shrinks every
  // ~2s as new ticks arrive.
  const baseHeroSparkline = topCryptos.find((c) => c.id === 'bitcoin')?.sparkline_in_7d?.price
    ?? topCryptos[0]?.sparkline_in_7d?.price
    ?? []
  const heroLivePrice = livePrices['bitcoin'] ?? topCryptos.find((c) => c.id === 'bitcoin')?.current_price
  const heroSparkline = useMemo(() => {
    if (baseHeroSparkline.length === 0) return baseHeroSparkline
    if (heroLivePrice == null || heroLivePrice <= 0) return baseHeroSparkline
    const last = baseHeroSparkline[baseHeroSparkline.length - 1]
    if (Math.abs(heroLivePrice - last) / Math.max(last, 1e-9) < 1e-6) return baseHeroSparkline
    return [...baseHeroSparkline.slice(1), heroLivePrice]
  }, [baseHeroSparkline, heroLivePrice])
  const heroSparkSlim = heroSparkline.length > 30
    ? heroSparkline.filter((_, i) => i % Math.ceil(heroSparkline.length / 30) === 0).slice(0, 30)
    : heroSparkline
  const heroMin = heroSparkSlim.length ? Math.min(...heroSparkSlim) : 0
  const heroMax = heroSparkSlim.length ? Math.max(...heroSparkSlim) : 1
  const heroRange = Math.max(heroMax - heroMin, 1e-9)
  // Allocation weights = each top-3 coin's share of the top-3 market cap, so
  // the bars next to BTC/ETH/SOL are honest market-cap percentages.
  const top3MarketCap = topCryptos.slice(0, 3).reduce((s, c) => s + (c.market_cap || 0), 0)

  const getCryptoLogo = (c: { id?: string; symbol?: string; image?: string }) => cryptoIconFor(c)

  if (isAuthed) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} defaultMode={authMode} />

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '4px 4px' }}>
        <TetrahedronCanvas />
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto" style={{ marginTop: '-5vh' }}>
          <h1 className="text-6xl md:text-7xl lg:text-[80px] font-light tracking-[-0.04em] text-[#E5E5E5] mb-4">
            <ScrambleText text="Multiply Your Wealth." />
          </h1>
          <p className="text-2xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">AI-Powered Trading Meets Complete Financial Clarity.</p>
          <p className="text-base md:text-lg text-[#A0A0A0] max-w-lg mx-auto mb-10 leading-relaxed">Connect your wallets, automate your trades, and watch your net worth grow with institutional-grade AI analysis powered by real-time market data.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={openSignup} className="px-8 py-3.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Start Free &mdash; Sign Up</button>
            <Link to="/markets" className="flex items-center gap-2 px-8 py-3.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 transition-colors"><Play className="w-4 h-4" />Explore Markets</Link>
          </div>
          <p className="text-xs text-[#737373] mt-4">No credit card required. Free forever plan available. <button onClick={openLogin} className="text-[#0C8B44] hover:text-[#00E676] underline-offset-4 hover:underline transition-colors">Already have an account? Sign in</button></p>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="py-20 px-6 border-y border-[#ffffff08]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[{ value: 'Real-time', label: 'Market Data', icon: Activity }, { value: 'Multi-Asset', label: 'Crypto + Equities', icon: BarChart3 }, { value: 'AI-Native', label: 'Insights & Alerts', icon: BrainCircuit }, { value: '24/7', label: 'Global Coverage', icon: Globe }].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center mx-auto mb-4"><stat.icon className="w-6 h-6 text-[#0C8B44]" /></div>
                <p className="text-3xl md:text-4xl font-light tracking-[-0.03em] text-[#E5E5E5]">{stat.value}</p>
                <p className="text-sm text-[#737373] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LIVE PRICE TICKER ===== */}
      {topCryptos.length > 0 && (
        <section className="py-4 border-y border-[#ffffff08] bg-[#0a0f11] overflow-hidden">
          <div className="flex items-center gap-10 animate-marquee whitespace-nowrap">
            {[...topCryptos, ...topCryptos, ...topCryptos].map((c, idx) => (
              <Link to={`/asset/${c.id}`} key={`${c.id}-${idx}`} className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
                {getCryptoLogo(c) ? (
                  <img
                    src={getCryptoLogo(c)!}
                    alt={c.name}
                    className="w-5 h-5 rounded-full object-cover"
                    onError={cryptoIconErrorFallback(c.symbol.toUpperCase()[0] || '?', c.id)}
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#0C8B44]/20 text-[10px] font-bold text-[#0C8B44] flex items-center justify-center">{c.symbol.toUpperCase()[0]}</div>
                )}
                <span className="text-[#E5E5E5] font-medium">{c.symbol.toUpperCase()}</span>
                <span className="text-[#A0A0A0] tabular-nums">{formatPrice(c.current_price)}</span>
                <span className={c.price_change_percentage_24h >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}>
                  {c.price_change_percentage_24h >= 0 ? '▲' : '▼'} {Math.abs(c.price_change_percentage_24h).toFixed(2)}%
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

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
                  <div><p className="text-lg font-light text-[#E5E5E5]">+156.8%²</p><p className="text-xs text-[#737373]">Avg. user return (2024)</p></div>
                </div>
              </div>
            </div>
            <div>
              <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Why Traders Choose Us</span>
              <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">Built by Traders, for Traders</h2>
              <p className="text-[#A0A0A0] mb-8 leading-relaxed">We built Verdexis because we were frustrated with fragmented tools. No single platform combined professional-grade trading, AI analysis, and portfolio management. So we created it.</p>
              <div className="space-y-4">
                {[{ icon: Zap, title: 'Sub-second execution', desc: 'Smart order routing across leading exchanges' }, { icon: BrainCircuit, title: 'AI that actually helps', desc: 'Not generic advice &mdash; personalized, data-driven insights' }, { icon: Shield, title: 'Your keys, your crypto', desc: 'Non-custodial options with institutional security' }].map((item) => (                  <div key={item.title} className="flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
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
                  <p className="text-sm text-[#A0A0A0] mb-1">Top 5 Crypto Market Cap</p>
                  <p className="text-5xl font-light tracking-[-0.03em] text-[#E5E5E5]">{totalValue > 0 ? formatUsdCompact(totalValue) : '—'}</p>
                  {totalValue > 0 && (
                    <p className={`text-sm mt-1 flex items-center gap-1 ${change24hAbs >= 0 ? 'text-[#4CAF50]' : 'text-[#E53935]'}`}>
                      {change24hAbs >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {change24hAbs >= 0 ? '+' : ''}{formatUsdCompact(change24hAbs)} ({change24hPct >= 0 ? '+' : ''}{change24hPct.toFixed(2)}%)
                    </p>
                  )}
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[#0C8B44]/10 flex items-center justify-center"><Wallet className="w-8 h-8 text-[#0C8B44]" /></div>
              </div>
              <div className="h-24 flex items-end gap-1">
                {heroSparkSlim.length > 0 ? heroSparkSlim.map((p, i) => {
                  const h = ((p - heroMin) / heroRange) * 100
                  return <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(h, 4)}%`, background: i >= heroSparkSlim.length - 5 ? 'linear-gradient(to top, #0C8B44, #00E676)' : 'rgba(12,139,68,0.3)' }} />
                }) : <div className="flex-1 text-xs text-[#737373] text-center self-center">Loading live BTC chart…</div>}
              </div>
              <div className="mt-6 space-y-3">
                {topCryptos.slice(0, 3).map((c) => {
                  const share = top3MarketCap > 0 ? ((c.market_cap || 0) / top3MarketCap) * 100 : 0
                  return (
                  <Link to={`/asset/${c.id}`} key={c.id} className="flex items-center justify-between hover:bg-[#ffffff05] -mx-2 px-2 py-1 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      {getCryptoLogo(c) ? (
                        <img
                          src={getCryptoLogo(c)!}
                          alt={c.name}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={cryptoIconErrorFallback(c.symbol.toUpperCase()[0] || '?', c.id)}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{c.symbol.toUpperCase()[0]}</div>
                      )}
                      <span className="text-sm text-[#E5E5E5]">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-2 bg-[#1a1a1a] rounded-full overflow-hidden"><div className="h-full rounded-full bg-[#0C8B44]" style={{ width: `${share.toFixed(1)}%` }} /></div>
                      <span className="text-sm text-[#A0A0A0] w-20 text-right tabular-nums">{formatPrice(c.current_price)}</span>
                    </div>
                  </Link>
                  )
                })}
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
            {/* Market Cap Breakdown (top 3 cryptos, real share of basket) */}
            <div className="liquid-card p-8" style={{ '--fill-color': 'rgba(0,131,143,0.15)' } as React.CSSProperties}>
              <h3 className="text-lg font-medium text-[#E5E5E5] mb-4">Top 3 Market Share</h3>
              {(() => {
                const colors = ['#0C8B44', '#2196F3', '#FF9800']
                const slices = topCryptos.slice(0, 3).map((c, i) => ({
                  id: c.id,
                  label: c.name,
                  pct: top3MarketCap > 0 ? ((c.market_cap || 0) / top3MarketCap) * 100 : 0,
                  color: colors[i],
                  logo: getCryptoLogo(c),
                }))
                const C = 2 * Math.PI * 40 // circumference
                let offset = 0
                return (
                  <>
                    <div className="flex items-center justify-center mb-6">
                      {slices.length > 0 ? (
                        <svg viewBox="0 0 100 100" className="w-32 h-32">
                          {slices.map((s) => {
                            const len = (s.pct / 100) * C
                            const dasharray = `${len} ${C - len}`
                            const dashoffset = -offset
                            offset += len
                            return (
                              <circle key={s.id} cx="50" cy="50" r="40" fill="none" stroke={s.color} strokeWidth="20" strokeDasharray={dasharray} strokeDashoffset={dashoffset} transform="rotate(-90 50 50)" />
                            )
                          })}
                          <circle cx="50" cy="50" r="25" fill="#070C0E" />
                        </svg>
                      ) : (
                        <div className="w-32 h-32 rounded-full border border-[#ffffff10] flex items-center justify-center text-xs text-[#737373]">Loading…</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {slices.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.logo ? <img src={item.logo} alt={item.label} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />}
                            <span className="text-sm text-[#A0A0A0]">{item.label}</span>
                          </div>
                          <span className="text-sm text-[#E5E5E5]">{item.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
            {/* Market Pulse with REAL crypto logos */}
            <div className="liquid-card col-span-1 md:col-span-2 p-8" style={{ '--fill-color': 'rgba(12,139,68,0.1)' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-[#E5E5E5]">Live Markets</h3>
                <Link to="/markets" className="text-xs text-[#0C8B44] hover:text-[#00E676] transition-colors flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {topCryptos.slice(0, 3).map((c) => (
                  <Link to={`/asset/${c.id}`} key={c.id} className="block p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCryptoLogo(c) ? (
                          <img
                            src={getCryptoLogo(c)!}
                            alt={c.name}
                            className="w-6 h-6 rounded-full object-cover"
                            onError={cryptoIconErrorFallback(c.symbol.toUpperCase()[0] || '?', c.id)}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#0C8B44]/20 flex items-center justify-center text-xs font-bold text-[#0C8B44]">{c.symbol.toUpperCase()[0]}</div>
                        )}
                        <span className="text-sm font-medium text-[#E5E5E5]">{c.symbol.toUpperCase()}/USD</span>
                      </div>
                      {c.price_change_percentage_24h >= 0 ? <TrendingUp className="w-4 h-4 text-[#4CAF50]" /> : <TrendingDown className="w-4 h-4 text-[#f44336]" />}
                    </div>
                    <p className="text-2xl font-light text-[#E5E5E5]">{formatPrice(c.current_price)}</p>
                    <p className={`text-xs mt-1 ${c.price_change_percentage_24h >= 0 ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>{c.price_change_percentage_24h >= 0 ? '+' : ''}{c.price_change_percentage_24h.toFixed(2)}%</p>
                    <div className="flex items-end gap-0.5 mt-3 h-8">
                      {c.sparkline_in_7d?.price.slice(-20).map((price, i, arr) => {
                        const min = Math.min(...arr), max = Math.max(...arr), height = ((price - min) / (max - min)) * 100
                        return <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(10, height)}%`, background: c.price_change_percentage_24h >= 0 ? '#4CAF50' : '#f44336', opacity: 0.4 + (i / arr.length) * 0.6 }} />
                      })}
                    </div>
                  </Link>
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

      {/* ===== TESTIMONIALS (rendered only when populated) ===== */}
      {testimonials.length > 0 && (
      <section className="py-24 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">Testimonials</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">What our customers say</h2>
            <p className="text-[#A0A0A0] max-w-lg mx-auto">From retail traders to institutional funds.</p>
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
      )}
      {/* ===== HUMAN IMAGE SHOWCASE ===== */}
      <section className="py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[{ img: '/assets/showcase-team.jpg', title: 'Built for teams and individuals', desc: 'From solo day traders to fund teams — everyone finds their edge.' }, { img: '/assets/showcase-mobile.jpg', title: 'Trade anywhere, anytime', desc: 'Professional-grade tools in your pocket. Never miss a market move.' }, { img: '/assets/showcase-success.jpg', title: 'Built for serious investors', desc: 'Institutional-grade analytics, charting and AI insights for every portfolio.' }].map((card) => (
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
                <button onClick={() => {
                  if (plan.name === 'Institution') {
                    window.location.href = 'mailto:sales@verdexis.com?subject=Institution%20plan%20inquiry'
                  } else {
                    openSignup()
                  }
                }} className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${plan.highlighted ? 'bg-[#0C8B44] text-white hover:bg-[#0a7539]' : 'bg-[#1a1a1a] text-[#E5E5E5] hover:bg-[#252525]'}`}>{plan.cta}</button>
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
              <p className="text-[#A0A0A0] mb-8 leading-relaxed">Your assets and data are protected by the same security primitives used by leading financial institutions: defence-in-depth, least-privilege access, and encryption everywhere.</p>
              <div className="space-y-4">
                {securityFeatures.map((s) => (
                  <div key={s.title} className="flex items-start gap-4 p-4 rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff05]">
                    <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center shrink-0"><s.icon className="w-5 h-5 text-[#0C8B44]" /></div>
                    <div><p className="text-sm font-medium text-[#E5E5E5]">{s.title}</p><p className="text-xs text-[#737373]">{s.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
            {/* Security guarantees — plain text, no badge claims we can't substantiate. */}
            <div className="flex flex-col items-start justify-center gap-4 p-8 rounded-2xl bg-[#1a1a1a]/40 border border-[#ffffff05]">
              <Shield className="w-7 h-7 text-[#0C8B44]" />
              <h3 className="text-xl font-light text-[#E5E5E5]">Built on industry standards</h3>
              <ul className="space-y-2 text-sm text-[#A0A0A0]">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#0C8B44] mt-0.5 shrink-0" /> AES-256 encryption at rest, TLS 1.3 in transit.</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#0C8B44] mt-0.5 shrink-0" /> Optional TOTP two-factor authentication on every account.</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#0C8B44] mt-0.5 shrink-0" /> Audit logging on every financial action.</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-[#0C8B44] mt-0.5 shrink-0" /> GDPR &amp; CCPA data-rights workflow built in.</li>
              </ul>
              <p className="text-xs text-[#737373] pt-2">Engineered to align with SOC 2, ISO 27001, PCI DSS and GDPR control frameworks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-24 px-6 bg-[#0a0f11]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs tracking-[0.05em] uppercase text-[#0C8B44] mb-3 block">FAQ</span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">Common Questions</h2>
            <p className="text-[#A0A0A0]">Everything you need to know before getting started.</p>
          </div>
          <div className="space-y-3">
            {[
              { q: 'Is Verdexis really free?', a: 'Yes. The Starter plan is free forever and includes real-time market data, portfolio tracking for up to 50 assets, and basic AI insights. Upgrade only when you need advanced features.' },
              { q: 'Do you custody my crypto?', a: 'No. Verdexis is non-custodial by default — your keys, your crypto. We support read-only API connections to your exchanges and wallets so you can track and analyse without giving up control.' },
              { q: 'How is my data secured?', a: 'All data is encrypted with AES-256 at rest and TLS 1.3 in transit. Our controls are designed to align with SOC 2, ISO 27001 and PCI DSS frameworks, and we never sell user data.' },
              { q: 'Which exchanges and assets do you support?', a: 'Verdexis connects to leading centralised exchanges (Binance, Coinbase, Kraken and more) and the major blockchains (Bitcoin, Ethereum, Solana, BNB Chain, Polygon). Stocks and ETFs are sourced from Alpha Vantage and Finnhub.' },
              { q: 'Can I cancel my subscription anytime?', a: 'Yes — cancel any time from Settings. Paid plans are billed monthly with no long-term commitment, and you keep access until the end of the billing period.' },
              { q: 'Is the AI advice financial advice?', a: 'No. Verdexis AI provides market analysis and portfolio insights for educational purposes. It is not a registered investment adviser and nothing on the platform constitutes personalised investment advice.' },
            ].map((item) => (
              <details key={item.q} className="group p-5 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05] hover:border-[#0C8B44]/30 transition-colors">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-[#E5E5E5] list-none">
                  <span>{item.q}</span>
                  <ChevronRight className="w-4 h-4 text-[#0C8B44] transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-sm text-[#A0A0A0] mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
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
              <p className="text-[#A0A0A0] max-w-xl mx-auto mb-8">Sign up to get AI-powered trading, portfolio management and real-time market intelligence in one workspace.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={openSignup} className="px-8 py-3.5 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent">Get Started Free</button>
                <Link to="/markets" className="flex items-center gap-2 px-8 py-3.5 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#0C8B44] transition-colors">Explore Markets</Link>
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
      <Footer />
    </div>
  )
}