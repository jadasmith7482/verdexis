// WalletConnect v2 (Reown) provider — single shared instance, lazy-init.
//
// Why: EIP-6963 only finds wallets that are *already injected into this
// browser*. On a phone browser without an extension, or on desktop where the
// user only has a mobile wallet, EIP-6963 turns up nothing. WalletConnect
// solves both: a QR code on desktop hands the session to the user's phone
// wallet; tapping a wallet button on mobile deep-links straight into the
// wallet app and hands the session back when the user returns.
//
// Setup: drop a project ID into `app/.env.local`:
//   VITE_WC_PROJECT_ID=...your reown project id...
// Get one free at https://cloud.reown.com (no credit card).

import type { EthereumProvider as Eip1193Provider } from '../types/ethereum'

let cached: Promise<Eip1193Provider | null> | null = null

export const WC_PROJECT_ID =
  (import.meta.env.VITE_WC_PROJECT_ID as string | undefined) ||
  // Public Reown/WalletConnect project ID for verdexis.app — safe to ship in
  // client JS (it's a public identifier, not a secret). Hardcoded as a
  // fallback because Docker builds on Render/Railway don't see app/.env
  // (it's in .dockerignore) — without this, `isWalletConnectConfigured()`
  // returned false in prod and Safari/mobile users were forced through the
  // deep-link install rows that open the wallet's in-app browser.
  '242e95d2634817c56a6742ee75e92acb'

export function isWalletConnectConfigured(): boolean {
  return WC_PROJECT_ID.length > 0
}

/** Lazy-load the WalletConnect provider on first use. Keeps the bundle slim
 *  for users who never click the WC option. Resolves to null when no project
 *  ID is configured (we still surface the option in the UI but tell the user
 *  to set the env var). */
