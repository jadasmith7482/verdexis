import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { AdminConsoleContent } from '../../pages/AdminDashboard'

/**
 * Renders the full admin console body inline inside the Dashboard, so that an
 * admin sees their dashboard and operator console "all together" on a single
 * page. Visible only when the server confirms `role === 'admin'` — never
 * trusts cached localStorage state.
 */
export default function AdminConsoleEmbed() {
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    let cancelled = false
    api.me()
      .then((r) => { if (!cancelled) setIsAdmin(r.user.role === 'admin') })
      .catch(() => { /* not signed in / non-admin */ })
    return () => { cancelled = true }
  }, [])
  if (!isAdmin) return null
  return (
    <div className="mb-6 rounded-3xl border border-[#0C8B44]/20 bg-[#070C0E]/60 p-1">
      <div className="rounded-[22px] bg-[#070C0E]/80 px-4 py-6">
        <AdminConsoleContent />
      </div>
    </div>
  )
}
