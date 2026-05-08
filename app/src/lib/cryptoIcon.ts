// Crypto icons. We resolve a CoinGecko-style id (e.g. "bitcoin") or a ticker
// symbol (e.g. "btc") to a remote logo URL. The web is full of half-broken
// icon CDNs — the spothq `cryptocurrency-icons` set we used to rely on
// hasn't been updated in years and is missing every coin minted after ~2022
// (TON, APT, ARB, OP, SUI, HYPE, WBT, etc.), which is why the user was
// seeing broken images everywhere. We now hit CoinCap's PNG icon CDN first
// (covers the long tail of modern tokens), then fall back through the
// spothq SVG set, then the data-URI initial.

import type React from 'react'

// Public, key-less PNG icon CDN that covers most active tokens, keyed by
// lowercased ticker symbol.
const COINCAP_CDN = 'https://assets.coincap.io/assets/icons'
// Long-standing SVG set, used as a secondary fallback. Updated via jsDelivr.
const SPOTHQ_CDN = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color'

// CoinGecko id -> lowercased ticker symbol.
const ID_TO_SYMBOL: Record<string, string> = {
  bitcoin: 'btc',
  ethereum: 'eth',
  solana: 'sol',
  cardano: 'ada',
  ripple: 'xrp',
  binancecoin: 'bnb',
  'binance-coin': 'bnb',
  dogecoin: 'doge',
  tron: 'trx',
  tether: 'usdt',
  'usd-coin': 'usdc',
  'usd-coin-bridged': 'usdc',
  polkadot: 'dot',
  chainlink: 'link',
  avalanche: 'avax',
  'avalanche-2': 'avax',
  litecoin: 'ltc',
  'matic-network': 'matic',
  polygon: 'matic',
  'polygon-pos': 'matic',
  'polygon-ecosystem-token': 'pol',
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
  sui: 'sui',
  pepe: 'pepe',
  bonk: 'bonk',
  wif: 'wif',
  'dogwifcoin': 'wif',
  jupiter: 'jup',
  'jupiter-exchange-solana': 'jup',
  pyth: 'pyth',
  'pyth-network': 'pyth',
  worldcoin: 'wld',
  'worldcoin-wld': 'wld',
  starknet: 'strk',
  injective: 'inj',
  'injective-protocol': 'inj',
  sei: 'sei',
  'sei-network': 'sei',
  celestia: 'tia',
  render: 'rndr',
  'render-token': 'rndr',
  fetch: 'fet',
  'fetch-ai': 'fet',
  'the-graph': 'grt',
  maker: 'mkr',
  aave: 'aave',
  curve: 'crv',
  'curve-dao-token': 'crv',
  lido: 'ldo',
  'lido-dao': 'ldo',
  'wrapped-bitcoin': 'wbtc',
  'staked-ether': 'steth',
  'wrapped-steth': 'wsteth',
  dai: 'dai',
  'true-usd': 'tusd',
  'first-digital-usd': 'fdusd',
  'pax-dollar': 'usdp',
  ondo: 'ondo',
  'ondo-finance': 'ondo',
  kaspa: 'kas',
  'kaspa-2': 'kas',
  fantom: 'ftm',
  thorchain: 'rune',
  hedera: 'hbar',
  'hedera-hashgraph': 'hbar',
  flow: 'flow',
  axie: 'axs',
  'axie-infinity': 'axs',
  sandbox: 'sand',
  'the-sandbox': 'sand',
  decentraland: 'mana',
  enjin: 'enj',
  'enjin-coin': 'enj',
  chiliz: 'chz',
  blur: 'blur',
  pendle: 'pendle',
  'rocket-pool': 'rpl',
  arweave: 'ar',
  helium: 'hnt',
  'mantle-staked-ether': 'meth',
  mantle: 'mnt',
  'kucoin-shares': 'kcs',
  bittensor: 'tao',
  bonkswap: 'bonk',
}

// Resolve to lowercased ticker symbol used by CoinCap / spothq.
function symbolFor(idOrSymbol: string): string {
  const key = idOrSymbol.toLowerCase()
  return ID_TO_SYMBOL[key] ?? key
}

export function cryptoIconFor(idOrSymbol: string | undefined | null): string | null {
  if (!idOrSymbol) return null
  return `${COINCAP_CDN}/${symbolFor(idOrSymbol)}@2x.png`
}

// Returns the secondary URL we should try when the primary CoinCap image
// 404s. Used by `cryptoIconErrorFallback` to chain through providers.
function cryptoIconFallbackChain(sym: string): string[] {
  return [
    `${SPOTHQ_CDN}/${sym}.svg`,
  ]
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

// React-friendly onError fallback: walk the secondary CDN chain before
// substituting an inline coloured-initial SVG. Pass as `onError` on an <img>.
// The optional `idOrSymbol` enables the multi-CDN fallback chain; without
// it we just go straight to the initial SVG (legacy behaviour).
export function cryptoIconErrorFallback(initial: string, idOrSymbol?: string) {
  const chain = idOrSymbol ? cryptoIconFallbackChain(symbolFor(idOrSymbol)) : []
  let attempt = 0
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (attempt < chain.length) {
      img.src = chain[attempt]
      attempt += 1
      return
    }
    img.onerror = null
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%230C8B44'/><text x='16' y='21' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='14' font-weight='600' fill='white'>${initial}</text></svg>`
    img.src = `data:image/svg+xml;utf8,${svg}`
  }
}
