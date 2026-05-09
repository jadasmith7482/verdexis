// Diagnostic: call GET /api/wallet AS THE TARGET USER and print what
// the SPA would receive. This is the same response the dashboard reads.
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import fs from 'node:fs'

const p = new PrismaClient()
const API = 'http://127.0.0.1:4000'

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

const emailArg = process.argv[2]
const target = emailArg
  ? await p.user.findUnique({ where: { email: emailArg } })
  : await p.user.findFirst({ where: { role: { not: 'admin' } } })
if (!target) { console.error('No matching user'); process.exit(1) }
console.log('Target user:', target.email, target.id)

const dbBalances = await p.walletBalance.findMany({ where: { userId: target.id } })
console.log('\n=== DB direct read (walletBalance) ===')
for (const b of dbBalances) console.log(' ', b.currency, 'balance=', b.balance, 'available=', b.available)

const token = jwt.sign({ sub: target.id, email: target.email, v: target.tokenVersion }, SECRET, { expiresIn: '1h' })
const r = await fetch(`${API}/api/wallet`, { headers: { authorization: `Bearer ${token}` } })
const body = await r.json()
console.log('\n=== GET /api/wallet (status', r.status + ') ===')
console.log('balances:')
for (const b of body.balances) console.log(' ', b.currency, 'balance=', b.balance, 'available=', b.available)
console.log('first 5 transactions:')
for (const t of body.transactions.slice(0, 5)) console.log(' ', t.createdAt, t.kind, t.currency, t.amount, t.status, t.reference)

await p.$disconnect()
