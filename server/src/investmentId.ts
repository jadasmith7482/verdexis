import crypto from 'node:crypto'
import { prisma } from './db.js'

// Format: "VDX-" + 8 uppercase hex chars (e.g. VDX-9F4A2B1C).
// 32 bits ≈ 4.3B combinations — collisions are vanishingly rare for
// realistic user counts; we still retry on the unique-index conflict.
function makeCandidate(): string {
  return 'VDX-' + crypto.randomBytes(4).toString('hex').toUpperCase()
}

/**
 * Generate a unique investmentId by probing the DB until we find a
 * value not yet taken. Retries up to 5 times (effectively never needed).
 */
export async function generateInvestmentId(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = makeCandidate()
    const exists = await prisma.user.findUnique({
      where: { investmentId: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }
  // Last-ditch: append a few more random chars to almost certainly avoid collision.
  return 'VDX-' + crypto.randomBytes(6).toString('hex').toUpperCase()
}
