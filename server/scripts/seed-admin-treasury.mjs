import { PrismaClient } from '@prisma/client'

const TREASURY = 1_000_000_000_000

const prisma = new PrismaClient()
try {
  const admins = await prisma.user.findMany({ where: { role: 'admin' } })
  for (const a of admins) {
    const existing = await prisma.walletBalance.findFirst({ where: { userId: a.id, currency: 'USD' } })
    if (!existing) {
      await prisma.walletBalance.create({
        data: { userId: a.id, currency: 'USD', symbol: '$', balance: TREASURY, available: TREASURY },
      })
    } else if (existing.balance < TREASURY) {
      await prisma.walletBalance.update({
        where: { id: existing.id },
        data: { balance: TREASURY, available: TREASURY },
      })
    }
    console.log(`Seeded ${a.email}: USD = ${TREASURY}`)
  }
  if (admins.length === 0) console.log('No admin users found')
} catch (e) {
  console.error('Failed:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
