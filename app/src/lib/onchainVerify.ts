/**
 * Lightweight on-chain transaction verification for crypto deposits.
 *
 * Uses free public endpoints (no API keys) to check whether a user-submitted
 * transaction hash actually exists on the network, has reached enough
 * confirmations, and (where possible) was sent to the expected deposit
 * address. Used by the Wallet → Deposit → Crypto flow so a confirmed tx
 * credits the wallet balance immediately rather than waiting for admin
 * review.
 *
 * Supported assets: BTC (mempool.space), ETH/USDT/USDC (Ankr public RPC),
 * SOL (Solana mainnet RPC). Other assets fall back to "unsupported" — those
 * deposits stay pending and require admin approval as before.
 */

export type VerifyStatus =
  | { kind: 'confirmed'; confirmations: number; toAddress?: string; amount?: number }
  | { kind: 'pending'; confirmations: number; required: number; amount?: number }
  | { kind: 'not_found' }
  | { kind: 'mismatch'; reason: string }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string }

const REQUIRED: Record<string, number> = {
  BTC: 2,
  ETH: 12,
  USDT: 12,
  USDC: 12,
  SOL: 32,
}

// Free public RPC endpoints. These do rate-limit but are fine for the
// occasional user-driven verification call.
const ETH_RPC = 'https://rpc.ankr.com/eth'
const SOL_RPC = 'https://api.mainnet-beta.solana.com'
const BTC_API = 'https://mempool.space/api'

const USDT_CONTRACT = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const USDC_CONTRACT = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

async function jsonRpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  const data = await res.json() as { result?: unknown; error?: { message?: string } }
  if (data.error) throw new Error(data.error.message || 'RPC error')
  return data.result
}

async function verifyBtc(txid: string, expectedAddress: string): Promise<VerifyStatus> {
  try {
    const res = await fetch(`${BTC_API}/tx/${txid}`)
    if (res.status === 404) return { kind: 'not_found' }
    if (!res.ok) return { kind: 'error', message: `Block explorer ${res.status}` }
    const tx = await res.json() as {
      vout: Array<{ scriptpubkey_address?: string; value: number }>
      status: { confirmed: boolean; block_height?: number }
    }
    const matchOut = tx.vout.find(v => (v.scriptpubkey_address || '').toLowerCase() === expectedAddress.toLowerCase())
    if (!matchOut) return { kind: 'mismatch', reason: 'Transaction does not pay your deposit address.' }
    // BTC vout.value is in satoshis.
    const amount = (matchOut.value || 0) / 1e8

    if (!tx.status.confirmed) {
      return { kind: 'pending', confirmations: 0, required: REQUIRED.BTC, amount }
    }
    // Compute confirmations from current tip.
    const tipRes = await fetch(`${BTC_API}/blocks/tip/height`)
    const tip = parseInt(await tipRes.text(), 10)
    const conf = Number.isFinite(tip) && tx.status.block_height ? (tip - tx.status.block_height + 1) : 1
    if (conf >= REQUIRED.BTC) return { kind: 'confirmed', confirmations: conf, toAddress: matchOut.scriptpubkey_address, amount }
    return { kind: 'pending', confirmations: conf, required: REQUIRED.BTC, amount }
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'BTC verification failed' }
  }
}

