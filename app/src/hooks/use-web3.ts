import { useCallback, useEffect, useRef, useState } from 'react'
import type { EthereumProvider } from '../types/ethereum'
import {
  discoverWallets,
  WALLET_RDNS_STORAGE,
  brandLetterIcon,
  type DiscoveredProvider,
  type WalletProviderInfo,
} from '../lib/walletProviders'
import { getWalletConnectProvider, isWalletConnectConfigured, resetWalletConnect } from '../lib/walletConnect'
import { api, getToken } from '../lib/api'

const STORAGE_KEY = 'verdexis_web3_address'

// Synthetic identity for the WalletConnect "meta" wallet — distinguishes
// it from EIP-6963 entries in the picker without colliding with any real
// wallet rdns.
export const WALLETCONNECT_RDNS = 'org.walletconnect'
const WALLETCONNECT_INFO: WalletProviderInfo = {
  uuid: 'walletconnect',
  name: 'WalletConnect',
  rdns: WALLETCONNECT_RDNS,
  icon: brandLetterIcon('W', '#3B99FC'),
}

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
  const s = typeof id === 'string' ? id : String(id)
  return CHAIN_NAMES[s.toLowerCase()] ?? `Chain ${parseInt(s, 16) || s}`
}

/** Normalize a chainId returned by `eth_chainId` (WC v2 sometimes hands back
 *  a number, injected providers a 0x-hex string) to a 0x-hex string. */
function normalizeChainId(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return '0x' + raw.toString(16)
  return String(raw)
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

// Best-effort: tell the backend which self-custody address this user just
// linked. Auth-gated; silently no-ops when the user is signed out so the
// hook works on landing-page wallet demos as well as inside the app.
async function persistLinkToBackend(address: string, chainId: string | null, providerName: string): Promise<void> {
  if (!getToken()) return
  try {
    await api.linkWallet({
      address,
      chainId: chainId ?? undefined,
      provider: providerName,
    })
  } catch {
    // Don't surface API failures in the wallet UI — the on-chain
    // connection is what matters; the link record is convenience.
  }
}

async function clearLinkOnBackend(): Promise<void> {
  if (!getToken()) return
  try { await api.unlinkWallet() } catch { /* ignore */ }
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
      const raw = args[0]
      // WalletConnect v2 emits a number; injected providers emit a hex string.
      // Normalize to a 0x-prefixed hex string so downstream `.toLowerCase()`
      // calls and chain lookups never explode.
      const id = typeof raw === 'string'
        ? raw
        : typeof raw === 'number'
          ? '0x' + raw.toString(16)
          : raw == null ? null : String(raw)
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
          const chainId = normalizeChainId(await target.provider.request({ method: 'eth_chainId' }).catch(() => null))
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
    // Special-case the WalletConnect synthetic uuid so callers can
    // funnel both EIP-6963 picks and the WC option through one entry point.
    if (uuid === WALLETCONNECT_INFO.uuid) {
      await connectWalletConnectInternal()
      return
    }
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
      const chainId = normalizeChainId(await target.provider.request({ method: 'eth_chainId' }).catch(() => null))
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
        // Fire-and-forget: persist to backend so the link survives across
        // devices and shows up in admin views.
        void persistLinkToBackend(addr, chainId, target.info.name)
        setPickerOpen(false)
      } else {
        setState((s) => ({ ...s, isConnecting: false, error: 'No account selected' }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection rejected'
      setState((s) => ({ ...s, isConnecting: false, error: msg }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachListeners])

  // Internal helper kept out of the public API — connectTo('walletconnect')
  // is the public entry point so the picker UI doesn't need a second method.
  const connectWalletConnectInternal = useCallback(async () => {
    if (!isWalletConnectConfigured()) {
      setState((s) => ({
        ...s,
        error: 'WalletConnect is not configured. Set VITE_WC_PROJECT_ID in app/.env.',
      }))
      return
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }))
    try {
      const wc = await getWalletConnectProvider()
      if (!wc) {
        setState((s) => ({ ...s, isConnecting: false, error: 'WalletConnect failed to initialize' }))
        return
      }
      // `enable()` is the documented entry point on the WC v2 provider:
      // it opens the QR / deep-link modal, waits for the user to approve
      // in their wallet, and resolves with the account list. Calling
      // `request({ method: 'eth_requestAccounts' })` directly throws
      // "Please call connect() before request()" because the EIP-1193
      // request layer is gated until the session exists.
      type WcEnable = { enable: () => Promise<string[]> }
      const accounts = await (wc as unknown as WcEnable).enable()
      const chainId = normalizeChainId(await wc.request({ method: 'eth_chainId' }).catch(() => null))
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        providerRef.current = wc
        attachListeners(wc)
        const balanceEth = await fetchBalance(wc, addr)
        setState({
          address: addr,
          chainId,
          chainName: chainNameFor(chainId),
          balanceEth,
          isConnected: true,
          isConnecting: false,
          isAvailable: true,
          error: null,
          walletInfo: WALLETCONNECT_INFO,
        })
        try {
          localStorage.setItem(STORAGE_KEY, addr)
          localStorage.setItem(WALLET_RDNS_STORAGE, WALLETCONNECT_INFO.rdns)
        } catch { /* ignore */ }
        void persistLinkToBackend(addr, chainId, 'WalletConnect')
        setPickerOpen(false)
      } else {
        setState((s) => ({ ...s, isConnecting: false, error: 'No account approved' }))
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[WalletConnect] connect failed', err)
      const raw = err instanceof Error ? err.message : String(err ?? '')
      let msg = raw || 'Connection rejected'
      const expired = /Proposal expired|expired|timeout/i.test(raw)
      if (/projectId|project id|unauthorized|not authorized|origin/i.test(raw)) {
        msg = 'WalletConnect rejected this domain. The project allowlist on cloud.reown.com needs to include this site\u2019s URL.'
      } else if (expired) {
        msg = 'The connection request timed out. Tap WalletConnect again to get a fresh request and choose your wallet.'
      } else if (/User rejected|user closed|user denied/i.test(raw)) {
        msg = 'You closed the wallet without approving. Tap WalletConnect again to retry.'
      } else if (!raw) {
        msg = 'WalletConnect didn\u2019t respond. Check your network connection and try again.'
      }
      // On expiry, throw away the cached provider so the next click
      // builds a brand-new session with a fresh URI \u2014 otherwise WC
      // re-uses the dead proposal and the Open button stays grey.
      if (expired) resetWalletConnect()
      setState((s) => ({ ...s, isConnecting: false, error: msg }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // If the active provider is WalletConnect, tear down its session so the
    // QR modal shows up again next time. Best-effort — some implementations
    // throw if there's no active session.
    const p = providerRef.current as (EthereumProvider & { disconnect?: () => Promise<void> }) | null
    if (p && typeof p.disconnect === 'function') {
      try { void p.disconnect() } catch { /* ignore */ }
    }
    resetWalletConnect()
    setState((s) => ({ ...s, address: null, isConnected: false, balanceEth: null, error: null, walletInfo: null }))
    providerRef.current = null
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(WALLET_RDNS_STORAGE)
    } catch { /* ignore */ }
    void clearLinkOnBackend()
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
