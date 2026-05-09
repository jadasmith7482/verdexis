import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Canonical USD formatter for the whole app. Always shows cents so balances
 * never silently round (e.g. $1,234 vs $1,234.56). Use this anywhere we
 * render a fiat amount; for multi-currency display use `useCurrency().format`.
 *
 * @param n          The dollar amount (positive or negative).
 * @param opts.sign  When true, always prefixes '+' for non-negative values.
 *                   Negative values always show '-'.
 */
export function formatUsd(n: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '$0.00'
  const abs = Math.abs(n)
  const body = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const sign = n < 0 ? '-' : opts.sign ? '+' : ''
  return `${sign}$${body}`
}

/**
 * Compact USD formatter for headline numbers that can span many magnitudes
 * (e.g. crypto market caps in the trillions). Uses K / M / B / T suffixes
 * with up to 2 decimals.
 *   1_234        -> "$1.23K"
 *   2_246_287_409_172 -> "$2.25T"
 */
export function formatUsdCompact(n: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '$0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : opts.sign ? '+' : ''
  const fmt = (v: number, suffix: string) => {
    const s = v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    return `${sign}$${s}${suffix}`
  }
  if (abs >= 1e12) return fmt(abs / 1e12, 'T')
  if (abs >= 1e9) return fmt(abs / 1e9, 'B')
  if (abs >= 1e6) return fmt(abs / 1e6, 'M')
  if (abs >= 1e3) return fmt(abs / 1e3, 'K')
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/**
 * Format a non-USD currency amount with sensible decimals. Fiat (USD/EUR/GBP)
 * gets 2 decimals; crypto gets up to 8 decimals but trims trailing zeros.
 * Returns just the number portion (no symbol) so callers can prefix the
 * symbol/code as they wish.
 */
export function formatAmount(n: number, currency: string): string {
  if (!Number.isFinite(n)) return '0'
  const isFiat = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(currency.toUpperCase())
  if (isFiat) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  // Crypto: show meaningful precision but trim zeros (0.10000000 -> 0.1).
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })
}

/**
 * Format a USD price that may span many magnitudes (BTC at $67k, SHIB at
 * $0.000012). Always returns a `$`-prefixed string.
 *  - >= $1     -> 2 decimals  ($67,432.10)
 *  - >= $0.01  -> 4 decimals  ($0.5234)
 *  - smaller   -> up to 8 significant digits ($0.00001234)
 */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '$0.00'
  const abs = Math.abs(n)
  let body: string
  if (abs >= 1) {
    body = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  } else if (abs >= 0.01) {
    body = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  } else if (abs > 0) {
    body = abs.toLocaleString(undefined, { maximumSignificantDigits: 4 })
  } else {
    body = '0.00'
  }
  return `${n < 0 ? '-' : ''}$${body}`
}

/**
 * Pick a responsive Tailwind font-size class set for a headline number so
 * the formatted string stays on one line at any magnitude (thousands ->
 * trillions). Pair with `whitespace-nowrap` (no `truncate`) on the element
 * so the number never wraps and never gets clipped to "...".
 *
 *   text-3xl sm:text-4xl md:text-5xl  - up to ~$999,999.99   (10 chars)
 *   text-2xl sm:text-3xl md:text-4xl  - up to ~$999,999,999  (13 chars)
 *   text-xl  sm:text-2xl md:text-3xl  - up to ~$999B         (16 chars)
 *   text-lg  sm:text-xl  md:text-2xl  - trillions and beyond
 */
export function headlineAmountClass(formatted: string): string {
  const len = formatted.length
  if (len <= 10) return 'text-3xl sm:text-4xl md:text-5xl'
  if (len <= 13) return 'text-2xl sm:text-3xl md:text-4xl'
  if (len <= 16) return 'text-xl sm:text-2xl md:text-3xl'
  return 'text-lg sm:text-xl md:text-2xl'
}
