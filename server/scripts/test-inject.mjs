// Diagnostic: simulate what the admin "Inject transaction" form does and
// verify the wallet balance moves. Direct DB read so we don't need a token.
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import fs from 'node:fs'

const p = new PrismaClient()
const API = 'http://127.0.0.1:4000'

// Mint an admin JWT directly using the JWT_SECRET in .env so we don't need
// to know the admin password.
function readEnv(file) {
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}
const env = readEnv('.env')
const SECRET = env.JWT_SECRET
if (!SECRET) throw new Error('JWT_SECRET not in .env')

const admin = await p.user.findFirst({ where: { role: 'admin' } })
if (!admin) throw new Error('No admin user in DB')
const token = jwt.sign({ sub: admin.id, email: admin.email }, SECRET, { expiresIn: '1h' })
console.log('Logged in as admin:', admin.email)


const target = await p.user.findFirst({ where: { role: { not: 'admin' } } })
if (!target) { console.error('No non-admin user'); process.exit(1) }
console.log('Target user:', target.email, target.id)

const before = await p.walletBalance.findUnique({
  where: { userId_currency: { userId: target.id, currency: 'USD' } },
})
console.log('Before — balance:', before?.balance ?? 0, '| available:', before?.available ?? 0)

const amount = 12345.67
const r = await fetch(`${API}/api/admin/users/${target.id}/transactions`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    kind: 'deposit',
    currency: 'USD',
    amount,
    status: 'completed',
    reference: 'diagnostic-inject-test',
  }),
})
const text = await r.text()
console.log('POST status:', r.status)
console.log('POST body:', text.slice(0, 600))

const after = await p.walletBalance.findUnique({
  where: { userId_currency: { userId: target.id, currency: 'USD' } },
})
console.log('After  — balance:', after?.balance ?? 0, '| available:', after?.available ?? 0)
console.log('Delta  — balance:', (after?.balance ?? 0) - (before?.balance ?? 0))

await p.$disconnect()
