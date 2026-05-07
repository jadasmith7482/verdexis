// Local staking / yield tracker. Each position has an asset, principal,
// APY, and start date. Pending rewards are computed on the fly from
// (principal * apy * elapsed / year). Default seed positions illustrate
// realistic ETH / SOL / USDC yields so a brand-new account isn't empty.

const STORAGE_KEY = 'verdexis_staking'
const EVENT = 'verdexis:staking'

export interface StakingPosition {
  id: string
  asset: string // symbol e.g. ETH
  name: string
  principal: number // amount of asset staked
  apy: number // 0.05 = 5%
  startedAt: string // ISO
  protocol: string // e.g. 'Lido', 'Marinade', 'Aave'
  payoutFrequencyDays: number
}

const DEFAULT_POSITIONS: StakingPosition[] = [
  { id: 's_eth', asset: 'ETH', name: 'Ethereum', principal: 5, apy: 0.038, startedAt: new Date(Date.now() - 90 * 86400_000).toISOString(), protocol: 'Lido', payoutFrequencyDays: 1 },
  { id: 's_sol', asset: 'SOL', name: 'Solana', principal: 120, apy: 0.072, startedAt: new Date(Date.now() - 45 * 86400_000).toISOString(), protocol: 'Marinade', payoutFrequencyDays: 2 },
  { id: 's_usdc', asset: 'USDC', name: 'USD Coin', principal: 25000, apy: 0.045, startedAt: new Date(Date.now() - 30 * 86400_000).toISOString(), protocol: 'Aave v3', payoutFrequencyDays: 1 },
]

function load(): StakingPosition[] {
  if (typeof window === 'undefined') return DEFAULT_POSITIONS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_POSITIONS
    const parsed = JSON.parse(raw) as StakingPosition[]
    return Array.isArray(parsed) ? parsed : DEFAULT_POSITIONS
  } catch { return DEFAULT_POSITIONS }
}

function save(list: StakingPosition[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(EVENT))
}

export const stakingStore = {
  list(): StakingPosition[] { return load() },
  add(input: Omit<StakingPosition, 'id' | 'startedAt'>): StakingPosition {
    const p: StakingPosition = { ...input, id: `s_${Date.now()}`, startedAt: new Date().toISOString() }
    save([...load(), p])
    return p
  },
  remove(id: string) { save(load().filter((p) => p.id !== id)) },
}

export function pendingRewardFor(p: StakingPosition): { rewardAsset: number; nextPayoutInDays: number } {
  const elapsedYears = (Date.now() - new Date(p.startedAt).getTime()) / (365 * 86400_000)
  const totalAccrued = p.principal * p.apy * Math.max(0, elapsedYears)
  const cyclesElapsed = Math.floor((Date.now() - new Date(p.startedAt).getTime()) / (p.payoutFrequencyDays * 86400_000))
  const nextPayout = new Date(p.startedAt).getTime() + (cyclesElapsed + 1) * p.payoutFrequencyDays * 86400_000
  const nextPayoutInDays = Math.max(0, (nextPayout - Date.now()) / 86400_000)
  // Reward since the last payout cycle:
  const sinceLast = totalAccrued - (cyclesElapsed * p.principal * p.apy * (p.payoutFrequencyDays / 365))
  return { rewardAsset: Math.max(0, sinceLast), nextPayoutInDays }
}

export const STAKING_EVENT = EVENT
