import { useEffect, useState, useCallback } from 'react'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'

type Status = 'up' | 'degraded' | 'down' | 'checking'

interface Check {
  id: string
  name: string
  description: string
  url: string
  category: 'core' | 'market' | 'ai'
  status: Status
  latencyMs?: number
  lastChecked?: number
  error?: string
}

const INITIAL_CHECKS: Omit<Check, 'status'>[] = [
  { id: 'app', name: 'Web Application', description: 'Vite-served frontend bundle', url: '/', category: 'core' },
  { id: 'api', name: 'API · Health', description: 'Express + Prisma backend', url: '/api/health', category: 'core' },
  { id: 'auth', name: 'Auth · Session', description: 'JWT session endpoint', url: '/api/auth/me', category: 'core' },
  { id: 'admin', name: 'Admin · Stats', description: 'Operator console data feed', url: '/api/admin/stats', category: 'core' },
  { id: 'market', name: 'Market · Quotes', description: 'Internal market quote proxy', url: '/api/market/quote?symbol=BTC', category: 'market' },
  { id: 'coingecko', name: 'CoinGecko', description: 'Crypto market data feed', url: 'https://api.coingecko.com/api/v3/ping', category: 'market' },
  { id: 'binance', name: 'Binance', description: 'Live crypto price stream', url: 'https://api.binance.com/api/v3/ping', category: 'market' },
  { id: 'finnhub', name: 'Finnhub', description: 'Stocks & equities feed', url: 'https://finnhub.io/api/v1/quote?symbol=AAPL', category: 'market' },
  { id: 'ai', name: 'AI · Assistant', description: 'In-house assistant endpoint', url: '/api/ai/health', category: 'ai' },
]

async function probe(url: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = performance.now()
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    // Use no-cors for cross-origin so we at least know the network reaches the host.
    const isCrossOrigin = url.startsWith('http')
    const res = await fetch(url, {
      method: 'GET',
      mode: isCrossOrigin ? 'no-cors' : 'cors',
      signal: ctrl.signal,
      cache: 'no-store',
    })
    clearTimeout(t)
    const latencyMs = Math.round(performance.now() - start)
    // no-cors gives opaque response; treat any successful network round-trip as up
    if (isCrossOrigin) return { ok: true, latencyMs }
    // Same-origin: server reachable for any status < 500. 401/403 just mean the
    // probe wasn't authorized — the backend itself is alive, which is what we
    // want to report on the system status page.
    const reachable = res.status < 500
    return { ok: reachable, latencyMs, error: reachable ? undefined : `HTTP ${res.status}` }
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start)
    return { ok: false, latencyMs, error: e instanceof Error ? e.message : 'Network error' }
  }
}

function statusFromLatency(ok: boolean, latencyMs: number): Status {
  if (!ok) return 'down'
  if (latencyMs > 2500) return 'degraded'
  return 'up'
}

