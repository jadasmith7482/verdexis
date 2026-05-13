// Pending withdrawal fee-payment proofs awaiting admin verification.
//
// Flow:
//  1. User submits a withdrawal + the external transaction hash / wire ref
//     proving they paid the processing fee out-of-band.
//  2. The withdrawal itself is recorded immediately (debit), but the fee
//     credit-back is HELD in this queue.
//  3. Admin reviews each proof and either approves (credits the fee back
//     to the user's USD balance via adminApi.deposit) or rejects it.
//
// Storage: localStorage on the same browser the user submitted from. In
// production this would live server-side, but for the offline/demo build
// the queue is mirrored across tabs via the FEE_PROOFS_EVENT.

const STORAGE_KEY = 'verdexis_fee_proofs_v1'
export const FEE_PROOFS_EVENT = 'verdexis:feeProofs'

export type FeeProofStatus = 'pending' | 'verified' | 'rejected'
export type FeeProofKind = 'withdraw_fee' | 'bonus_unlock'

export interface FeeProof {
  id: string
  userEmail: string
  /** What this proof is for. Defaults to 'withdraw_fee' for backward
   *  compatibility with rows written before the kind field existed. */
  kind?: FeeProofKind
  /** Withdrawal gross amount (in `currency`). For bonus_unlock, this is
   *  the locked bonus amount being unlocked (informational only). */
  amount: number
  currency: string
  /** Fee owed in USD. Credited back to the user on approval. */
  feeUsd: number
  /** Currency the user used to pay the fee (e.g. BTC). */
  feePayCurrency: string
  /** Hash / reference the user pasted in. */
  feeProof: string
  /** Withdrawal reference (method + masked dest), or bonus-unlock note. */
  reference: string
  status: FeeProofStatus
  createdAt: string
  reviewedAt?: string
  reviewerNote?: string
}

function read(): FeeProof[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as FeeProof[]) : []
  } catch {
    return []
  }
}

function write(list: FeeProof[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(FEE_PROOFS_EVENT))
}

function newId(): string {
  return `fp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const feeProofs = {
  list(): FeeProof[] { return read() },
  listForUser(email: string): FeeProof[] {
    const k = (email || '').trim().toLowerCase()
    if (!k) return []
    return read().filter(p => p.userEmail.toLowerCase() === k)
  },
  pendingForUser(email: string): FeeProof[] {
    return this.listForUser(email).filter(p => p.status === 'pending')
  },
  add(input: Omit<FeeProof, 'id' | 'status' | 'createdAt'>): FeeProof {
    const proof: FeeProof = {
      ...input,
      id: newId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    const list = read()
    list.unshift(proof)
    write(list)
    return proof
  },
  setStatus(id: string, status: FeeProofStatus, reviewerNote?: string): FeeProof | null {
    const list = read()
    const idx = list.findIndex(p => p.id === id)
    if (idx < 0) return null
    list[idx] = { ...list[idx], status, reviewerNote, reviewedAt: new Date().toISOString() }
    write(list)
    return list[idx]
  },
  remove(id: string): void {
    write(read().filter(p => p.id !== id))
  },
}
