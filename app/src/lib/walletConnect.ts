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
  })()
  return cached
}

/** Force a fresh WalletConnect session. Use after disconnect so the QR
 *  modal shows up again on the next connect. */
export function resetWalletConnect(): void {
  cached = null
}
