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
