import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation'
import { ArrowLeft, Home, Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />

      <div className="pt-32 pb-16 px-6">
        <div className="max-w-[680px] mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0C8B44]/10 border border-[#0C8B44]/20 mb-8">
            <Compass className="w-10 h-10 text-[#0C8B44]" />
          </div>

          <p className="text-xs tracking-[0.3em] uppercase text-[#0C8B44] mb-4">404 — Not Found</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-6">
            Off the chart.
          </h1>
          <p className="text-[#A0A0A0] max-w-md mx-auto mb-10 leading-relaxed">
            The page you're looking for doesn't exist, was moved, or never traded
            on this exchange. Let's get you back on course.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0C8B44] text-white text-sm font-medium tracking-[0.04em] uppercase rounded-lg hover:bg-[#0a7539] transition-colors glow-accent"
            >
              <Home className="w-4 h-4" /> Back to Home
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 text-[#E5E5E5] text-sm font-medium tracking-[0.04em] uppercase border border-[#ffffff15] rounded-lg hover:border-[#0C8B44]/30 hover:text-[#0C8B44] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Open Dashboard
            </Link>
          </div>

          <div className="mt-16 pt-10 border-t border-[#ffffff08]">
            <p className="text-xs text-[#737373] uppercase tracking-wider mb-4">Popular destinations</p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              {[
                { label: 'Markets', path: '/trading' },
                { label: 'AI Analyst', path: '/ai' },
                { label: 'Wallet', path: '/wallet' },
                { label: 'News', path: '/news' },
                { label: 'Settings', path: '/settings' },
              ].map((l) => (
                <Link key={l.path} to={l.path} className="text-[#A0A0A0] hover:text-[#0C8B44] transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
