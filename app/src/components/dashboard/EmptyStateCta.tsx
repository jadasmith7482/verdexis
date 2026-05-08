// Empty-state CTA shown on dashboard when user has no holdings.
// 3-step "Getting Started" checklist with progressive disclosure: each step
// links to the page that completes it, and the LifeBuoy link surfaces the
// help center for users who want context before clicking.

import { Link } from 'react-router-dom'
import { ArrowDownRight, BarChart3, Bell, Sparkles, LifeBuoy, ArrowRight } from 'lucide-react'

interface Step {
  n: number
  title: string
  body: string
  cta: string
  to: string
  icon: typeof ArrowDownRight
}

const STEPS: Step[] = [
  {
    n: 1,
    title: 'Fund your account',
    body: 'Link a bank or send crypto. Most deposits clear the same day.',
    cta: 'Deposit',
    to: '/wallet?action=deposit',
    icon: ArrowDownRight,
  },
  {
    n: 2,
    title: 'Make your first trade',
    body: 'Buy any of 100+ assets with a 0.10% flat fee — no hidden spread.',
    cta: 'Open markets',
    to: '/trading',
    icon: BarChart3,
  },
  {
    n: 3,
    title: 'Set a price alert',
    body: 'Get notified when a coin crosses a target — even when the app is closed.',
    cta: 'Add alert',
    to: '/alerts',
    icon: Bell,
  },
]

export default function EmptyStateCta() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0C8B44]/10 to-[#070C0E] border border-[#0C8B44]/20 p-6 md:p-8 mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-[#0C8B44]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-[#E5E5E5]">Welcome to Verdexis</h3>
          <p className="text-xs text-[#A0A0A0] mt-0.5">Three quick steps to unlock your portfolio dashboard.</p>
        </div>
        <Link to="/help" className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#737373] hover:text-[#0C8B44] transition-colors">
          <LifeBuoy className="w-3.5 h-3.5" /> Help
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {STEPS.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.n}
              to={s.to}
              className="group relative p-4 rounded-xl bg-[#0a0f11]/60 border border-[#ffffff05] hover:border-[#0C8B44]/30 hover:bg-[#0a0f11] transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#0C8B44]/15 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#0C8B44]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#0C8B44]">Step {s.n}</p>
                  <p className="text-sm font-medium text-[#E5E5E5] mt-0.5">{s.title}</p>
                </div>
              </div>
              <p className="text-xs text-[#A0A0A0] leading-relaxed mb-3">{s.body}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0C8B44] group-hover:gap-2 transition-all">
                {s.cta} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
