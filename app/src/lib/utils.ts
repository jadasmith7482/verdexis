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
