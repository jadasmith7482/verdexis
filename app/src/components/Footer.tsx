import { Link } from 'react-router-dom'
import { Shield, Lock, Activity } from 'lucide-react'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-12 border-t border-[#ffffff08] bg-[#070C0E]">
      <div className="max-w-[1280px] mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0C8B44] to-[#00E676] flex items-center justify-center">
                <span className="text-white text-xs font-bold">V</span>
              </div>
              <span className="text-sm font-medium text-[#E5E5E5] tracking-wide">VERDEXIS</span>
            </div>
            <p className="text-xs text-[#737373] leading-relaxed">
              Institutional-grade trading and portfolio analytics. Live market data,
              AI insights and bank-level security.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Product</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li><Link to="/dashboard" className="hover:text-[#0C8B44] transition-colors">Dashboard</Link></li>
              <li><Link to="/trading" className="hover:text-[#0C8B44] transition-colors">Trading</Link></li>
              <li><Link to="/wallet" className="hover:text-[#0C8B44] transition-colors">Wallet</Link></li>
              <li><Link to="/ai" className="hover:text-[#0C8B44] transition-colors">AI Assistant</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Markets</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li><Link to="/news" className="hover:text-[#0C8B44] transition-colors">News</Link></li>
              <li><Link to="/trading" className="hover:text-[#0C8B44] transition-colors">Crypto</Link></li>
              <li><Link to="/trading" className="hover:text-[#0C8B44] transition-colors">Stocks</Link></li>
              <li><Link to="/dashboard" className="hover:text-[#0C8B44] transition-colors">Portfolio</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium text-[#E5E5E5] mb-3 uppercase tracking-[0.05em]">Security</h4>
            <ul className="space-y-2 text-xs text-[#A0A0A0]">
              <li className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-[#0C8B44]" /> 256-bit SSL</li>
              <li className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-[#0C8B44]" /> SOC 2 Type II</li>
              <li className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-[#0C8B44]" /> 99.99% Uptime</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-6 border-t border-[#ffffff05]">
          <p className="text-[11px] text-[#737373]">© {year} Verdexis. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px] text-[#737373]">
            <a href="#" className="hover:text-[#A0A0A0] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#A0A0A0] transition-colors">Terms</a>
            <a href="#" className="hover:text-[#A0A0A0] transition-colors">Disclosures</a>
            <a href="#" className="hover:text-[#A0A0A0] transition-colors">Status</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
