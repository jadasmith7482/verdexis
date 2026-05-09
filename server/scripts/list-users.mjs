import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const users = await p.user.findMany({
  include: { walletBalances: true, _count: { select: { transactions: true } } },
  orderBy: { updatedAt: 'desc' },
})
for (const u of users) {
  console.log(u.email, '| role=' + u.role, '| txs=' + u._count.transactions)
  for (const w of u.walletBalances) console.log('   -', w.currency, w.balance)
}
await p.$disconnect()
