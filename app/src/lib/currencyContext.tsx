// Multi-currency display context. Stores user's preferred display currency
// and an FX rate map keyed by ISO code (USD = 1.0). Rates refresh from
// CoinGecko's `simple/price` endpoint every 5 minutes — same source the rest
// of the app already uses, so no new API key is needed.
//
// We export constants + hook + provider from this single file. Splitting
// would touch ~10 import sites for no runtime gain, so disable the
// fast-refresh "only export components" rule for this file specifically.
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type DisplayCurrency = 'USD' | 'EUR' | 'GBP' | 'BTC' | 'ETH'

export interface CurrencyOption {
  code: DisplayCurrency
  symbol: string
  label: string
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'Pound Sterling' },
  { code: 'BTC', symbol: '₿', label: 'Bitcoin' },
  { code: 'ETH', symbol: 'Ξ', label: 'Ethereum' },
]

const STORAGE_KEY = 'verdexis_currency'

interface Ctx {
  currency: DisplayCurrency
  symbol: string
  rate: number // multiply USD by this to get target currency
  setCurrency: (c: DisplayCurrency) => void
  format: (usd: number, opts?: { compact?: boolean; sign?: boolean; decimals?: number }) => string
}

const CurrencyCtx = createContext<Ctx | null>(null)

const FALLBACK_RATES: Record<DisplayCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  BTC: 1 / 67000,
  ETH: 1 / 3500,
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
    if (typeof window === 'undefined') return 'USD'
    const saved = localStorage.getItem(STORAGE_KEY) as DisplayCurrency | null
    return saved && CURRENCY_OPTIONS.find((c) => c.code === saved) ? saved : 'USD'
  })
  const [rates, setRates] = useState<Record<DisplayCurrency, number>>(FALLBACK_RATES)

  useEffect(() => {
    let cancelled = false
    const fetchRates = async () => {
      try {
        // Use our backend CoinGecko proxy to avoid CORS: 1 BTC/ETH -> usd/eur/gbp
        const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || ''
        const res = await fetch(`${apiBase}/api/market/coingecko/simple-price?ids=bitcoin,ethereum&vs_currencies=usd,eur,gbp`, { signal: AbortSignal.timeout(6000) })
        if (!res.ok) return
        const j = await res.json() as { bitcoin?: Record<string, number>; ethereum?: Record<string, number> }
        const btcUsd = j.bitcoin?.usd
        const ethUsd = j.ethereum?.usd
        const eurUsd = j.bitcoin?.eur && btcUsd ? j.bitcoin.eur / btcUsd : FALLBACK_RATES.EUR
        const gbpUsd = j.bitcoin?.gbp && btcUsd ? j.bitcoin.gbp / btcUsd : FALLBACK_RATES.GBP
        if (cancelled) return
        setRates({
          USD: 1,
          EUR: eurUsd,
          GBP: gbpUsd,
          BTC: btcUsd ? 1 / btcUsd : FALLBACK_RATES.BTC,
          ETH: ethUsd ? 1 / ethUsd : FALLBACK_RATES.ETH,
        })
      } catch { /* keep fallbacks */ }
    }
    void fetchRates()
    const t = setInterval(fetchRates, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const setCurrency = (c: DisplayCurrency) => {
    setCurrencyState(c)
    try { localStorage.setItem(STORAGE_KEY, c) } catch { /* ignore */ }
  }

  const value = useMemo<Ctx>(() => {
    const opt = CURRENCY_OPTIONS.find((o) => o.code === currency) || CURRENCY_OPTIONS[0]
    const rate = rates[currency] ?? 1
    return {
      currency,
      symbol: opt.symbol,
      rate,
      setCurrency,
      format(usd, opts = {}) {
        const converted = usd * rate
        const abs = Math.abs(converted)
        const isCrypto = currency === 'BTC' || currency === 'ETH'
        const decimals = opts.decimals ?? (isCrypto ? (abs < 1 ? 6 : 4) : 2)
        // Only switch to compact notation for very large fiat values (≥1M),
        // and even then keep 2 fractional digits so cents aren't dropped
        // for things like $1,234,567.89 -> '$1.23M'.
        const useCompact = opts.compact && abs >= 1_000_000 && !isCrypto
        const formatted = useCompact
          ? abs.toLocaleString(undefined, { notation: 'compact', minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        const sign = opts.sign ? (converted >= 0 ? '+' : '-') : (converted < 0 ? '-' : '')
        return `${sign}${opt.symbol}${formatted}`
      },
    }
  }, [currency, rates])

  return <CurrencyCtx.Provider value={value}>{children}</CurrencyCtx.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyCtx)
  if (!ctx) throw new Error('useCurrency must be used inside <CurrencyProvider>')
  return ctx
}
