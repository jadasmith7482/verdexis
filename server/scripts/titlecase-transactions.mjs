// Title-case every transaction `reference` so historical descriptions
// match the new presets. Skips refs that look like IDs / codes (contain
// digits, dashes-only, or all-caps acronyms longer than 4 chars).
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

// Words that stay all-caps (financial / tech acronyms).
const KEEP_UPPER = new Set(['ACH', 'USD', 'USDT', 'USDC', 'BTC', 'ETH', 'KYC', 'AML', 'API', 'ID', 'IRA', 'ETF', 'REIT', 'IPO', 'P2P', 'NFT', 'DAO', 'CFO', 'CEO', 'IRS', 'SEC'])

function titleCase(s) {
  return s.split(/(\s+|[—–-])/).map((tok) => {
    if (/^\s+$/.test(tok)) return tok
    if (/^[—–-]+$/.test(tok)) return tok
    if (!tok) return tok
    // Skip emails, URLs, IDs, hex/coded tokens — leave as-is.
    if (tok.includes('@') || /^https?:/i.test(tok) || /\d/.test(tok)) return tok
    const upper = tok.toUpperCase()
    if (KEEP_UPPER.has(upper)) return upper
    // Preserve all-caps acronyms ≥2 chars (already canonical).
    if (tok.length >= 2 && tok === upper && /^[A-Z]+$/.test(tok)) return tok
    return tok.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part).join('-')
  }).join('')
}

const txs = await p.transaction.findMany({ where: { reference: { not: null } } })
let changed = 0
for (const t of txs) {
  if (!t.reference) continue
  const next = titleCase(t.reference)
  if (next !== t.reference) {
    await p.transaction.update({ where: { id: t.id }, data: { reference: next } })
    console.log(`${t.id}: "${t.reference}" -> "${next}"`)
    changed++
  }
}
console.log(`\nUpdated ${changed} transactions.`)
await p.$disconnect()
