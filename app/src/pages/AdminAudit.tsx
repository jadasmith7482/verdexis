import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminAuditLog } from '../lib/adminApi'
import { getToken } from '../lib/api'
import { ArrowLeft, RefreshCw, Search, Activity, Download } from 'lucide-react'

export default function AdminAudit() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [limit, setLimit] = useState(100)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  function load() {
    setLoading(true)
    adminApi.audit({ limit, action: action || undefined, actorId: actorId || undefined, targetUserId: targetUserId || undefined, since: since || undefined, until: until || undefined })
      .then((r) => setLogs(r.audit))
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load audit log'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [limit, action, actorId, targetUserId, since, until])

  async function downloadCsv() {
    const url = adminApi.auditCsvUrl({ limit: Math.max(limit, 500), action: action || undefined, actorId: actorId || undefined, targetUserId: targetUserId || undefined, since: since || undefined, until: until || undefined })
    try {
      const token = getToken()
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `audit-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch { toast.error('Export failed') }
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return logs
    const needle = q.trim().toLowerCase()
    return logs.filter((l) =>
      l.action.toLowerCase().includes(needle) ||
      l.actor?.email?.toLowerCase().includes(needle) ||
      l.target?.email?.toLowerCase().includes(needle) ||
      (l.payload || '').toLowerCase().includes(needle)
    )
  }, [logs, q])

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to admin
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5] flex items-center gap-3">
              <Activity className="w-6 h-6 text-[#0C8B44]" />Audit log
            </h1>
            <p className="text-xs text-[#737373]">Every admin mutation is recorded with actor, target and payload.</p>
          </div>
          <div className="flex gap-2 items-center">
            <select aria-label="Limit" value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]">
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={250}>Last 250</option>
              <option value={500}>Last 500</option>
              <option value={2000}>Last 2000</option>
            </select>
            <button onClick={downloadCsv} className="inline-flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#ffffff10] text-sm text-[#A0A0A0] rounded-lg hover:border-[#0C8B44]/40">
              <Download className="w-4 h-4" />Export CSV
            </button>
            <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539]">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
          <input placeholder="Action contains…" value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
          <input placeholder="Actor user id" value={actorId} onChange={(e) => setActorId(e.target.value)} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
          <input placeholder="Target user id" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-xs text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
          <input type="datetime-local" aria-label="Since" value={since} onChange={(e) => setSince(e.target.value)} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-xs text-[#A0A0A0] focus:outline-none focus:border-[#0C8B44]" />
          <input type="datetime-local" aria-label="Until" value={until} onChange={(e) => setUntil(e.target.value)} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-xs text-[#A0A0A0] focus:outline-none focus:border-[#0C8B44]" />
        </div>

        <div className="relative mb-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by action, actor, target or payload"
            className="w-full pl-9 pr-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
          />
        </div>

        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]">
                <tr>
                  <th className="text-left px-4 py-3 font-normal">When</th>
                  <th className="text-left px-4 py-3 font-normal">Actor</th>
                  <th className="text-left px-4 py-3 font-normal">Action</th>
                  <th className="text-left px-4 py-3 font-normal">Target</th>
                  <th className="text-left px-4 py-3 font-normal">Payload</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-[#737373]">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-[#737373]">{q ? 'No matches.' : 'No audit entries yet.'}</td></tr>
                ) : filtered.map((l) => (
                  <tr key={l.id} className="border-t border-[#ffffff05] align-top hover:bg-[#0C8B44]/5 transition-colors">
                    <td className="px-4 py-3 text-[11px] text-[#737373] whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {l.actor ? (
                        <Link to={`/admin/users/${l.actor.id}`} className="text-[#E5E5E5] hover:text-[#0C8B44]">
                          <p>{l.actor.name}</p>
                          <p className="text-[11px] text-[#737373]">{l.actor.email}</p>
                        </Link>
                      ) : <span className="text-[11px] text-[#737373]">[deleted]</span>}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[11px] px-2 py-0.5 rounded bg-[#0C8B44]/10 text-[#0C8B44]">{l.action}</code>
                    </td>
                    <td className="px-4 py-3">
                      {l.target ? (
                        <Link to={`/admin/users/${l.target.id}`} className="text-[#A0A0A0] hover:text-[#0C8B44]">
                          <p className="text-xs">{l.target.name}</p>
                          <p className="text-[11px] text-[#737373]">{l.target.email}</p>
                        </Link>
                      ) : <span className="text-[11px] text-[#737373]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {l.payload ? (
                        <details className="text-[11px] text-[#A0A0A0] max-w-md">
                          <summary className="cursor-pointer text-[#737373] hover:text-[#E5E5E5]">view</summary>
                          <pre className="mt-2 p-2 bg-[#0a0f11] rounded border border-[#ffffff05] overflow-x-auto whitespace-pre-wrap break-all">{prettyPayload(l.payload)}</pre>
                        </details>
                      ) : <span className="text-[11px] text-[#737373]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11px] text-[#737373] mt-3">Showing {filtered.length} of {logs.length} loaded entries.</p>
      </div>
    </div>
  )
}

function prettyPayload(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}
