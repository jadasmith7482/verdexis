import { useEffect } from 'react'
import { api, getToken } from '../lib/api'
import { marketData } from '../lib/marketData'
import { pingNotifications } from '../components/NotificationBell'

/**
 * Polls the market every 60s and submits a check-in to /api/alerts/check.
 * The server triggers any matching alerts and writes notifications, which
 * the bell picks up on its own poll.
 */
export default function AlertChecker() {
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      if (!getToken()) return
      try {
        const list = await marketData.getCryptoList()
        const prices = list
          .filter((c) => (c.symbol || c.id) && typeof c.current_price === 'number')
          .map((c) => ({ symbol: (c.symbol || c.id || '').toUpperCase(), price: c.current_price }))
        const r = await api.checkAlerts(prices)
        if (!cancelled && r.triggered > 0) pingNotifications()
      } catch {
        /* offline */
      }
    }
    void tick()
    const id = setInterval(tick, 60000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  return null
}
