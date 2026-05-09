// Remove the diagnostic inject + any traces (notifications, audit rows)
// and reconcile Bruce's wallet against the remaining transaction history.
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

const REF = 'diagnostic-inject-test'

const txs = await p.transaction.findMany({ where: { reference: REF } })
console.log('Transactions to remove:', txs.length)
for (const t of txs) console.log(' -', t.id, t.userId, t.kind, t.currency, t.amount, t.createdAt)

if (txs.length) {
  await p.transaction.deleteMany({ where: { reference: REF } })
  console.log('Deleted transactions.')
}

const notifs = await p.notification.findMany({ where: { body: REF } })
console.log('Notifications to remove:', notifs.length)
if (notifs.length) {
  await p.notification.deleteMany({ where: { body: REF } })
  console.log('Deleted notifications.')
}

const audits = await p.adminAudit.findMany({
  where: { payload: { contains: REF } },
})
console.log('Audit rows to remove:', audits.length)
if (audits.length) {
  await p.adminAudit.deleteMany({ where: { id: { in: audits.map((a) => a.id) } } })
  console.log('Deleted audit rows.')
}

// Reconcile every affected user's wallet from remaining tx history.
const CREDITS = new Set(['deposit', 'dividend', 'interest'])
const DEBITS = new Set(['withdraw', 'transfer'])
const userIds = [...new Set(txs.map((t) => t.userId))]
for (const uid of userIds) {
  const remaining = await p.transaction.findMany({ where: { userId: uid, status: 'completed' } })
  const byCur = new Map()
  for (const t of remaining) {
    const sign = CREDITS.has(t.kind) ? 1 : DEBITS.has(t.kind) ? -1 : 0
    if (!sign) continue
    byCur.set(t.currency, (byCur.get(t.currency) || 0) + sign * Math.abs(t.amount))
  }
  for (const [currency, total] of byCur) {
    const symbol = currency === 'USD' ? '$' : currency
    await p.walletBalance.upsert({
      where: { userId_currency: { userId: uid, currency } },
      create: { userId: uid, currency, symbol, balance: total, available: total },
      update: { balance: total, available: total, symbol },
    })
    console.log(`Reconciled ${uid} ${currency} -> ${total.toFixed(2)}`)
  }
}

await p.$disconnect()