export function getWalletConnectProvider(): Promise<Eip1193Provider | null> {
  if (!isWalletConnectConfigured()) return Promise.resolve(null)
  if (cached) return cached
  cached = (async () => {
    try {
      const mod = await import('@walletconnect/ethereum-provider')
      const provider = await mod.EthereumProvider.init({
        projectId: WC_PROJECT_ID,
        // Chains we will optionally request to switch to. WalletConnect requires
        // at least one. Ethereum mainnet is the safe default.
        chains: [1],
        // Additional chains we support — wallets supporting EIP-5792 / chain
        // switching can hop to any of these without a fresh session.
        optionalChains: [137, 42161, 10, 8453, 56, 43114, 11155111],
        // Show WalletConnect's own modal everywhere — it has the rich
        // wallet list (MetaMask/Trust/Rainbow/OKX/Bitget/Binance + 300+).
        // On mobile it deep-links into the chosen wallet; on desktop it
        // shows a QR code.
        showQrModal: true,
        // Pin the major wallets to the top of the WC modal. All IDs verified
        // against https://explorer-api.walletconnect.com/v3/wallets — using
        // an unknown ID here silently breaks the recommended list.
        //
        // `explorerRecommendedWalletIds` controls the desktop "recommended"
        // row. On mobile the modal sorts by region and ignores this, which
        // is why MetaMask/Trust/Rainbow weren't appearing at the top of the
        // phone modal — we pin them explicitly via `mobileWallets` (verified
        // deep-links from the explorer API). `walletImages` supplies the
        // logos that go with those entries.
        qrModalOptions: {
          themeMode: 'dark' as const,
          enableExplorer: true,
          explorerRecommendedWalletIds: [
            'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Trust Wallet
            'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Coinbase Wallet
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
            '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', // OKX Wallet
            '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget Wallet
            '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4', // Binance Wallet
          ],
          mobileWallets: [
            {
              id: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
              name: 'MetaMask',
              links: { native: 'metamask://', universal: 'https://metamask.app.link' },
            },
            {
              id: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
              name: 'Trust Wallet',
              links: { native: 'trust://', universal: 'https://link.trustwallet.com' },
            },
            {
              id: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
              name: 'Rainbow',
              links: { native: 'rainbow://', universal: 'https://rnbwapp.com' },
            },
            // Note: Coinbase Wallet no longer publishes a WalletConnect
            // mobile deep-link in the explorer (their `mobile.native` is
            // empty), so it cannot be pinned via WC on mobile. Users on
            // mobile must use Coinbase's own in-app browser to reach the
            // dapp — that's a Coinbase-side limitation, not ours.
          ],
          walletImages: {
            'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96':
              'https://explorer-api.walletconnect.com/v3/logo/md/eebe4a7f-7166-402f-92e0-1f64ca2aa800?projectId=' +
              WC_PROJECT_ID,
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0':
              'https://explorer-api.walletconnect.com/v3/logo/md/7677b54f-3486-46e2-4e37-bf8747814f00?projectId=' +
              WC_PROJECT_ID,
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369':
              'https://explorer-api.walletconnect.com/v3/logo/md/7a33d7f1-3d12-4b5c-f3ee-5cd83cb1b500?projectId=' +
              WC_PROJECT_ID,
          },
        },
        metadata: {
          name: 'Verdexis',
          description: 'Verdexis crypto investing — connect your wallet',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://verdexis.app',
          icons: [
            (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/logo.png',
          ],
        },
      })
      // Cast to our local EIP-1193 type — the WC provider implements it.
      return provider as unknown as Eip1193Provider
    } catch (err) {
      // Reset cache on failure so the next click can retry. Surface to console
      // so users on mobile can inspect (Safari → Settings → Advanced → Web
      // Inspector). Common causes: invalid project ID, origin not in Reown
      // project's allowlist, or network blocking the WC relay.
      // eslint-disable-next-line no-console
      console.error('[WalletConnect] init failed', err)
      cached = null
      throw err
    }
  })()
  return cached
}

/** Force a fresh WalletConnect session. Use after disconnect so the QR
 *  modal shows up again on the next connect. */
export function resetWalletConnect(): void {
  cached = null
}

/** Wallets we offer as direct deep-link buttons on mobile. The WalletConnect
 *  modal's own "Continue in MetaMask" screen is fragile on iOS Safari (the
 *  Open button can disable mid-flow when the proposal expires, leaving the
 *  user stranded). Bypassing the modal and firing the wallet's deep-link
 *  scheme directly from a real user gesture works reliably because iOS
 *  treats it as an explicit app-launch intent. */
export interface WcMobileWallet {
  id: string
  name: string
  /** App-scheme URL (e.g. 'metamask://', 'trust://'). */
  native: string
  /** Universal-link host (https). Falls back to this if the native
   *  scheme is blocked. */
  universal: string
  /** Logo from the WalletConnect explorer CDN. */
  logo: string
}

export const WC_MOBILE_WALLETS: WcMobileWallet[] = [
  {
    id: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
    name: 'MetaMask',
    native: 'metamask://',
    universal: 'https://metamask.app.link',
    logo:
      'https://explorer-api.walletconnect.com/v3/logo/md/eebe4a7f-7166-402f-92e0-1f64ca2aa800?projectId=' +
      WC_PROJECT_ID,
  },
  {
    id: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
    name: 'Trust Wallet',
    native: 'trust://',
    universal: 'https://link.trustwallet.com',
    logo:
      'https://explorer-api.walletconnect.com/v3/logo/md/7677b54f-3486-46e2-4e37-bf8747814f00?projectId=' +
      WC_PROJECT_ID,
  },
  {
    id: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    name: 'Rainbow',
    native: 'rainbow://',
    universal: 'https://rnbwapp.com',
    logo:
      'https://explorer-api.walletconnect.com/v3/logo/md/7a33d7f1-3d12-4b5c-f3ee-5cd83cb1b500?projectId=' +
      WC_PROJECT_ID,
  },
]

/** Build the WalletConnect deep-link URL for a given wallet's native
 *  scheme. The WC v2 URI format is `wc:<topic>@2?...`, and wallets expect
 *  it appended after `wc?uri=` on their scheme:
 *    metamask://wc?uri=wc%3Atopic%402%3F...
 *  Returns the universal-link variant as a fallback. */
export function buildWalletDeepLink(wallet: WcMobileWallet, wcUri: string): { native: string; universal: string } {
  const encoded = encodeURIComponent(wcUri)
  return {
    native: `${wallet.native}wc?uri=${encoded}`,
    universal: `${wallet.universal}/wc?uri=${encoded}`,
  }
}
