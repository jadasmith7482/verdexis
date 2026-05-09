import { useEffect, useState } from 'react'
import { Wallet as WalletIcon, Star, Trash2, Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'

interface WalletLink {
  id: string
  address: string
  chainId: string | null
  provider: string | null
  label: string | null
  isPrimary: boolean
  linkedAt: string
}

interface LinkedWalletsPanelProps {
  /** Address currently active in the use-web3 hook (for highlighting). */
  activeAddress: string | null
  /** Bumped by the parent whenever a new wallet is connected so the
   *  panel re-fetches the list and shows the freshly-added entry. */
  refreshKey: number
  /** Called after the panel removes the address that was the active one
   *  in the hook so the parent can run web3.disconnect() locally. */
  onActiveRemoved?: () => void
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : a
}

export default function LinkedWalletsPanel({ activeAddress, refreshKey, onActiveRemoved }: LinkedWalletsPanelProps) {
  const [links, setLinks] = useState<WalletLink[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { links } = await api.listWalletLinks()
      setLinks(links)
    } catch (err) {
      // Likely the user just isn't signed in yet \u2014 hide the panel.
      // eslint-disable-next-line no-console
      console.warn('[LinkedWalletsPanel] load failed', err)
      setLinks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [refreshKey])

  async function setPrimary(id: string) {
    setBusyId(id)
    try {
      await api.setPrimaryWalletLink(id)
      await load()
      toast.success('Primary wallet updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set primary')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(link: WalletLink) {
    if (!confirm(`Remove ${shortAddr(link.address)} from your account?`)) return
    setBusyId(link.id)
    try {
      await api.removeWalletLink(link.id)
      const wasActive = activeAddress && link.address.toLowerCase() === activeAddress.toLowerCase()
      await load()
      toast.success('Wallet removed')
      if (wasActive) onActiveRemoved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove wallet')
    } finally {
      setBusyId(null)
    }
  }

  if (loading && links.length === 0) {
    return (
      <div className="glass-card p-6 mb-8">
        <p className="text-xs text-[#737373]">Loading linked wallets\u2026</p>
      </div>
    )
  }

  if (links.length === 0) {
    // Don't render an empty card \u2014 the main Connect button is right above.
    return null
  }

  return (
    <div className="glass-card p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <WalletIcon className="w-4 h-4 text-[#0C8B44]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Linked Wallets</h3>
          <span className="text-[10px] uppercase tracking-wider text-[#737373]">{links.length}</span>
        </div>
        <button
          onClick={() => void load()}
          className="text-[#737373] hover:text-[#E5E5E5] transition-colors p-1"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-[#737373] mb-4">
        Add up to several self-custody addresses. The <span className="text-[#0C8B44]">primary</span> wallet
        is the one used for deposit attribution and shown on the admin user page.
      </p>
      <div className="space-y-2">
        {links.map((link) => {
          const isActive = activeAddress && link.address.toLowerCase() === activeAddress.toLowerCase()
          return (
            <div
              key={link.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                link.isPrimary ? 'border-[#0C8B44]/40 bg-[#0C8B44]/5' : 'border-[#ffffff10] bg-[#1a1a1a]/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-[#E5E5E5] truncate">{shortAddr(link.address)}</span>
                  {link.isPrimary && (
                    <span className="text-[9px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[9px] uppercase tracking-wider text-[#22d3ee] bg-[#22d3ee]/10 px-1.5 py-0.5 rounded">
                      Active session
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#737373] flex-wrap">
                  {link.provider && <span>{link.provider}</span>}
                  {link.chainId && <span className="font-mono">{link.chainId}</span>}
                  <span>linked {new Date(link.linkedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { navigator.clipboard.writeText(link.address); toast.success('Address copied') }}
                  className="p-2 text-[#737373] hover:text-[#E5E5E5] rounded-lg hover:bg-[#ffffff05] transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {!link.isPrimary && (
                  <button
                    onClick={() => void setPrimary(link.id)}
                    disabled={busyId === link.id}
                    className="p-2 text-[#737373] hover:text-[#0C8B44] rounded-lg hover:bg-[#ffffff05] transition-colors disabled:opacity-40"
                    title="Make primary"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void remove(link)}
                  disabled={busyId === link.id}
                  className="p-2 text-[#737373] hover:text-[#f44336] rounded-lg hover:bg-[#ffffff05] transition-colors disabled:opacity-40"
                  title="Remove wallet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
