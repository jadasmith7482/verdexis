/**
 * Promote a user to admin (or demote with --demote).
 * Usage:
 *   tsx scripts/promote-admin.ts user@example.com
 *   tsx scripts/promote-admin.ts user@example.com --demote
 *   tsx scripts/promote-admin.ts --list
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--list')) {
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    if (admins.length === 0) {
      console.log('No admins yet.')
      return
    }
    console.log(`${admins.length} admin(s):`)
    for (const a of admins) console.log(`  - ${a.email}  (${a.name})  id=${a.id}`)
    return
  }

  const email = args.find((a) => !a.startsWith('--'))
  const demote = args.includes('--demote')
  if (!email) {
    console.error('Usage: tsx scripts/promote-admin.ts <email> [--demote]')
    console.error('       tsx scripts/promote-admin.ts --list')
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`No user with email ${email}`)
    process.exit(1)
  }
  const nextRole = demote ? 'user' : 'admin'
  if (user.role === nextRole) {
    console.log(`${email} is already ${nextRole} — nothing to do.`)
    return
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: nextRole },
    select: { email: true, role: true },
  })
  console.log(`OK: ${updated.email} is now '${updated.role}'.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
