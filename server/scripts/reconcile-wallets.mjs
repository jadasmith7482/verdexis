// Backfill: walk every user's completed-transaction history and bring their
// WalletBalance into agreement. This fixes accounts that received deposits/
// transfers BEFORE the admin inject endpoint started mutating the wallet
// (commit 4021ab3). Admin's $1T treasury is left alone.
//
// Convention (must match server/src/routes/admin.ts):
//   credit kinds: deposit, dividend, interest
//   debit  kinds: withdraw, transfer
// Only `status === 'completed'` rows count.
//
// Run: node scripts/reconcile-wallets.mjs            (dry-run, prints diff)
//      node scripts/reconcile-wallets.mjs --apply    (writes balances)

import { PrismaClient } from '@prisma/client'

const apply = process.argv.includes('--apply')
const p = new PrismaClient()

const CREDITS = new Set(['deposit', 'dividend', 'interest'])
const DEBITS = new Set(['withdraw', 'transfer'])

const TREASURY_EMAILS = new Set(['admin@verdexis.local'])

const users = await p.user.findMany({
  select: { id: true, email: true, role: true, walletBalances: true },
})

let totalChanges = 0
for (const u of users) {
  if (TREASURY_EMAILS.has(u.email)) {
    console.log(`[skip] ${u.email} (treasury)`)
    continue
  }
  const txs = await p.transaction.findMany({
    where: { userId: u.id, status: 'completed' },
  })
  // Sum signed deltas by currency.
  const expected = new Map() // currency -> { delta, symbol }
  for (const t of txs) {
    const mag = Math.abs(t.amount)
    const sign = CREDITS.has(t.kind) ? 1 : DEBITS.has(t.kind) ? -1 : 0
    if (sign === 0) continue
    const cur = expected.get(t.currency) || { delta: 0, symbol: t.currency === 'USD' ? '$' : t.currency }
    cur.delta += sign * mag
    expected.set(t.currency, cur)
  }

  const currentByCurrency = new Map(u.walletBalances.map((b) => [b.currency, b]))
  const allCurrencies = new Set([...expected.keys(), ...currentByCurrency.keys()])

  for (const currency of allCurrencies) {
    const exp = expected.get(currency)?.delta ?? 0
    const cur = currentByCurrency.get(currency)
    const have = cur?.balance ?? 0
    if (Math.abs(have - exp) < 0.005) continue
    totalChanges++
    console.log(
      `[diff] ${u.email} ${currency}: have=${have.toFixed(2)} expected=${exp.toFixed(2)} delta=${(exp - have).toFixed(2)}`,
    )
    if (apply) {
      const symbol = expected.get(currency)?.symbol || (currency === 'USD' ? '$' : currency)
      await p.walletBalance.upsert({
        where: { userId_currency: { userId: u.id, currency } },
        create: { userId: u.id, currency, symbol, balance: exp, available: exp },
        update: { balance: exp, available: exp, symbol },
      })
    }
  }
}

console.log('')
console.log(apply ? `Applied: ${totalChanges} balance corrections.` : `Dry-run: ${totalChanges} accounts would be corrected. Re-run with --apply to write.`)

await p.$disconnect()
