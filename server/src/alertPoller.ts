import { prisma } from './db.js'

// Server-side price-alert poller.
//
// Periodically pulls the top N CoinGecko markets, then evaluates every active
// PriceAlert across all users in a single pass. When an alert's condition is
// met we flip its state and create a Notification — same shape as the
// client-driven /api/alerts/check endpoint, just running unattended.
//
// Disabled when ALERT_POLL_ENABLED=false. Interval defaults to 60s.

interface Tick { symbol: string; price: number }

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false'

async function fetchTicks(): Promise<Tick[]> {
  const r = await fetch(COINGECKO_URL, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`)
  const data = (await r.json()) as Array<{ symbol: string; current_price: number }>
  return data
    .filter((d) => typeof d.current_price === 'number' && d.symbol)
    .map((d) => ({ symbol: d.symbol.toUpperCase(), price: d.current_price }))
}

async function evaluateOnce(): Promise<{ checked: number; triggered: number }> {
  const active = await prisma.priceAlert.findMany({ where: { active: true, triggered: false } })
  if (active.length === 0) return { checked: 0, triggered: 0 }

  let ticks: Tick[]
  try {
    ticks = await fetchTicks()
  } catch (e) {
    console.warn('[alert-poller] fetch failed:', (e as Error).message)
    return { checked: active.length, triggered: 0 }
  }
  const priceBySymbol = new Map(ticks.map((t) => [t.symbol, t.price]))

  let triggered = 0
  for (const alert of active) {
    const price = priceBySymbol.get(alert.symbol.toUpperCase())
    if (price == null) continue
    const hit = alert.direction === 'above' ? price >= alert.target : price <= alert.target
    if (!hit) continue
    try {
      await prisma.$transaction([
        prisma.priceAlert.update({
          where: { id: alert.id },
          data: { triggered: true, triggeredAt: new Date(), active: false },
        }),
        prisma.notification.create({
          data: {
            userId: alert.userId,
            kind: 'alert',
            title: `${alert.name} ${alert.direction} $${alert.target}`,
            body: `Current price: $${price.toFixed(2)}`,
          },
        }),
      ])
      triggered++
    } catch (e) {
      console.warn('[alert-poller] failed to trigger alert', alert.id, (e as Error).message)
    }
  }
  return { checked: active.length, triggered }
}

let timer: NodeJS.Timeout | null = null
let running = false

export function startAlertPoller(opts: { intervalMs: number }): void {
  if (timer) return
  const tick = async () => {
    if (running) return
    running = true
    try {
      const r = await evaluateOnce()
      if (r.triggered > 0) {
        console.log(`[alert-poller] checked ${r.checked} alerts, triggered ${r.triggered}`)
      }
    } catch (e) {
      console.warn('[alert-poller] tick error:', (e as Error).message)
    } finally {
      running = false
    }
  }
  // Fire once shortly after boot, then on the interval.
  setTimeout(() => { void tick() }, 5_000)
  timer = setInterval(() => { void tick() }, opts.intervalMs)
  if (typeof timer.unref === 'function') timer.unref()
  console.log(`[alert-poller] enabled (every ${Math.round(opts.intervalMs / 1000)}s)`)
}

export function stopAlertPoller(): void {
  if (timer) { clearInterval(timer); timer = null }
}
