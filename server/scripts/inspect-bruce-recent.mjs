import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const u = await p.user.findUnique({ where: { email: 'brucew6525@verdexis.com' } })
if (!u) { console.log('no user'); process.exit(0) }
const t = await p.transaction.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 12 })
for (const x of t) {
  console.log(
    x.createdAt.toISOString(),
    'kind=' + x.kind,
    'sub=' + (x.subType || '-'),
    'st=' + x.status,
    x.currency,
    'amt=' + x.amount,
    'usd=' + x.usdValue,
    '| ref=' + String(x.reference || '').slice(0, 80)
  )
}
await p.$disconnect()
