// Minimal EIP-1193 provider typing for window.ethereum (MetaMask, Coinbase Wallet,
// Rabby, Trust Wallet, etc.). Extend as needed.
export interface EthereumProvider {
  isMetaMask?: boolean
  isCoinbaseWallet?: boolean
  isTrust?: boolean
  isRabby?: boolean
  selectedAddress?: string | null
  chainId?: string
  request: <T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<T>
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export {}
