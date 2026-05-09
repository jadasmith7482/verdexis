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
        showQrModal: true,
        // Pin the wallets that show up in the WC modal so MetaMask, Trust,
        // Coinbase, Rainbow, etc. are always at the top — without this the
        // modal pulls from Reown's curated default and MetaMask sometimes
        // gets buried or filtered out depending on platform detection.
        // IDs come from https://explorer.walletconnect.com — these are the
        // canonical EIP-1193 mobile wallets.
        qrModalOptions: {
          explorerRecommendedWalletIds: [
            'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
            '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0', // Coinbase Wallet
            '4457c130df49fb35a2899c1742d3ed9c0c0b1a4c5b3e8f8b7e2a9c5d7e8f9a0b', // Trust Wallet
            '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369', // Rainbow
            '85db431492aa2e8672e93f4ea7acf10c88b97b867b0d373107af63dc4880f041', // Frame
            '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662', // Bitget
            '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709', // OKX Wallet
          ],
          // Make sure they're not hidden when the device fingerprint suggests
          // the user 'might not have it installed'.
          enableExplorer: true,
          themeMode: 'dark' as const,
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
