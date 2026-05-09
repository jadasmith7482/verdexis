import Navigation from '../components/Navigation'
import { Link } from 'react-router-dom'
import { Shield, FileText, Lock, ArrowRight } from 'lucide-react'

const sections = [
  {
    id: 'privacy',
    icon: Shield,
    title: 'Privacy Policy',
    summary: 'How we collect, use, and protect your data.',
    body: [
      ['What we collect', 'Account details (email, name), portfolio data you connect, usage analytics, and device metadata necessary to deliver the service. We never sell your data.'],
      ['How we use it', 'To operate the platform, provide AI-driven insights tailored to your holdings, secure your account, comply with legal obligations, and improve product quality.'],
      ['Third parties', 'We share data only with infrastructure providers under data-processing agreements (CoinGecko, Alpha Vantage, Finnhub for market data; standard cloud providers for hosting).'],
      ['Your rights', 'You may request a full export or permanent deletion of your data at any time from Settings → Profile. We honor GDPR and CCPA requests within 30 days.'],
      ['Contact', 'privacy@verdexis.com'],
    ],
  },
  {
    id: 'terms',
    icon: FileText,
    title: 'Terms of Service',
    summary: 'The rules of the road for using Verdexis.',
    body: [
      ['Acceptance', 'By creating an account you agree to these terms and our Privacy Policy.'],
      ['Eligibility', 'You must be 18+ and legally able to enter into a binding contract in your jurisdiction.'],
      ['Not financial advice', 'AI insights, recommendations, and confidence scores are for informational purposes only and do not constitute financial, investment, tax or legal advice. You are solely responsible for your trading decisions.'],
      ['Acceptable use', 'No automated abuse, no scraping at rates that disrupt service, no impersonation, no illegal activity.'],
      ['Termination', 'We may suspend or terminate accounts that violate these terms. You may close your account at any time.'],
      ['Limitation of liability', 'Verdexis is provided "as is" without warranties. To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages.'],
    ],
  },
  {
    id: 'security',
    icon: Lock,
    title: 'Security',
    summary: 'How we keep your account and data safe.',
    body: [
      ['Encryption', 'TLS 1.3 in transit, AES-256 at rest. Sensitive secrets are encrypted with envelope encryption and rotated regularly.'],
      ['Authentication', 'Optional TOTP-based two-factor authentication. WebAuthn/passkey support is on the roadmap.'],
      ['Infrastructure', 'Hosted on hardened cloud infrastructure with isolated network segments and least-privilege IAM.'],
      ['Monitoring', '24/7 anomaly detection, audit logging on all financial actions, and weekly third-party vulnerability scans.'],
      ['Compliance', 'Security controls are designed to align with the SOC 2, ISO 27001 and PCI DSS frameworks, and we honour GDPR / CCPA data rights. Verdexis is not yet certified under SOC 2 or ISO 27001 — certification work is in progress and any future report will be published on this page.'],
      ['Disclosure', 'Found a vulnerability? Email security@verdexis.com — we acknowledge within 24h.'],
    ],
  },
  {
    id: 'cookies',
    icon: FileText,
    title: 'Cookie Policy',
    summary: 'What we store on your device, and why.',
    body: [
      ['Essential cookies only', 'Verdexis uses a small number of strictly necessary cookies and localStorage entries to keep you signed in, remember your theme and currency preferences, and persist your dashboard layout. We do not set any advertising or cross-site tracking cookies.'],
      ['Analytics', 'Anonymous, aggregated product analytics may be collected only after you accept the cookie banner. You can decline at any time without losing access to the platform.'],
      ['Managing cookies', 'You can clear all Verdexis cookies and storage from your browser settings, or click “Cookie preferences” in the footer to re-open the consent banner.'],
      ['Third parties', 'Only infrastructure providers strictly required to deliver the service (hosting, market-data APIs) may set cookies on their own domains when their endpoints are called.'],
    ],
  },
] as const

export default function Legal() {
  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[920px] mx-auto">
          <div className="mb-10">
            <p className="text-xs tracking-[0.3em] uppercase text-[#0C8B44] mb-3">Legal</p>
            <h1 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5]">
              Privacy, Terms &amp; Security
            </h1>
            <p className="text-sm text-[#737373] mt-3">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>

          {/* Quick nav */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="glass-card p-5 hover:border-[#0C8B44]/30 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center">
                    <s.icon className="w-4 h-4 text-[#0C8B44]" />
                  </div>
                  <p className="text-sm font-medium text-[#E5E5E5]">{s.title}</p>
                </div>
                <p className="text-xs text-[#737373] leading-relaxed">{s.summary}</p>
                <div className="mt-3 flex items-center text-xs text-[#0C8B44] opacity-0 group-hover:opacity-100 transition-opacity">
                  Read <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </a>
            ))}
          </div>

          {sections.map((s) => (
            <section key={s.id} id={s.id} className="mb-16 scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <s.icon className="w-6 h-6 text-[#0C8B44]" />
                <h2 className="text-2xl md:text-3xl font-light text-[#E5E5E5]">{s.title}</h2>
              </div>
              <div className="space-y-5">
                {s.body.map(([heading, text]) => (
                  <div key={heading} className="p-5 rounded-xl bg-[#0a0e10] border border-[#ffffff08]">
                    <p className="text-sm font-medium text-[#E5E5E5] mb-2">{heading}</p>
                    <p className="text-sm text-[#A0A0A0] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="text-center pt-8 border-t border-[#ffffff08]">
            <p className="text-sm text-[#737373] mb-4">Questions about any of this?</p>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 text-sm text-[#0C8B44] hover:text-[#00E676] transition-colors"
            >
              Contact us <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
