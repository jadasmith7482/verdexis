import { useCallback, useEffect, useRef, useState } from 'react'
import type { EthereumProvider } from '../types/ethereum'
import {
  discoverWallets,
  WALLET_RDNS_STORAGE,
  type DiscoveredProvider,
  type WalletProviderInfo,
} from '../lib/walletProviders'

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
  walletInfo: WalletProviderInfo | null
}

const initialState: Web3State = {
  address: null,
  chainId: null,
  chainName: '',
  balanceEth: null,
  isConnected: false,
  isConnecting: false,
  // Optimistic; real value resolved after first discovery pass.
  isAvailable: typeof window !== 'undefined' && !!window.ethereum,
  error: null,
  walletInfo: null,
}

function chainNameFor(id: string | null): string {
  if (!id) return ''
  return CHAIN_NAMES[id.toLowerCase()] ?? `Chain ${parseInt(id, 16) || id}`
}

async function fetchBalance(provider: EthereumProvider, address: string): Promise<number | null> {
  try {
    const hex = await provider.request<string>({ method: 'eth_getBalance', params: [address, 'latest'] })
    if (typeof hex !== 'string') return null
    const wei = BigInt(hex)
    const eth = Number(wei) / 1e18
    return Number.isFinite(eth) ? eth : null
  } catch {
    return null
  }
}

export function useWeb3() {
  const [state, setState] = useState<Web3State>(initialState)
  // Active provider — kept in a ref so listeners always close over the latest one.
  const providerRef = useRef<EthereumProvider | null>(null)
  const [discovered, setDiscovered] = useState<DiscoveredProvider[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const attachListeners = useCallback((provider: EthereumProvider) => {
    if (!provider?.on) return () => {}
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
    }
    provider.on('accountsChanged', onAccountsChanged)
    provider.on('chainChanged', onChainChanged)
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged)
      provider.removeListener?.('chainChanged', onChainChanged)
    }
  }, [])

  // Discovery pass on mount — also auto-rehydrates the previously chosen wallet.
  useEffect(() => {
    let cancelled = false
    let detach: (() => void) | undefined

    ;(async () => {
      const list = await discoverWallets()
      if (cancelled) return
      setDiscovered(list)
      setState((s) => ({ ...s, isAvailable: list.length > 0 }))

      const lastRdns = (() => {
        try { return localStorage.getItem(WALLET_RDNS_STORAGE) } catch { return null }
      })()
      const target = lastRdns
        ? list.find((d) => d.info.rdns === lastRdns) ?? list[0]
        : list[0]
      if (!target) return

      try {
        const accounts = await target.provider.request<string[]>({ method: 'eth_accounts' })
        if (cancelled) return
        if (accounts && accounts.length > 0) {
          const addr = accounts[0]
          providerRef.current = target.provider
          detach = attachListeners(target.provider)
          const chainId = await target.provider.request<string>({ method: 'eth_chainId' }).catch(() => null)
          const balanceEth = await fetchBalance(target.provider, addr)
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
            walletInfo: target.info,
          })
          try { localStorage.setItem(STORAGE_KEY, addr) } catch { /* ignore */ }
        }
      } catch {
        // Provider exists but call failed — leave disconnected, don't error UI.
      }
    })()

    return () => {
      cancelled = true
      detach?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connectTo = useCallback(async (uuid: string) => {
    const refreshed = await discoverWallets()
    setDiscovered(refreshed)
    const target = refreshed.find((d) => d.info.uuid === uuid)
    if (!target) {
      setState((s) => ({ ...s, error: 'Wallet not detected. Make sure the extension is installed and unlocked.' }))
      return
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }))
    try {
      const accounts = await target.provider.request<string[]>({ method: 'eth_requestAccounts' })
      const chainId = await target.provider.request<string>({ method: 'eth_chainId' }).catch(() => null)
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        providerRef.current = target.provider
        attachListeners(target.provider)
        const balanceEth = await fetchBalance(target.provider, addr)
        setState({
          address: addr,
          chainId,
          chainName: chainNameFor(chainId),
          balanceEth,
          isConnected: true,
          isConnecting: false,
          isAvailable: true,
          error: null,
          walletInfo: target.info,
        })
        try {
          localStorage.setItem(STORAGE_KEY, addr)
          localStorage.setItem(WALLET_RDNS_STORAGE, target.info.rdns)
        } catch { /* ignore */ }
        setPickerOpen(false)
      } else {
        setState((s) => ({ ...s, isConnecting: false, error: 'No account selected' }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection rejected'
      setState((s) => ({ ...s, isConnecting: false, error: msg }))
    }
  }, [attachListeners])

  const connect = useCallback(async () => {
    // Always re-discover when the user clicks Connect — wallet extensions can
    // inject after page load, so a stale empty list shouldn't lock them out.
    const list = await discoverWallets()
    setDiscovered(list)
    if (list.length === 0) {
      setState((s) => ({ ...s, error: 'No Web3 wallet detected. Choose one to install.', isAvailable: false }))
      setPickerOpen(true)
      return
    }
    if (list.length === 1) {
      await connectTo(list[0].info.uuid)
      return
    }
    setPickerOpen(true)
  }, [connectTo])

  const refreshDiscovered = useCallback(async () => {
    const list = await discoverWallets()
    setDiscovered(list)
    setState((s) => ({ ...s, isAvailable: list.length > 0 }))
    return list
  }, [])

  const disconnect = useCallback(() => {
    setState((s) => ({ ...s, address: null, isConnected: false, balanceEth: null, error: null, walletInfo: null }))
    providerRef.current = null
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(WALLET_RDNS_STORAGE)
    } catch { /* ignore */ }
  }, [])

  const refreshBalance = useCallback(async () => {
    const provider = providerRef.current
    if (!provider || !state.address) return
    const bal = await fetchBalance(provider, state.address)
    setState((s) => ({ ...s, balanceEth: bal }))
  }, [state.address])

  const sendTransaction = useCallback(async (params: { to?: string; valueEth: number | string }): Promise<string> => {
    const provider = providerRef.current
    if (!provider) throw new Error('No Web3 wallet connected')
    if (!state.address) throw new Error('Wallet not connected')
    const value = typeof params.valueEth === 'string' ? Number(params.valueEth) : params.valueEth
    if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid amount')
    const to = (params.to ?? state.address).toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(to)) throw new Error('Invalid recipient address')
    const wei = BigInt(Math.floor(value * 1e18))
    const hexValue = '0x' + wei.toString(16)
    const txHash = await provider.request<string>({
      method: 'eth_sendTransaction',
      params: [{ from: state.address, to, value: hexValue }],
    })
    if (typeof txHash !== 'string') throw new Error('Transaction failed')
    setTimeout(() => { void refreshBalance() }, 2500)
    return txHash
  }, [state.address, refreshBalance])

  const shortAddress = state.address ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}` : null

  return {
    ...state,
    shortAddress,
    discovered,
    pickerOpen,
    setPickerOpen,
    connect,
    connectTo,
    refreshDiscovered,
    disconnect,
    sendTransaction,
    refreshBalance,
  }
}
