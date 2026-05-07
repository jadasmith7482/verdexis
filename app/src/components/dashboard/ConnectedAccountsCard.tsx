// Connected accounts panel: linked bank accounts (from bankLink) and the
// connected web3 wallet (from useWeb3). Shows status dots + masked
// identifiers and a CTA to add more.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Wallet as WalletIcon, Plus, ShieldCheck, Clock, X } from 'lucide-react'
import { listBanks, onBanksChanged, type BankAccount } from '../../lib/bankLink'
import { useWeb3 } from '../../hooks/use-web3'

export default function ConnectedAccountsCard() {
  const [banks, setBanks] = useState<BankAccount[]>(listBanks())
  const { isConnected, shortAddress, walletInfo, chainName } = useWeb3()

  useEffect(() => onBanksChanged(() => setBanks(listBanks())), [])

  const verified = banks.filter((b) => b.status === 'verified').length
  const pending = banks.filter((b) => b.status === 'pending').length

  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff05] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[#E5E5E5]">Connected Accounts</h3>
        <Link to="/wallet" className="text-[11px] text-[#0C8B44] hover:text-[#00E676] flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add
        </Link>
      </div>

      {/* Banks */}
      <div className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Bank accounts</p>
        {banks.length === 0 ? (
          <Link to="/wallet?action=deposit" className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-dashed border-[#ffffff10] hover:border-[#0C8B44]/30">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#737373]" />
            </div>
            <div className="text-xs text-[#A0A0A0]">Link a bank to deposit funds</div>
          </Link>
        ) : (
          <div className="space-y-2">
            {banks.slice(0, 3).map((b) => {
              const dot = b.status === 'verified' ? '#4CAF50' : b.status === 'pending' ? '#FF9800' : '#f44336'
              const Icon = b.status === 'verified' ? ShieldCheck : b.status === 'pending' ? Clock : X
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a]/50">
                  <div className="w-8 h-8 rounded-lg bg-[#0C8B44]/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-[#0C8B44]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#E5E5E5] truncate">{b.institution}</p>
                    <p className="text-[10px] text-[#737373]">{b.accountType} · ••••{b.last4}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] uppercase" style={{ color: dot }}>
                    <Icon className="w-3 h-3" />{b.status}
                  </span>
                </div>
              )
            })}
            {banks.length > 0 && (
              <p className="text-[10px] text-[#555]">{verified} verified · {pending} pending</p>
            )}
          </div>
        )}
      </div>

      {/* Web3 wallet */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">Web3 wallet</p>
        {isConnected && shortAddress ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a]/50">
            <div className="w-8 h-8 rounded-lg bg-[#9C27B0]/10 flex items-center justify-center shrink-0">
              <WalletIcon className="w-4 h-4 text-[#9C27B0]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#E5E5E5] truncate">{walletInfo?.name || 'Wallet'}</p>
              <p className="text-[10px] text-[#737373] truncate">{shortAddress} · {chainName || 'Ethereum'}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse" />
          </div>
        ) : (
          <Link to="/wallet" className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a]/50 border border-dashed border-[#ffffff10] hover:border-[#0C8B44]/30">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <WalletIcon className="w-4 h-4 text-[#737373]" />
            </div>
            <div className="text-xs text-[#A0A0A0]">Connect a Web3 wallet</div>
          </Link>
        )}
      </div>
    </div>
  )
}
