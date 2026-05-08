import { useEffect, useRef, useState } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { api, getToken } from '../lib/api'

interface Notification {
  id: string
  kind: string
  title: string
  body: string | null
  read: boolean
  createdAt: string
}

const EVENT = 'verdexis:notifications'

export function pingNotifications() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!getToken()) { setItems([]); setUnread(0); return }
    try {
      const r = await api.listNotifications()
      // If a finance-related notification arrived since the last poll
      // (deposit approved/rejected, transfer received, trade filled), kick
      // a portfolio refresh so the wallet/holdings update without the user
      // having to reload the page.
      setItems((prev) => {
        const prevIds = new Set(prev.map((n) => n.id))
        const fresh = r.notifications.filter((n) => !prevIds.has(n.id))
        const moneyKinds = new Set(['deposit', 'withdraw', 'transfer', 'trade', 'fee', 'wallet'])
        if (fresh.some((n) => moneyKinds.has(n.kind))) {
          window.dispatchEvent(new Event('verdexis:portfolio-refresh'))
        }
        return r.notifications
      })
      setUnread(r.unread)
    } catch { /* offline */ }
  }

  useEffect(() => {
    void load()
    const interval = setInterval(load, 30000)
    const refresh = () => void load()
    window.addEventListener(EVENT, refresh)
    window.addEventListener('verdexis:profile', refresh)
    return () => {
      clearInterval(interval)
      window.removeEventListener(EVENT, refresh)
      window.removeEventListener('verdexis:profile', refresh)
    }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAll = async () => {
    if (!getToken()) return
    try { await api.markAllRead(); await load() } catch { /* ignore */ }
  }

  const remove = async (id: string) => {
    if (!getToken()) return
    try { await api.removeNotification(id); await load() } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#0C8B44] text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-hidden rounded-xl bg-[#0f1619] border border-[#ffffff10] shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ffffff08]">
            <p className="text-sm font-medium text-[#E5E5E5]">Notifications</p>
            {items.length > 0 && unread > 0 && (
              <button onClick={markAll} className="text-[11px] text-[#0C8B44] hover:text-[#0a7539] inline-flex items-center gap-1">
                <Check className="w-3 h-3" />Mark all read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#737373]">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
                You have no notifications yet.
              </div>
            ) : items.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-[#ffffff05] flex items-start gap-3 ${!n.read ? 'bg-[#0C8B44]/5' : ''}`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${n.read ? 'bg-[#444]' : 'bg-[#0C8B44]'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#E5E5E5] truncate">{n.title}</p>
                  {n.body && <p className="text-[11px] text-[#A0A0A0] mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-[#555] mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => remove(n.id)} aria-label="Dismiss" className="text-[#555] hover:text-[#E5E5E5]">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
