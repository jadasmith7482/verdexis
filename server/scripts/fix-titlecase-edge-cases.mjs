import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
await p.transaction.update({ where: { id: 'cmow0owuw00041398in8dp0hc' }, data: { reference: 'Sent To brucew6525@verdexis.com' } })
await p.transaction.update({ where: { id: 'cmow0p0k4000d13982ox6z5op' }, data: { reference: 'Sent To brucew6525@verdexis.com' } })
await p.transaction.update({ where: { id: 'cmow0ox9p00061398ayrstegu' }, data: { reference: 'INV Initial Payment' } })
console.log('Reverted email casing and INV acronym.')
await p.$disconnect()
