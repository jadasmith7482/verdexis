import { PrismaClient } from '@prisma/client'

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/promote-admin.mjs <email>')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
  })
  console.log('Promoted:', user.email, '-> role:', user.role)
} catch (e) {
  console.error('Failed:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
