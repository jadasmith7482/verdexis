import { X, ExternalLink, Check, Smartphone, Download } from 'lucide-react'
import { WALLET_INSTALL_OPTIONS, resolveWalletActionUrl, isMobile } from '../lib/walletProviders'
import type { DiscoveredProvider } from '../lib/walletProviders'

interface WalletPickerModalProps {
  isOpen: boolean
  onClose: () => void
  discovered: DiscoveredProvider[]
  onPick: (uuid: string) => void
  isConnecting: boolean
  selectedRdns?: string | null
}

export default function WalletPickerModal({
  isOpen,
  onClose,
  discovered,
  onPick,
  isConnecting,
  selectedRdns,
}: WalletPickerModalProps) {
  if (!isOpen) return null

  // Hide install options for any wallet that's already detected.
  const detectedRdns = new Set(discovered.map((d) => d.info.rdns))
  const installOptions = WALLET_INSTALL_OPTIONS.filter((w) => !detectedRdns.has(w.rdns))
  const onMobile = isMobile()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md glass-card overflow-hidden rounded-t-2xl sm:rounded-2xl"
        style={{ background: 'rgba(15,22,25,0.96)', backdropFilter: 'blur(24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#ffffff08] hover:bg-[#ffffff14] flex items-center justify-center text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pb-4 border-b border-[#ffffff10]">
          <h2 className="text-lg font-semibold text-[#E5E5E5]">Connect a wallet</h2>
          <p className="text-xs text-[#737373] mt-1">
            Choose any wallet you have installed. We support every EIP-1193 wallet — MetaMask, Coinbase, Rabby, Trust, Brave, OKX, Phantom, and more.
          </p>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {discovered.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-2">Installed</p>
              <div className="space-y-2 mb-4">
                {discovered.map((d) => {
                  const isActive = selectedRdns === d.info.rdns
                  return (
                    <button
                      key={d.info.uuid}
                      onClick={() => onPick(d.info.uuid)}
                      disabled={isConnecting}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#ffffff05] border border-[#ffffff10] hover:border-[#0C8B44]/50 hover:bg-[#0C8B44]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <img
                        src={d.info.icon}
                        alt={`${d.info.name} icon`}
                        className="w-9 h-9 rounded-lg shrink-0 object-contain bg-white/5 p-1"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#E5E5E5] truncate">{d.info.name}</p>
                        <p className="text-[10px] text-[#737373] truncate">{d.info.rdns}</p>
                      </div>
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[10px] text-[#0C8B44] uppercase tracking-wider"><Check className="w-3 h-3" /> Connected</span>
                      ) : (
                        <span className="text-[10px] text-[#0C8B44] uppercase tracking-wider">Detected</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {discovered.length === 0 && (
            <div className="text-center py-4 mb-3">
              <p className="text-sm text-[#A0A0A0]">No wallets detected in this browser.</p>
              <p className="text-xs text-[#737373] mt-1">Install one below — they all work with Verdexis.</p>
            </div>
          )}

          {installOptions.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-2">
                {discovered.length > 0
                  ? (onMobile ? 'Or open in another wallet' : 'Or install another')
                  : (onMobile ? 'Open in your mobile wallet' : 'Recommended wallets')}
              </p>
              {onMobile && discovered.length === 0 && (
                <p className="text-[11px] text-[#A0A0A0] mb-3">
                  Tap any wallet below to open Verdexis inside its in-app browser — you can connect from there in one tap.
                </p>
              )}
              <div className="space-y-2">
                {installOptions.map((w) => {
                  const { url, mode } = resolveWalletActionUrl(w)
                  return (
                    <a
                      key={w.rdns}
                      href={url}
                      target={mode === 'install' ? '_blank' : '_self'}
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#ffffff03] border border-[#ffffff08] hover:border-[#0C8B44]/30 hover:bg-[#0C8B44]/5 transition-colors"
                    >
                      <img
                        src={w.icon}
                        alt={`${w.name} icon`}
                        className="w-9 h-9 rounded-lg shrink-0 object-contain bg-white/5 p-1"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#E5E5E5] truncate">{w.name}</p>
                        <p className="text-[10px] text-[#737373] truncate">{w.tagline}</p>
                      </div>
                      {mode === 'open' ? (
                        <span className="flex items-center gap-1 text-[10px] text-[#0C8B44] uppercase tracking-wider whitespace-nowrap">
                          <Smartphone className="w-3 h-3" /> Open
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-[#737373] uppercase tracking-wider whitespace-nowrap">
                          <Download className="w-3 h-3" /> Install
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </span>
                      )}
                    </a>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#ffffff10] bg-[#0a0e10]/40">
          <p className="text-[10px] text-[#737373] text-center">
            Verdexis never holds your keys. Connections happen directly between your wallet and the blockchain.
          </p>
        </div>
      </div>
    </div>
  )
}
