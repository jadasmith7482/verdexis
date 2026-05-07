// Empty-state CTA shown on dashboard when user has no holdings.
// Encourages first deposit / first trade with confetti via sonner toast.

import { Link } from 'react-router-dom'
import { ArrowDownRight, BarChart3, Sparkles } from 'lucide-react'

export default function EmptyStateCta() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0C8B44]/10 to-[#070C0E] border border-[#0C8B44]/20 p-8 mb-6">
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-[#0C8B44]/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-8 h-8 text-[#0C8B44]" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg font-medium text-[#E5E5E5] mb-1">Welcome to Verdexis</h3>
          <p className="text-sm text-[#A0A0A0] max-w-md">Deposit funds or make your first trade to see your portfolio come to life — net worth, P&amp;L, allocation, and AI insights all unlock automatically.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/wallet?action=deposit" className="px-4 py-2 bg-[#0C8B44] text-white text-sm font-medium rounded-lg hover:bg-[#0a7539] transition-colors flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4" />Deposit
          </Link>
          <Link to="/trading" className="px-4 py-2 bg-[#1a1a1a] text-[#E5E5E5] text-sm font-medium rounded-lg border border-[#ffffff15] hover:border-[#0C8B44]/30 transition-colors flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />Trade
          </Link>
        </div>
      </div>
    </div>
  )
}
