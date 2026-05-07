import { useCallback, useEffect, useState } from 'react'
import type { EthereumProvider } from '../types/ethereum'

const STORAGE_KEY = 'verdexis_web3_address'

const CHAIN_NAMES: Record<string, string> = {
  '0x1': 'Ethereum',
  '0x5': 'Goerli',
  '0xaa36a7': 'Sepolia',
  '0x89': 'Polygon',
  '0xa4b1': 'Arbitrum',
  '0xa': 'Optimism',
  '0x2105': 'Base',
  '0x38': 'BNB Chain',
  '0xa86a': 'Avalanche',
}

export interface Web3State {
  address: string | null
  chainId: string | null
  chainName: string
  balanceEth: number | null
  isConnected: boolean
  isConnecting: boolean
  isAvailable: boolean
  error: string | null
}

const initialState: Web3State = {
  address: null,
  chainId: null,
  chainName: '',
  balanceEth: null,
  isConnected: false,
  isConnecting: false,
  isAvailable: typeof window !== 'undefined' && !!window.ethereum,
  error: null,
}

function getProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null
  return window.ethereum ?? null
}

function chainNameFor(id: string | null): string {
  if (!id) return ''
  return CHAIN_NAMES[id.toLowerCase()] ?? `Chain ${parseInt(id, 16) || id}`
}

async function fetchBalance(provider: EthereumProvider, address: string): Promise<number | null> {
  try {
    const hex = await provider.request<string>({ method: 'eth_getBalance', params: [address, 'latest'] })
    if (typeof hex !== 'string') return null
    // wei -> eth, lossy but fine for display
    const wei = BigInt(hex)
    const eth = Number(wei) / 1e18
    return Number.isFinite(eth) ? eth : null
  } catch {
    return null
  }
}

export function useWeb3() {
  const [state, setState] = useState<Web3State>(initialState)

  // Restore + auto-detect existing connection on mount.
  useEffect(() => {
    const provider = getProvider()
    if (!provider) {
      setState((s) => ({ ...s, isAvailable: false }))
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const accounts = await provider.request<string[]>({ method: 'eth_accounts' })
        const chainId = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null)
        if (cancelled) return
        if (accounts && accounts.length > 0) {
          const addr = accounts[0]
          const balanceEth = await fetchBalance(provider, addr)
          if (cancelled) return
          setState({
            address: addr,
            chainId,
            chainName: chainNameFor(chainId),
            balanceEth,
            isConnected: true,
            isConnecting: false,
            isAvailable: true,
            error: null,
          })
          try { localStorage.setItem(STORAGE_KEY, addr) } catch { /* ignore */ }
        }
      } catch {
        // Provider exists but call failed — leave disconnected, don't error UI.
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Listen for account / chain changes from the wallet UI.
  useEffect(() => {
    const provider = getProvider()
    if (!provider?.on) return
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[]) ?? []
      if (!accounts.length) {
        setState((s) => ({ ...s, address: null, isConnected: false, balanceEth: null }))
        try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      } else {
        const addr = accounts[0]
        setState((s) => ({ ...s, address: addr, isConnected: true, error: null }))
        try { localStorage.setItem(STORAGE_KEY, addr) } catch { /* ignore */ }
        fetchBalance(provider, addr).then((bal) => setState((s) => ({ ...s, balanceEth: bal })))
      }
    }
    const onChainChanged = (...args: unknown[]) => {
      const id = args[0] as string
      setState((s) => ({ ...s, chainId: id, chainName: chainNameFor(id) }))
      const addr = state.address
      if (addr) fetchBalance(provider, addr).then((bal) => setState((s) => ({ ...s, balanceEth: bal })))
    }
    provider.on('accountsChanged', onAccountsChanged)
    provider.on('chainChanged', onChainChanged)
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged)
      provider.removeListener?.('chainChanged', onChainChanged)
    }
  }, [state.address])

  const connect = useCallback(async () => {
    const provider = getProvider()
    if (!provider) {
      setState((s) => ({ ...s, error: 'No Web3 wallet detected. Install MetaMask to continue.', isAvailable: false }))
      return
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }))
    try {
      const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' })
      const chainId = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null)
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        const balanceEth = await fetchBalance(provider, addr)
        setState({
          address: addr,
          chainId,
          chainName: chainNameFor(chainId),
          balanceEth,
          isConnected: true,
          isConnecting: false,
          isAvailable: true,
          error: null,
        })
        try { localStorage.setItem(STORAGE_KEY, addr) } catch { /* ignore */ }
      } else {
        setState((s) => ({ ...s, isConnecting: false, error: 'No account selected' }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection rejected'
      setState((s) => ({ ...s, isConnecting: false, error: msg }))
    }
  }, [])

  const disconnect = useCallback(() => {
    setState((s) => ({ ...s, address: null, isConnected: false, balanceEth: null, error: null }))
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  const shortAddress = state.address ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}` : null

  return { ...state, shortAddress, connect, disconnect }
}
