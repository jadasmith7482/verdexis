import Navigation from '../components/Navigation'
import { Link } from 'react-router-dom'
import {
  Sparkles, Shield, Globe, Users, Zap, Heart, Mail, Twitter, Linkedin, ArrowRight,
} from 'lucide-react'

const stats = [
  { label: 'Markets covered', value: 'Crypto + Equities' },
  { label: 'Data', value: 'Real-time' },
  { label: 'AI personas', value: '7' },
  { label: 'Availability', value: '24/7' },
]

const values = [
  { icon: Shield, title: 'Trust by default', text: 'Security and transparency are not features — they are the foundation. Every line of code is written with your assets in mind.' },
  { icon: Sparkles, title: 'AI that explains itself', text: 'Black-box predictions help no one. Every insight ships with a confidence score and the data it was based on.' },
  { icon: Globe, title: 'Open to everyone', text: 'A free tier that is genuinely useful, not a teaser. Wealth-building tools should not be gated behind subscriptions.' },
  { icon: Heart, title: 'Built for the long run', text: 'We optimize for decades, not quarters. No dark patterns, no surprise fees, no selling your data.' },
]

export default function About() {
  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1080px] mx-auto">
          {/* Hero */}
          <div className="text-center max-w-2xl mx-auto mb-20">
            <p className="text-xs tracking-[0.3em] uppercase text-[#0C8B44] mb-4">About Verdexis</p>
            <h1 className="text-5xl md:text-6xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6 leading-[1.1]">
              Connecting people to the markets they deserve.
            </h1>
            <p className="text-lg text-[#A0A0A0] leading-relaxed">
              Verdexis is the AI-native fintech platform that brings institutional-grade trading,
              portfolio intelligence, and banking into a single calm interface. Verde — Italian
              for prosperity. Nexus — connection. We are the bridge.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
            {stats.map((s) => (
              <div key={s.label} className="glass-card p-6 text-center">
                <p className="text-3xl md:text-4xl font-light tracking-[-0.02em] text-[#E5E5E5]">{s.value}</p>
                <p className="text-xs text-[#737373] mt-2 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Mission */}
          <div className="liquid-card p-10 md:p-14 mb-20" style={{ '--fill-color': 'rgba(12,139,68,0.1)' } as React.CSSProperties}>
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#0C8B44] mb-4">
                <Zap className="w-3.5 h-3.5" /> Our Mission
              </div>
              <h2 className="text-3xl md:text-4xl font-light tracking-[-0.02em] text-[#E5E5E5] mb-4 leading-tight">
                Make sophisticated investing feel obvious.
              </h2>
              <p className="text-[#A0A0A0] leading-relaxed">
                Most investors do not lack data — they drown in it. We use AI not to predict
                the future, but to surface what matters from the noise: a momentum shift, a
                rebalance opportunity, a risk you missed. The result is fewer decisions, made
                with more confidence.
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="mb-20">
            <h2 className="text-3xl md:text-4xl font-light tracking-[-0.02em] text-[#E5E5E5] mb-10 text-center">
              What we believe
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {values.map((v) => (
                <div key={v.title} className="glass-card p-7">
                  <div className="w-11 h-11 rounded-xl bg-[#0C8B44]/10 flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-[#0C8B44]" />
                  </div>
                  <h3 className="text-lg font-medium text-[#E5E5E5] mb-2">{v.title}</h3>
                  <p className="text-sm text-[#A0A0A0] leading-relaxed">{v.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="glass-card p-10 mb-20 text-center">
            <Users className="w-8 h-8 text-[#0C8B44] mx-auto mb-4" />
            <h2 className="text-2xl font-light text-[#E5E5E5] mb-3">A small team, building carefully</h2>
            <p className="text-[#A0A0A0] max-w-xl mx-auto leading-relaxed">
              We are engineers, designers, and former traders who left bigger companies to build
              the platform we always wished existed. Distributed across four continents, focused
              on one thing: making your money make sense.
            </p>
          </div>

          {/* Contact */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-light text-[#E5E5E5] mb-3">Get in touch</h2>
            <p className="text-sm text-[#737373] mb-8">We read every email.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <a
                href="mailto:hello@verdexis.com"
                className="glass-card p-5 hover:border-[#0C8B44]/30 transition-colors group"
              >
                <Mail className="w-5 h-5 text-[#0C8B44] mx-auto mb-2" />
                <p className="text-xs text-[#737373] mb-1">General</p>
                <p className="text-sm text-[#E5E5E5] group-hover:text-[#0C8B44] transition-colors">hello@verdexis.com</p>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card p-5 hover:border-[#0C8B44]/30 transition-colors group"
              >
                <Twitter className="w-5 h-5 text-[#0C8B44] mx-auto mb-2" />
                <p className="text-xs text-[#737373] mb-1">Twitter</p>
                <p className="text-sm text-[#E5E5E5] group-hover:text-[#0C8B44] transition-colors">@verdexis</p>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="glass-card p-5 hover:border-[#0C8B44]/30 transition-colors group"
              >
                <Linkedin className="w-5 h-5 text-[#0C8B44] mx-auto mb-2" />
                <p className="text-xs text-[#737373] mb-1">LinkedIn</p>
                <p className="text-sm text-[#E5E5E5] group-hover:text-[#0C8B44] transition-colors">/company/verdexis</p>
              </a>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/legal"
              className="inline-flex items-center gap-2 text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors"
            >
              Privacy, Terms &amp; Security <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
