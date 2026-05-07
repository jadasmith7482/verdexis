// EIP-6963 (Multi Injected Provider Discovery) — modern wallets announce themselves
// via window dispatchEvent('eip6963:announceProvider'); we ask via dispatchEvent('eip6963:requestProvider').
// Spec: https://eips.ethereum.org/EIPS/eip-6963
//
// We also fall back to:
//   - window.ethereum.providers[]  (legacy multi-provider arrays, e.g. older Coinbase)
//   - window.ethereum               (single injected provider)
//
// All injected wallets implement EIP-1193, so we treat them uniformly.

import type { EthereumProvider } from '../types/ethereum'

export interface WalletProviderInfo {
  uuid: string
  name: string
  icon: string // data URI or https://
  rdns: string // reverse-dns identifier (e.g. io.metamask, com.coinbase.wallet)
}

export interface DiscoveredProvider {
  info: WalletProviderInfo
  provider: EthereumProvider
}

interface EIP6963AnnounceEvent extends CustomEvent {
  detail: DiscoveredProvider
}

const KNOWN_FALLBACK_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%230C8B44" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/><path d="M21 12h-6a2 2 0 1 0 0 4h6"/></svg>',
  )

// Identify a single window.ethereum by its boolean flags so the legacy fallback
// surfaces a sensible name when no EIP-6963 announcement has happened.
function detectLegacyName(p: EthereumProvider): { name: string; rdns: string } {
  const flags: Record<string, { name: string; rdns: string }> = {
    isMetaMask: { name: 'MetaMask', rdns: 'io.metamask' },
    isCoinbaseWallet: { name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet' },
    isTrust: { name: 'Trust Wallet', rdns: 'com.trustwallet.app' },
    isRabby: { name: 'Rabby', rdns: 'io.rabby' },
    isBraveWallet: { name: 'Brave Wallet', rdns: 'com.brave.wallet' },
    isPhantom: { name: 'Phantom', rdns: 'app.phantom' },
    isOkxWallet: { name: 'OKX Wallet', rdns: 'com.okex.wallet' },
    isFrame: { name: 'Frame', rdns: 'sh.frame' },
  }
  const indexed = p as unknown as Record<string, unknown>
  for (const flag of Object.keys(flags)) {
    if (indexed[flag] === true) return flags[flag]
  }
  return { name: 'Browser Wallet', rdns: 'unknown.injected' }
}

// Fire an EIP-6963 request and collect every announce that fires within the
// timeout. Some wallet extensions inject late (after DOMContentLoaded) so we
// give them a generous window and re-broadcast `requestProvider` periodically.
export function discoverWallets(timeoutMs = 1500): Promise<DiscoveredProvider[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([])
      return
    }
    const found = new Map<string, DiscoveredProvider>()

    const onAnnounce = (event: Event) => {
      const e = event as EIP6963AnnounceEvent
      const detail = e.detail
      if (detail?.info?.uuid && detail.provider) {
        found.set(detail.info.uuid, detail)
      }
    }

    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    // Re-broadcast every 250ms so wallets that inject after our first request
    // still get a chance to announce themselves.
    const interval = window.setInterval(() => {
      window.dispatchEvent(new Event('eip6963:requestProvider'))
    }, 250)

    setTimeout(() => {
      window.clearInterval(interval)
      window.removeEventListener('eip6963:announceProvider', onAnnounce)

      // Fallback: include window.ethereum (and its .providers[] array, if present)
      // for wallets that don't yet implement EIP-6963.
      const eth = window.ethereum
      if (eth) {
        const ethIndexed = eth as unknown as { providers?: EthereumProvider[] }
        const providers: EthereumProvider[] = Array.isArray(ethIndexed.providers)
          ? ethIndexed.providers
          : [eth]
        providers.forEach((p, idx) => {
          const meta = detectLegacyName(p)
          // Only add if EIP-6963 didn't already cover this wallet.
          const dup = Array.from(found.values()).some(
            (d) => d.info.rdns === meta.rdns || d.provider === p,
          )
          if (!dup) {
            found.set(`legacy-${meta.rdns}-${idx}`, {
              info: {
                uuid: `legacy-${meta.rdns}-${idx}`,
                name: meta.name,
                icon: KNOWN_FALLBACK_ICON,
                rdns: meta.rdns,
              },
              provider: p,
            })
          }
        })
      }

      resolve(Array.from(found.values()))
    }, timeoutMs)
  })
}