const STATUS_META: Record<Status, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  up:        { label: 'Operational',       color: 'text-[#4CAF50]', bg: 'bg-[#4CAF50]/15', icon: CheckCircle2 },
  degraded:  { label: 'Degraded',          color: 'text-amber-400', bg: 'bg-amber-400/15', icon: AlertTriangle },
  down:      { label: 'Outage',            color: 'text-red-400',   bg: 'bg-red-400/15',   icon: XCircle },
  checking:  { label: 'Checking…',         color: 'text-[#A0A0A0]', bg: 'bg-[#ffffff08]',  icon: RefreshCw },
}

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>(
    INITIAL_CHECKS.map((c) => ({ ...c, status: 'checking' as Status })),
  )
  const [running, setRunning] = useState(false)
  const [backend, setBackend] = useState<{ version?: string; env?: string; uptimeSec?: number; nodeVersion?: string; bootedAt?: string } | null>(null)

  const runAll = useCallback(async () => {
    setRunning(true)
    setChecks((prev) => prev.map((c) => ({ ...c, status: 'checking' as Status })))
    const results = await Promise.all(
      INITIAL_CHECKS.map(async (c) => {
        const r = await probe(c.url)
        return {
          ...c,
          status: statusFromLatency(r.ok, r.latencyMs),
          latencyMs: r.latencyMs,
          lastChecked: Date.now(),
          error: r.error,
        } as Check
      }),
    )
    setChecks(results)
    setRunning(false)
    // Fetch backend metadata in parallel — best effort, no fatal handling.
    try {
      const r = await fetch('/api/health', { cache: 'no-store' })
      if (r.ok) setBackend(await r.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const kickoff = setTimeout(() => { void runAll() }, 0)
    const id = setInterval(runAll, 60_000) // re-check every minute
    return () => {
      clearTimeout(kickoff)
      clearInterval(id)
    }
  }, [runAll])

  const overall: Status = checks.some((c) => c.status === 'down')
    ? 'down'
    : checks.some((c) => c.status === 'degraded')
      ? 'degraded'
      : checks.every((c) => c.status === 'up')
        ? 'up'
        : 'checking'

  const headline =
    overall === 'up' ? 'All systems operational' :
    overall === 'degraded' ? 'Some systems degraded' :
    overall === 'down' ? 'Active outage detected' :
    'Running checks…'

  const lastUpdated = Math.max(0, ...checks.map((c) => c.lastChecked ?? 0))

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[920px] mx-auto">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.05em] text-[#0C8B44] mb-3">
              <Activity className="w-3 h-3" /> Admin · System Status
            </div>
            <h1 className="text-4xl md:text-5xl font-light tracking-[-0.03em] text-[#E5E5E5] mb-4">{headline}</h1>
            <p className="text-sm text-[#A0A0A0]">
              Live operator probes against Verdexis core services, internal APIs, and upstream market data feeds. Re-runs every 60 seconds from your browser.
            </p>
          </div>

          {/* Overall status banner */}
          <div className={`rounded-2xl border p-5 mb-8 flex items-center justify-between gap-4 ${
            overall === 'up' ? 'bg-[#4CAF50]/5 border-[#4CAF50]/30' :
            overall === 'degraded' ? 'bg-amber-400/5 border-amber-400/30' :
            overall === 'down' ? 'bg-red-400/5 border-red-400/30' :
            'bg-[#0f1619] border-[#ffffff10]'
          }`}>
            <div className="flex items-center gap-3">
              <StatusDot status={overall} />
              <div>
                <p className="text-sm font-medium text-[#E5E5E5]">{headline}</p>
                <p className="text-xs text-[#737373] mt-0.5">
                  {lastUpdated ? `Last updated ${formatRelative(lastUpdated)}` : 'Initialising…'}
                </p>
              </div>
            </div>
            <button
              onClick={runAll}
              disabled={running}
              className="flex items-center gap-2 px-3 py-2 text-xs text-[#E5E5E5] bg-[#1a1a1a] border border-[#ffffff10] rounded-lg hover:border-[#0C8B44]/40 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Running' : 'Re-run'}
            </button>
          </div>

          {/* Backend metadata (admin-only context) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <InfoCard label="Service" value={backend ? 'verdexis-api' : '—'} />
            <InfoCard label="Version" value={backend?.version ?? '—'} />
            <InfoCard label="Environment" value={backend?.env ?? '—'} />
            <InfoCard label="Uptime" value={backend?.uptimeSec !== undefined ? formatUptime(backend.uptimeSec) : '—'} />
            <InfoCard label="Node" value={backend?.nodeVersion ?? '—'} />
            <InfoCard label="Booted" value={backend?.bootedAt ? new Date(backend.bootedAt).toLocaleString() : '—'} />
            <InfoCard label="Probes" value={`${checks.length} endpoints`} />
            <InfoCard label="Re-run interval" value="60s" />
          </div>

          {/* Grouped checks */}
          {(['core', 'market', 'ai'] as const).map((cat) => {
            const items = checks.filter((c) => c.category === cat)
            if (items.length === 0) return null
            return (
              <div key={cat} className="mb-8">
                <h2 className="text-xs uppercase tracking-[0.05em] text-[#737373] mb-3">
                  {cat === 'core' ? 'Core Platform' : cat === 'market' ? 'Market Data' : 'AI Services'}
                </h2>
                <div className="rounded-2xl border border-[#ffffff10] divide-y divide-[#ffffff08] overflow-hidden">
                  {items.map((c) => (
                    <CheckRow key={c.id} check={c} />
                  ))}
                </div>
              </div>
            )
          })}

          <p className="text-[11px] text-[#737373] text-center mt-12">
            Status checks run client-side from the operator&rsquo;s browser. Backend metadata pulled from <code className="text-[#0C8B44]">/api/health</code>.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function StatusDot({ status }: { status: Status }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${meta.bg}`}>
      <meta.icon className={`w-4 h-4 ${meta.color} ${status === 'checking' ? 'animate-spin' : ''}`} />
    </span>
  )
}

function CheckRow({ check }: { check: Check }) {
  const meta = STATUS_META[check.status]
  return (
    <div className="flex items-center justify-between gap-4 px-4 sm:px-5 py-4 bg-[#0f1619]/50">
      <div className="flex items-center gap-3 min-w-0">
        <StatusDot status={check.status} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#E5E5E5] truncate">{check.name}</p>
          <p className="text-xs text-[#737373] truncate">{check.description}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-xs font-medium ${meta.color}`}>{meta.label}</p>
        {check.latencyMs !== undefined && (
          <p className="text-[11px] text-[#737373] mt-0.5">{check.latencyMs} ms</p>
        )}
      </div>
    </div>
  )
}

function formatRelative(ts: number) {
  const diff = Math.max(0, Date.now() - ts)
  if (diff < 5_000) return 'just now'
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  return `${Math.round(diff / 60_000)}m ago`
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff10] p-4">
      <p className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-2">{label}</p>
      <p className="text-sm text-[#E5E5E5] truncate" title={value}>{value}</p>
    </div>
  )
}
