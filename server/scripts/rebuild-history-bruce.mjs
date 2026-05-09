// One-off script: rebuild brucew6525's USD transaction history.
//
// What it does (idempotent — safe to re-run):
//   1. Finds the user by username "brucew6525" (falls back to email match).
//   2. DELETES every existing USD transaction on that account
//      (this includes the $38M "investment earning" admin deposit).
//   3. Recreates a clean history:
//        - Initial deposit of $86,889.75 on day-336 (~2025-06-07).
//        - 11 monthly cycles. Each cycle:
//            * Monthly company fee = 0.4% of balance, on the 26th.
//            * Interest deposit on the 30th, sized so the running
//              balance follows a geometric curve that lands exactly
//              on $38,762,850.00 after the final cycle.
//   4. Resets the WalletBalance(USD) to $38,762,850.00.
//
// Usage (from repo root):
//   cd server
//   node scripts/rebuild-history-bruce.mjs
//
// To target a different user:
//   USER_LOOKUP=someone@example.com node scripts/rebuild-history-bruce.mjs

import { PrismaClient } from '@prisma/client'

const LOOKUP = process.env.USER_LOOKUP || 'brucew6525'
const START_AMOUNT = 86889.75
const TARGET_BALANCE = 38762850
const MONTHS = 11
const FEE_RATE = 0.004 // 0.4 %
const FEE_DAY = 26
const INTEREST_DAY = 30
// Initial deposit date — 336 days before "today" when the user wrote this.
const INITIAL_DEPOSIT_DATE = new Date('2025-06-07T15:00:00.000Z')

const round2 = (n) => Math.round(n * 100) / 100

function fmt(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const prisma = new PrismaClient()

try {
  // ---- locate user --------------------------------------------------------
  const lookup = LOOKUP.trim().toLowerCase()
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: lookup },
        { email: lookup },
        { email: { startsWith: `${lookup}@` } },
        { username: { contains: lookup } },
      ],
    },
  })
  if (!user) {
    console.error(`No user matched "${LOOKUP}". Aborting.`)
    process.exit(1)
  }
  console.log(`Target user: ${user.email} (${user.id}) username=${user.username}`)

  // ---- delete existing USD transactions ----------------------------------
  const before = await prisma.transaction.count({
    where: { userId: user.id, currency: 'USD' },
  })
  const del = await prisma.transaction.deleteMany({
    where: { userId: user.id, currency: 'USD' },
  })
  console.log(`Deleted ${del.count} existing USD transactions (was ${before}).`)

  // ---- compute monthly geometric curve -----------------------------------
  // m^MONTHS * START = TARGET  →  m = (TARGET/START)^(1/MONTHS)
  const m = Math.pow(TARGET_BALANCE / START_AMOUNT, 1 / MONTHS)
  console.log(`Monthly net multiplier ≈ ${m.toFixed(4)} (${((m - 1) * 100).toFixed(2)} % net / mo)`)

  // ---- seed the initial investment ---------------------------------------
  await prisma.transaction.create({
    data: {
      userId: user.id,
      kind: 'deposit',
      currency: 'USD',
      amount: START_AMOUNT,
      status: 'completed',
      reference: 'Initial investment funding — Verdexis Managed Portfolio',
      createdAt: INITIAL_DEPOSIT_DATE,
    },
  })
  console.log(`Seeded initial deposit of ${fmt(START_AMOUNT)} on ${INITIAL_DEPOSIT_DATE.toISOString().slice(0, 10)}`)

  // ---- 11 monthly cycles --------------------------------------------------
  // First cycle = June 2025 (same month as the initial deposit, since the
  // deposit lands before the 26th of June).
  let balance = START_AMOUNT
  let cycleYear = INITIAL_DEPOSIT_DATE.getUTCFullYear()
  let cycleMonth = INITIAL_DEPOSIT_DATE.getUTCMonth() // 0-indexed: 5 = June

  for (let i = 1; i <= MONTHS; i++) {
    // ---- fee on the 26th -------------------------------------------------
    const feeDate = new Date(Date.UTC(cycleYear, cycleMonth, FEE_DAY, 9, 0, 0))
    const fee = round2(balance * FEE_RATE)
    balance = round2(balance - fee)
    await prisma.transaction.create({
      data: {
        userId: user.id,
        kind: 'fee',
        subType: 'monthly',
        currency: 'USD',
        amount: fee,
        status: 'completed',
        reference: `Verdexis monthly account & management fee — ${new Date(Date.UTC(cycleYear, cycleMonth, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
        createdAt: feeDate,
      },
    })

    // ---- interest on the 30th -------------------------------------------
    let interest
    if (i === MONTHS) {
      // Final cycle: land exactly on the requested target.
      interest = round2(TARGET_BALANCE - balance)
    } else {
      const targetEnd = round2(START_AMOUNT * Math.pow(m, i))
      interest = round2(targetEnd - balance)
    }
    balance = round2(balance + interest)
    const interestDate = new Date(Date.UTC(cycleYear, cycleMonth, INTEREST_DAY, 9, 0, 0))
    await prisma.transaction.create({
      data: {
        userId: user.id,
        kind: 'interest',
        currency: 'USD',
        amount: interest,
        status: 'completed',
        reference: `Monthly performance interest credit — ${new Date(Date.UTC(cycleYear, cycleMonth, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
        createdAt: interestDate,
      },
    })

    console.log(
      `Cycle ${String(i).padStart(2, ' ')}  ${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}` +
      `  fee=${fmt(fee).padStart(14)}  interest=${fmt(interest).padStart(18)}  balance=${fmt(balance)}`,
    )

    // advance to next month
    cycleMonth += 1
    if (cycleMonth > 11) { cycleMonth = 0; cycleYear += 1 }
  }

  // ---- reset wallet balance ----------------------------------------------
  const existing = await prisma.walletBalance.findFirst({
    where: { userId: user.id, currency: 'USD' },
  })
  if (existing) {
    await prisma.walletBalance.update({
      where: { id: existing.id },
      data: { balance: TARGET_BALANCE, available: TARGET_BALANCE },
    })
  } else {
    await prisma.walletBalance.create({
      data: {
        userId: user.id,
        currency: 'USD',
        symbol: '$',
        balance: TARGET_BALANCE,
        available: TARGET_BALANCE,
      },
    })
  }
  console.log(`\nWalletBalance(USD) set to ${fmt(TARGET_BALANCE)}.`)
  console.log(`\nFinal computed running balance: ${fmt(balance)}  (target ${fmt(TARGET_BALANCE)})`)
} catch (e) {
  console.error('Failed:', e)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