async function verifyEthLike(currency: 'ETH' | 'USDT' | 'USDC', txhash: string, expectedAddress: string): Promise<VerifyStatus> {
  try {
    const hash = txhash.startsWith('0x') ? txhash : `0x${txhash}`
    const tx = await jsonRpc(ETH_RPC, 'eth_getTransactionByHash', [hash]) as null | {
      to?: string; from?: string; value?: string; input?: string; blockNumber?: string | null
    }
    if (!tx) return { kind: 'not_found' }
    const receipt = await jsonRpc(ETH_RPC, 'eth_getTransactionReceipt', [hash]) as null | {
      status?: string; blockNumber?: string; logs?: Array<{ address: string; topics: string[]; data: string }>
    }
    if (!receipt || !receipt.blockNumber) {
      return { kind: 'pending', confirmations: 0, required: REQUIRED[currency] }
    }
    if (receipt.status !== '0x1') return { kind: 'mismatch', reason: 'Transaction reverted on-chain.' }

    const tipHex = await jsonRpc(ETH_RPC, 'eth_blockNumber', []) as string
    const tip = parseInt(tipHex, 16)
    const blk = parseInt(receipt.blockNumber, 16)
    const conf = Math.max(0, tip - blk + 1)

    let toAddress = ''
    let amount = 0
    if (currency === 'ETH') {
      if (!tx.to) return { kind: 'mismatch', reason: 'No recipient on this ETH transaction.' }
      toAddress = tx.to.toLowerCase()
      if (toAddress !== expectedAddress.toLowerCase()) {
        return { kind: 'mismatch', reason: 'Transaction does not pay your deposit address.' }
      }
      // tx.value is hex wei (1 ETH = 1e18 wei).
      amount = tx.value ? Number(BigInt(tx.value)) / 1e18 : 0
    } else {
      const contract = (currency === 'USDT' ? USDT_CONTRACT : USDC_CONTRACT).toLowerCase()
      // ERC-20 Transfer(address,address,uint256) topic
      const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const log = (receipt.logs || []).find(l => l.address.toLowerCase() === contract && l.topics[0] === TRANSFER_TOPIC)
      if (!log) return { kind: 'mismatch', reason: `Transaction is not a ${currency} transfer.` }
      const toTopic = log.topics[2] || ''
      const recipient = '0x' + toTopic.slice(-40)
      toAddress = recipient.toLowerCase()
      if (toAddress !== expectedAddress.toLowerCase()) {
        return { kind: 'mismatch', reason: 'Transfer recipient does not match your deposit address.' }
      }
      // ERC-20 data is hex uint256 token units. USDT/USDC use 6 decimals.
      const raw = log.data && log.data !== '0x' ? Number(BigInt(log.data)) : 0
      amount = raw / 1e6
    }

    if (conf >= REQUIRED[currency]) return { kind: 'confirmed', confirmations: conf, toAddress, amount }
    return { kind: 'pending', confirmations: conf, required: REQUIRED[currency], amount }
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'EVM verification failed' }
  }
}

async function verifySol(signature: string, expectedAddress: string): Promise<VerifyStatus> {
  try {
    const tx = await jsonRpc(SOL_RPC, 'getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]) as null | {
      slot: number
      meta: { err: unknown | null; postBalances: number[]; preBalances: number[] } | null
      transaction: { message: { accountKeys: Array<{ pubkey: string } | string> } }
    }
    if (!tx) return { kind: 'not_found' }
    if (tx.meta?.err) return { kind: 'mismatch', reason: 'Transaction failed on-chain.' }

    const keys = tx.transaction.message.accountKeys.map(k => typeof k === 'string' ? k : k.pubkey)
    const idx = keys.findIndex(k => k === expectedAddress)
    if (idx === -1) return { kind: 'mismatch', reason: 'Transaction does not credit your deposit address.' }
    const credited = (tx.meta?.postBalances?.[idx] ?? 0) - (tx.meta?.preBalances?.[idx] ?? 0)
    if (credited <= 0) return { kind: 'mismatch', reason: 'No SOL credited to your deposit address in this transaction.' }
    // SOL native amount is in lamports (1 SOL = 1e9 lamports).
    const amount = credited / 1e9

    const slotHex = await jsonRpc(SOL_RPC, 'getSlot', []) as number
    const conf = Math.max(1, slotHex - tx.slot)
    if (conf >= REQUIRED.SOL) return { kind: 'confirmed', confirmations: conf, toAddress: expectedAddress, amount }
    return { kind: 'pending', confirmations: conf, required: REQUIRED.SOL, amount }
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'SOL verification failed' }
  }
}

/** Verify a transaction hash for a given asset and expected destination address. */
export async function verifyDepositTx(currency: string, txHash: string, expectedAddress: string): Promise<VerifyStatus> {
  const cur = currency.toUpperCase()
  const hash = txHash.trim()
  if (!hash) return { kind: 'error', message: 'Transaction hash is empty.' }
  if (!expectedAddress) return { kind: 'error', message: 'No expected deposit address available.' }

  switch (cur) {
    case 'BTC': return verifyBtc(hash, expectedAddress)
    case 'ETH':
    case 'USDT':
    case 'USDC': return verifyEthLike(cur, hash, expectedAddress)
    case 'SOL': return verifySol(hash, expectedAddress)
    default: return { kind: 'unsupported' }
  }
}

export function isVerifiableCurrency(currency: string): boolean {
  return ['BTC', 'ETH', 'USDT', 'USDC', 'SOL'].includes(currency.toUpperCase())
}
