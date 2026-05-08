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

// Build a reliable inline SVG icon: brand-colored rounded square with the
// wallet's first letter. Always renders even when the brand CDN 404s, so the
// picker never shows broken-image boxes. We export it for the install list too.
export function brandLetterIcon(letter: string, color: string): string {
  const safe = (letter || '?').slice(0, 1).toUpperCase()
  // Black text on light bg, white text on dark bg — quick brightness heuristic.
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) || 0
  const g = parseInt(hex.substring(2, 4), 16) || 0
  const b = parseInt(hex.substring(4, 6), 16) || 0
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const text = luma > 0.6 ? '#0a0e10' : '#ffffff'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="42" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="${text}">${safe}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

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

// Detect mobile / touch so we can prefer WalletConnect over deep-links that
// open the wallet's in-app browser. Catches: iPhone, iPad (iPadOS 13+ which
// reports as Mac, so we also check `maxTouchPoints`), Android, and other
// touch tablets.
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true
  // iPadOS 13+ pretends to be desktop Safari. Detect via touch points.
  const maxTouch = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0
  if (maxTouch > 1 && /Macintosh/i.test(ua)) return true
  return false
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
    icon: brandLetterIcon('M', '#F6851B'),
    installUrl: 'https://metamask.io/download/',
    // https://docs.metamask.io/wallet/how-to/use-mobile/#use-deep-linking
    deepLink: (url) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}`,
    tagline: 'Most popular EVM wallet',
  },
  {
    name: 'Coinbase Wallet',
    rdns: 'com.coinbase.wallet',
    icon: brandLetterIcon('C', '#1652F0'),
    installUrl: 'https://www.coinbase.com/wallet/downloads',
    // https://docs.cloud.coinbase.com/wallet-sdk/docs/dapp-browser
    deepLink: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
    tagline: 'Self-custody by Coinbase',
  },
  {
    name: 'Trust Wallet',
    rdns: 'com.trustwallet.app',
    icon: brandLetterIcon('T', '#3375BB'),
    installUrl: 'https://trustwallet.com/download',
    // https://developer.trustwallet.com/developer/develop-for-trust/deeplinking#open-url
    deepLink: (url) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
    tagline: 'Mobile + browser, 100+ chains',
  },
  {
    name: 'Rabby',
    rdns: 'io.rabby',
    icon: brandLetterIcon('R', '#7084FF'),
    installUrl: 'https://rabby.io/',
    tagline: 'Multi-chain power user wallet',
  },
  {
    name: 'Rainbow',
    rdns: 'me.rainbow',
    icon: brandLetterIcon('R', '#FF4000'),
    installUrl: 'https://rainbow.me/download',
    deepLink: (url) => `https://rnbwapp.com/dapp?url=${encodeURIComponent(url)}`,
    tagline: 'Beautiful Ethereum wallet',
  },
  {
    name: 'Phantom',
    rdns: 'app.phantom',
    icon: brandLetterIcon('P', '#AB9FF2'),
    installUrl: 'https://phantom.app/download',
    // Phantom universal links open the in-app browser to a dapp URL.
    deepLink: (url) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`,
    tagline: 'Solana + EVM + Bitcoin',
  },
  {
    name: 'OKX Wallet',
    rdns: 'com.okex.wallet',
    icon: brandLetterIcon('O', '#000000'),
    installUrl: 'https://www.okx.com/web3',
    // https://www.okx.com/web3/build/docs/sdks/dapp-deep-linking
    deepLink: (url) => `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url)}`)}`,
    tagline: 'Multi-chain exchange wallet',
  },
  {
    name: 'Brave Wallet',
    rdns: 'com.brave.wallet',
    icon: brandLetterIcon('B', '#FB542B'),
    installUrl: 'https://brave.com/wallet/',
    tagline: 'Built into the Brave browser',
  },
  {
    name: 'Zerion',
    rdns: 'io.zerion.wallet',
    icon: brandLetterIcon('Z', '#2461ED'),
    installUrl: 'https://zerion.io/download',
    // https://zerion.io/blog/zerion-wallet-deep-link/
    deepLink: (url) => `https://link.zerion.io/901o6IN0jqb?uri=${encodeURIComponent(url)}`,
    tagline: 'Smart wallet + DeFi tracker',
  },
  {
    name: 'Argent',
    rdns: 'xyz.argent',
    icon: brandLetterIcon('A', '#FF875B'),
    installUrl: 'https://www.argent.xyz/download-argent/',
    deepLink: (url) => `https://argent.link/app?url=${encodeURIComponent(url)}`,
    tagline: 'Smart-account wallet',
  },
  {
    name: 'Uniswap Wallet',
    rdns: 'org.uniswap',
    icon: brandLetterIcon('U', '#FC72FF'),
    installUrl: 'https://wallet.uniswap.org/',
    deepLink: (url) => `https://uniswap.org/app?url=${encodeURIComponent(url)}`,
    tagline: 'Self-custody by Uniswap Labs',
  },
  {
    name: 'Bitget Wallet',
    rdns: 'com.bitget.web3',
    icon: brandLetterIcon('B', '#54FFC9'),
    installUrl: 'https://web3.bitget.com/en/wallet-download',
    deepLink: (url) => `https://bkcode.vip?action=dapp&url=${encodeURIComponent(url)}`,
    tagline: 'Multi-chain Web3 wallet',
  },
  {
    name: 'BitKeep',
    rdns: 'com.bitkeep.wallet',
    icon: brandLetterIcon('B', '#7524F9'),
    installUrl: 'https://bitkeep.com/en/download',
    deepLink: (url) => `https://bkcode.vip?action=dapp&url=${encodeURIComponent(url)}`,
    tagline: 'Multi-chain wallet (now Bitget)',
  },
  {
    name: 'Exodus',
    rdns: 'com.exodus',
    icon: brandLetterIcon('E', '#1B1F2C'),
    installUrl: 'https://www.exodus.com/download/',
    tagline: '100+ assets, mobile + desktop',
  },
  {
    name: 'Ledger Live',
    rdns: 'com.ledger',
    icon: brandLetterIcon('L', '#000000'),
    installUrl: 'https://www.ledger.com/ledger-live',
    tagline: 'Hardware wallet companion',
  },
  {
    name: 'Safe (Gnosis)',
    rdns: 'global.safe',
    icon: brandLetterIcon('S', '#12FF80'),
    installUrl: 'https://safe.global/wallet',
    tagline: 'Multisig smart account',
  },
  {
    name: 'Frame',
    rdns: 'sh.frame',
    icon: brandLetterIcon('F', '#00DAFF'),
    installUrl: 'https://frame.sh/',
    tagline: 'System-wide desktop wallet',
  },
  {
    name: 'XDEFI',
    rdns: 'io.xdefi',
    icon: brandLetterIcon('X', '#2D5BFF'),
    installUrl: 'https://www.xdefi.io/',
    tagline: 'Cross-chain wallet',
  },
  {
    name: 'TokenPocket',
    rdns: 'pro.tokenpocket',
    icon: brandLetterIcon('T', '#2980FE'),
    installUrl: 'https://www.tokenpocket.pro/en/download/app',
    deepLink: (url) => `https://www.tokenpocket.pro/en/download/app?url=${encodeURIComponent(url)}`,
    tagline: 'Multi-chain mobile wallet',
  },
  {
    name: 'imToken',
    rdns: 'im.token',
    icon: brandLetterIcon('I', '#11C4D1'),
    installUrl: 'https://token.im/download',
    deepLink: (url) => `imtokenv2://navigate/DappView?url=${encodeURIComponent(url)}`,
    tagline: 'Asia\u2019s leading mobile wallet',
  },
  {
    name: 'MEW (MyEtherWallet)',
    rdns: 'com.myetherwallet',
    icon: brandLetterIcon('M', '#1896A4'),
    installUrl: 'https://www.mewwallet.com/',
    tagline: 'Original Ethereum wallet',
  },
  {
    name: 'WalletConnect (any QR wallet)',
    rdns: 'org.walletconnect',
    icon: brandLetterIcon('W', '#3B99FC'),
    installUrl: 'https://walletconnect.com/explorer?type=wallet',
    tagline: '300+ wallets via QR scan',
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
