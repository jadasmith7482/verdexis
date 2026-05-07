/**
 * Optional bridge to Alpaca's paper-trading API. When ALPACA_KEY + ALPACA_SECRET
 * are present in the environment we forward the user's order to Alpaca and
 * return their fill data. Otherwise we no-op and the local DB-only execution
 * path runs unchanged.
 *
 * Alpaca paper docs: https://docs.alpaca.markets/docs/paper-trading
 */

interface AlpacaOrder {
  id: string
  status: string
  filled_qty?: string
  filled_avg_price?: string | null
}

export interface BrokerFill {
  id: string
  status: string
  filledQty: number
  filledPrice: number | null
}

const BASE = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets'

export function brokerEnabled(): boolean {
  return !!(process.env.ALPACA_KEY && process.env.ALPACA_SECRET)
}

/**
 * Submit a market order to Alpaca paper. Returns null if broker is not
 * configured or the upstream call fails (caller continues with local-only
 * execution).
 */
export async function submitPaperOrder(input: {
  symbol: string
  side: 'buy' | 'sell'
  qty: number
  type?: 'crypto' | 'stock' | 'etf'
}): Promise<BrokerFill | null> {
  if (!brokerEnabled()) return null
  const key = process.env.ALPACA_KEY!
  const secret = process.env.ALPACA_SECRET!

  // Alpaca expects 'BTC/USD' style symbols for crypto, plain ticker for equities.
  const symbol = input.type === 'crypto' && !input.symbol.includes('/')
    ? `${input.symbol.toUpperCase()}/USD`
    : input.symbol.toUpperCase()

  try {
    const r = await fetch(`${BASE}/v2/orders`, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': key,
        'APCA-API-SECRET-KEY': secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        qty: String(input.qty),
        side: input.side,
        type: 'market',
        time_in_force: input.type === 'crypto' ? 'gtc' : 'day',
      }),
    })
    if (!r.ok) {
      const txt = await r.text()
      console.warn('[broker] alpaca', r.status, txt.slice(0, 200))
      return null
    }
    const j = (await r.json()) as AlpacaOrder
    return {
      id: j.id,
      status: j.status,
      filledQty: parseFloat(j.filled_qty || '0') || input.qty,
      filledPrice: j.filled_avg_price ? parseFloat(j.filled_avg_price) : null,
    }
  } catch (e) {
    console.warn('[broker] alpaca error', e)
    return null
  }
}
