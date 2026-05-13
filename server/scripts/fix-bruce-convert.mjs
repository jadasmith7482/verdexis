// One-shot fix for Bruce's USD->BTC conversion that landed pre-fix:
// - USD transfer leg was stored as positive 1,000,000 (should be debit -1,000,000)
// - BTC leg was stored as kind='deposit', status='pending' (should be a
//   completed 'transfer' subType='convert' credit, mirroring the new flow)
// Also makes sure his BTC walletBalance reflects the credit (the pending
// deposit never settled, so the BTC was never credited to his wallet).
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()
const EMAIL = 'brucew6525@verdexis.com'
const REF = 'Convert USD → BTC'

const u = await p.user.findUnique({ where: { email: EMAIL } })
if (!u) { console.log('No user found'); process.exit(1) }

// Find the bad pair: most-recent USD transfer + BTC deposit referencing the convert.
const usdLeg = await p.transaction.findFirst({
  where: { userId: u.id, kind: 'transfer', currency: 'USD', reference: { contains: 'Convert to BTC' } },
  orderBy: { createdAt: 'desc' },
})
const btcLeg = await p.transaction.findFirst({
  where: { userId: u.id, currency: 'BTC', reference: { contains: 'Converted from USD' } },
  orderBy: { createdAt: 'desc' },
})

if (!usdLeg || !btcLeg) {
  console.log('Could not locate bad pair', { usdLeg: !!usdLeg, btcLeg: !!btcLeg })
  process.exit(1)
}

console.log('Before:')
console.log(' USD leg:', usdLeg.id, usdLeg.kind, usdLeg.status, usdLeg.amount, usdLeg.reference)
console.log(' BTC leg:', btcLeg.id, btcLeg.kind, btcLeg.status, btcLeg.amount, btcLeg.reference)

const btcAmount = Math.abs(btcLeg.amount)
const usdAmount = Math.abs(usdLeg.amount)

await p.$transaction(async (tx) => {
  // Normalize USD leg → debit, completed, canonical reference + subType
  await tx.transaction.update({
    where: { id: usdLeg.id },
    data: {
      amount: -usdAmount,
      status: 'completed',
      reference: REF,
      subType: 'convert',
    },
  })
  // Convert BTC leg from pending deposit → completed transfer credit
  await tx.transaction.update({
    where: { id: btcLeg.id },
    data: {
      kind: 'transfer',
      status: 'completed',
      amount: btcAmount,
      reference: REF,
      subType: 'convert',
    },
  })
  // Credit the BTC to his wallet balance (the pending deposit never settled,
  // so the balance row is missing the increment).
  const existing = await tx.walletBalance.findUnique({
    where: { userId_currency: { userId: u.id, currency: 'BTC' } },
  })
  if (existing) {
    await tx.walletBalance.update({
      where: { userId_currency: { userId: u.id, currency: 'BTC' } },
      data: { balance: existing.balance + btcAmount, available: existing.available + btcAmount },
    })
  } else {
    await tx.walletBalance.create({
      data: { userId: u.id, currency: 'BTC', symbol: '₿', balance: btcAmount, available: btcAmount },
    })
  }
})

const usdAfter = await p.transaction.findUnique({ where: { id: usdLeg.id } })
const btcAfter = await p.transaction.findUnique({ where: { id: btcLeg.id } })
const bal = await p.walletBalance.findUnique({ where: { userId_currency: { userId: u.id, currency: 'BTC' } } })
console.log('After:')
console.log(' USD leg:', usdAfter?.kind, usdAfter?.status, usdAfter?.amount, usdAfter?.reference)
console.log(' BTC leg:', btcAfter?.kind, btcAfter?.status, btcAfter?.amount, btcAfter?.reference)
console.log(' BTC balance:', bal?.balance)

await p.$disconnect()
