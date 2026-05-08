import { X, ExternalLink, Check, Smartphone, Download, RefreshCw, QrCode } from 'lucide-react'
import { useEffect, useState } from 'react'
import { WALLET_INSTALL_OPTIONS, resolveWalletActionUrl, isMobile, brandLetterIcon } from '../lib/walletProviders'
import type { DiscoveredProvider } from '../lib/walletProviders'
import { isWalletConnectConfigured } from '../lib/walletConnect'

interface WalletPickerModalProps {
  isOpen: boolean
  onClose: () => void
  discovered: DiscoveredProvider[]
  onPick: (uuid: string) => void
  onRefresh?: () => Promise<unknown>
  isConnecting: boolean
  selectedRdns?: string | null
}

export default function WalletPickerModal({
  isOpen,
  onClose,
  discovered,
  onPick,
  onRefresh,
  isConnecting,
  selectedRdns,
}: WalletPickerModalProps) {
  const [refreshing, setRefreshing] = useState(false)

  // Lock background scroll while open so the picker stays in view on mobile.
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen) return null

  // Hide install options for any wallet that's already detected.
  const detectedRdns = new Set(discovered.map((d) => d.info.rdns))
  const installOptions = WALLET_INSTALL_OPTIONS.filter((w) => !detectedRdns.has(w.rdns))
  const onMobile = isMobile()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md glass-card rounded-2xl my-auto max-h-[calc(100vh-1.5rem)] sm:max-h-[90vh] flex flex-col"
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

        <div className="p-6 pb-4 border-b border-[#ffffff10] flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[#E5E5E5]">Connect a wallet</h2>
            <p className="text-xs text-[#737373] mt-1">
              Pick any wallet you have installed. We support every EIP-1193 wallet — MetaMask, Coinbase, Rabby, Trust, Brave, OKX, Phantom, and more.
            </p>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={async () => { setRefreshing(true); try { await onRefresh() } finally { setRefreshing(false) } }}
              disabled={refreshing}
              title="Re-scan for wallets"
              className="shrink-0 mt-7 mr-8 w-7 h-7 rounded-md bg-[#ffffff08] hover:bg-[#ffffff14] flex items-center justify-center text-[#A0A0A0] hover:text-[#0C8B44] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* WalletConnect — always-on, works without any browser extension.
              Shows a QR code on desktop (scan with phone wallet) or hands
              off to the user's installed mobile wallet via deep-link. */}
          {isWalletConnectConfigured() && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-2">
                {onMobile ? 'Recommended on mobile' : 'Connect with your phone'}
              </p>
              <button
                type="button"
                onClick={() => onPick('walletconnect')}
                disabled={isConnecting}
                className="w-full flex items-center gap-3 p-3 mb-4 rounded-xl bg-[#3B99FC]/10 border border-[#3B99FC]/40 hover:bg-[#3B99FC]/15 hover:border-[#3B99FC]/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="w-9 h-9 rounded-lg shrink-0 bg-[#3B99FC]/20 flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-[#3B99FC]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#E5E5E5] truncate">WalletConnect</p>
                  <p className="text-[10px] text-[#737373] truncate">
                    {onMobile
                      ? 'Pick from any installed wallet'
                      : 'Scan a QR code with any of 300+ mobile wallets'}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[10px] text-[#3B99FC] uppercase tracking-wider whitespace-nowrap">
                  {onMobile ? <Smartphone className="w-3 h-3" /> : <QrCode className="w-3 h-3" />}
                  {onMobile ? 'Open' : 'Scan'}
                </span>
              </button>
            </>
          )}

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
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement
                          // Stop the loop, then swap to a guaranteed-working
                          // brand-color initial so the row never shows a
                          // broken-image box.
                          if (img.dataset.fallback === '1') return
                          img.dataset.fallback = '1'
                          img.src = brandLetterIcon(d.info.name.charAt(0), '#0C8B44')
                        }}
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
              <p className="text-sm text-[#A0A0A0]">
                {onMobile ? 'No wallet connected on this device.' : 'No wallets detected in this browser yet.'}
              </p>
              <p className="text-xs text-[#737373] mt-1">
                {onMobile
                  ? 'Tap a wallet below — it will open Verdexis inside that wallet\u2019s in-app browser, where you can connect with one tap. If the app isn\u2019t installed, the link will take you to the App Store / Play Store first.'
                  : 'If you just installed one, click the refresh icon above. Otherwise pick one below — the link will open the wallet directly if it\u2019s already installed, or prompt you to install it.'}
              </p>
            </div>
          )}

          {installOptions.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-wider text-[#737373] mb-2">
                {discovered.length > 0
                  ? (onMobile ? 'Or open in another wallet' : 'Or open / install another')
                  : (onMobile ? 'Open in your mobile wallet' : 'Open or install a wallet')}
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
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement
                          if (img.dataset.fallback === '1') return
                          img.dataset.fallback = '1'
                          img.src = brandLetterIcon(w.name.charAt(0), '#0C8B44')
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#E5E5E5] truncate">{w.name}</p>
                        <p className="text-[10px] text-[#737373] truncate">{w.tagline}</p>
                      </div>
                      {mode === 'open' ? (
                        <span className="flex items-center gap-1 text-[10px] text-[#0C8B44] uppercase tracking-wider whitespace-nowrap">
                          <Smartphone className="w-3 h-3" /> Open
                          <ExternalLink className="w-3 h-3 ml-0.5" />
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