// Persist the user's choice so we can auto-rehydrate the same wallet on next visit.
export const WALLET_RDNS_STORAGE = 'verdexis_wallet_rdns'

// Detect mobile so we can prefer wallet deep-links over desktop extension installs.
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

// Always-available wallet options. On mobile we use deep-links that open the
// wallet app directly with the current dapp URL (per each wallet's docs);
// on desktop we fall back to the extension download page.
export interface WalletInstallOption {
  name: string
  rdns: string
  icon: string
  installUrl: string
  /** Build a URL that opens the wallet's in-app browser pointing at this dapp. */
  deepLink?: (dappUrl: string) => string
  tagline: string
}

export const WALLET_INSTALL_OPTIONS: WalletInstallOption[] = [
  {
    name: 'MetaMask',
    rdns: 'io.metamask',
    icon: 'https://cdn.jsdelivr.net/gh/MetaMask/brand-resources@9b96c91/SVG/SVG_MetaMask_Icon_Color.svg',
    installUrl: 'https://metamask.io/download/',
    // https://docs.metamask.io/wallet/how-to/use-mobile/#use-deep-linking
    deepLink: (url) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}`,
    tagline: 'Most popular EVM wallet',
  },
  {
    name: 'Coinbase Wallet',
    rdns: 'com.coinbase.wallet',
    icon: 'https://www.coinbase.com/assets/sub-brands/wallet/wallet-square-512.png',
    installUrl: 'https://www.coinbase.com/wallet/downloads',
    // https://docs.cloud.coinbase.com/wallet-sdk/docs/dapp-browser
    deepLink: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
    tagline: 'Self-custody by Coinbase',
  },
  {
    name: 'Rabby',
    rdns: 'io.rabby',
    icon: 'https://rabby.io/assets/images/logo-128.png',
    installUrl: 'https://rabby.io/',
    tagline: 'Multi-chain power user wallet',
  },
  {
    name: 'Trust Wallet',
    rdns: 'com.trustwallet.app',
    icon: 'https://trustwallet.com/assets/images/media/assets/trust_platform.svg',
    installUrl: 'https://trustwallet.com/download',
    // https://developer.trustwallet.com/developer/develop-for-trust/deeplinking#open-url
    deepLink: (url) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
    tagline: 'Mobile + browser, 100+ chains',
  },
  {
    name: 'Rainbow',
    rdns: 'me.rainbow',
    icon: 'https://rainbow.me/static/images/wallet/rainbow-icon.png',
    installUrl: 'https://rainbow.me/download',
    deepLink: (url) => `https://rnbwapp.com/dapp?url=${encodeURIComponent(url)}`,
    tagline: 'Beautiful Ethereum wallet',
  },
]

/** Resolve the right URL for a wallet option based on the user's device.
 *  Wallet deep-links (metamask.app.link, go.cb-w.com, link.trustwallet.com)
 *  work as universal links on desktop too: if the extension is installed the
 *  link page opens the wallet popup; otherwise it prompts the install. */
export function resolveWalletActionUrl(opt: WalletInstallOption): { url: string; mode: 'open' | 'install' } {
  if (typeof window === 'undefined') return { url: opt.installUrl, mode: 'install' }
  if (opt.deepLink) {
    try {
      return { url: opt.deepLink(window.location.href), mode: 'open' }
    } catch {
      /* fall through to install */
    }
  }
  return { url: opt.installUrl, mode: 'install' }
}
