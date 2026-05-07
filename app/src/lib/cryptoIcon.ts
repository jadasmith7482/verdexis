// Real cryptocurrency icons from the well-maintained
// `cryptocurrency-icons` open-source set, served via jsDelivr.
// https://github.com/spothq/cryptocurrency-icons
// Color SVGs for crisp rendering at any size.

const CDN = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color'

// CoinGecko id -> ticker symbol used by the icon set.
const ID_TO_SYMBOL: Record<string, string> = {
  bitcoin: 'btc',
  ethereum: 'eth',
  solana: 'sol',
  cardano: 'ada',
  ripple: 'xrp',
  binancecoin: 'bnb',
  dogecoin: 'doge',
  tron: 'trx',
  tether: 'usdt',
  'usd-coin': 'usdc',
  polkadot: 'dot',
  chainlink: 'link',
  avalanche: 'avax',
  'avalanche-2': 'avax',
  litecoin: 'ltc',
  'matic-network': 'matic',
  polygon: 'matic',
  'shiba-inu': 'shib',
  uniswap: 'uni',
  'bitcoin-cash': 'bch',
  stellar: 'xlm',
  cosmos: 'atom',
  'cosmos-hub': 'atom',
  filecoin: 'fil',
  'near-protocol': 'near',
  near: 'near',
  aptos: 'apt',
  arbitrum: 'arb',
  optimism: 'op',
  monero: 'xmr',
  zcash: 'zec',
  toncoin: 'ton',
  'the-open-network': 'ton',
  hyperliquid: 'hype',
  'whitebit-token': 'wbt',
  'internet-computer': 'icp',
  'ethereum-classic': 'etc',
  vechain: 'vet',
  algorand: 'algo',
  tezos: 'xtz',
  eos: 'eos',
  iota: 'miota',
  neo: 'neo',
  dash: 'dash',
  zilliqa: 'zil',
  qtum: 'qtum',
  decred: 'dcr',
  'usd-coin-bridged': 'usdc',
}

export function cryptoIconFor(idOrSymbol: string | undefined | null): string | null {
  if (!idOrSymbol) return null
  const key = idOrSymbol.toLowerCase()
  const sym = ID_TO_SYMBOL[key] ?? key
  return `${CDN}/${sym}.svg`
}

// ---- Stock / equity icons -------------------------------------------------
// Maps common tickers to the company domain we feed Clearbit's free logo
// service. Falls through to the initial-circle fallback when unknown.
const STOCK_DOMAIN: Record<string, string> = {
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  GOOG: 'google.com',
  GOOGL: 'google.com',
  AMZN: 'amazon.com',
  TSLA: 'tesla.com',
  META: 'meta.com',
  FB: 'meta.com',
  NVDA: 'nvidia.com',
  NFLX: 'netflix.com',
  AMD: 'amd.com',
  INTC: 'intel.com',
  ORCL: 'oracle.com',
  CRM: 'salesforce.com',
  ADBE: 'adobe.com',
  PYPL: 'paypal.com',
  SQ: 'block.xyz',
  BABA: 'alibaba.com',
  DIS: 'disney.com',
  WMT: 'walmart.com',
  COST: 'costco.com',
  KO: 'coca-cola.com',
  PEP: 'pepsico.com',
  MCD: 'mcdonalds.com',
  SBUX: 'starbucks.com',
  NKE: 'nike.com',
  V: 'visa.com',
  MA: 'mastercard.com',
  JPM: 'jpmorganchase.com',
  BAC: 'bankofamerica.com',
  WFC: 'wellsfargo.com',
  GS: 'goldmansachs.com',
  MS: 'morganstanley.com',
  BRK: 'berkshirehathaway.com',
  'BRK.B': 'berkshirehathaway.com',
  JNJ: 'jnj.com',
  PFE: 'pfizer.com',
  UNH: 'uhc.com',
  XOM: 'exxonmobil.com',
  CVX: 'chevron.com',
  T: 'att.com',
  VZ: 'verizon.com',
  IBM: 'ibm.com',
  CSCO: 'cisco.com',
  QCOM: 'qualcomm.com',
  TXN: 'ti.com',
  HD: 'homedepot.com',
  LOW: 'lowes.com',
  TGT: 'target.com',
  F: 'ford.com',
  GM: 'gm.com',
  UBER: 'uber.com',
  LYFT: 'lyft.com',
  ABNB: 'airbnb.com',
  SHOP: 'shopify.com',
  SPOT: 'spotify.com',
  ROKU: 'roku.com',
  ZM: 'zoom.us',
  // Common ETFs
  SPY: 'spdrs.com',
  VOO: 'vanguard.com',
  VTI: 'vanguard.com',
  QQQ: 'invesco.com',
  IVV: 'ishares.com',
  ARKK: 'ark-invest.com',
}

export function stockIconFor(symbol: string | undefined | null): string | null {
  if (!symbol) return null
  const key = symbol.toUpperCase()
  const domain = STOCK_DOMAIN[key]
  if (!domain) return null
  // Clearbit's free logo API was retired in 2024 and now returns 404 for
  // most tickers (which is exactly the "broken Apple icon" the user kept
  // seeing). Google's S2 favicon endpoint is public, key-less, never 404s
  // (returns a generic globe at worst), and serves a real branded icon for
  // every domain in our table. Use ?sz=128 to get a crisp logo at 32-48px.
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
}

// Smart resolver. Picks crypto vs stock URL based on `type` (preferred) or
// by checking whether the symbol/id looks like a known crypto/stock.
export function assetIconFor(
  idOrSymbol: string | undefined | null,
  type?: 'crypto' | 'stock' | 'etf' | string,
): string | null {
  if (!idOrSymbol) return null
  const key = String(idOrSymbol).toLowerCase()
  const upper = String(idOrSymbol).toUpperCase()
  // Type-driven dispatch is most reliable when caller knows.
  if (type === 'crypto') return cryptoIconFor(idOrSymbol)
  if (type === 'stock' || type === 'etf') return stockIconFor(idOrSymbol)
  // Heuristics: known crypto id/symbol takes precedence.
  if (ID_TO_SYMBOL[key] || ['btc', 'eth', 'sol', 'ada', 'xrp', 'usdt', 'usdc', 'doge', 'bnb'].includes(key)) {
    return cryptoIconFor(idOrSymbol)
  }
  if (STOCK_DOMAIN[upper]) return stockIconFor(idOrSymbol)
  // Unknown — try crypto first (matches existing behaviour), the onError
  // fallback will substitute a coloured initial if it 404s.
  return cryptoIconFor(idOrSymbol)
}

// React-friendly onError fallback: replace the broken icon with a coloured
// initial. Pass as `onError` on an <img>.
export function cryptoIconErrorFallback(initial: string) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    img.onerror = null
    // Inline SVG with the first letter as a clean fallback.
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%230C8B44'/><text x='16' y='21' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='14' font-weight='600' fill='white'>${initial}</text></svg>`
    img.src = `data:image/svg+xml;utf8,${svg}`
  }
}
