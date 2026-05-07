import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import Navigation from '../components/Navigation'
import { adminApi, type AdminUserSummary } from '../lib/adminApi'
import { Search, ShieldCheck, Ban, ArrowLeft, ChevronLeft, ChevronRight, UserPlus, X } from 'lucide-react'

const PAGE_SIZE = 25

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [role, setRole] = useState<'user' | 'admin' | 'all'>('all')
  const [suspended, setSuspended] = useState<'true' | 'false' | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function load() {
    setLoading(true)
    adminApi.listUsers({ q, page, limit: PAGE_SIZE, role, suspended })
      .then((r) => { setUsers(r.users); setTotal(r.total) })
      .catch((e: { error?: string }) => toast.error(e.error || 'Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, role, suspended])

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    load()
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link to="/admin" className="inline-flex items-center gap-2 text-xs text-[#A0A0A0] hover:text-[#0C8B44] mb-4">
          <ArrowLeft className="w-4 h-4" />Back to admin
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-light text-[#E5E5E5]">Users</h1>
            <p className="text-xs text-[#737373]">{total.toLocaleString()} total · page {page} of {totalPages}</p>
          </div>
          <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] transition-colors">
            <UserPlus className="w-4 h-4" />Add user
          </button>
        </div>

        {/* Filters */}
        <form onSubmit={onSearch} className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email, name, or ID"
              className="w-full pl-9 pr-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]"
            />
          </div>
          <select aria-label="Role filter" value={role} onChange={(e) => { setRole(e.target.value as typeof role); setPage(1) }} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]">
            <option value="all">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select aria-label="Status filter" value={suspended} onChange={(e) => { setSuspended(e.target.value as typeof suspended); setPage(1) }} className="px-3 py-2 bg-[#0f1619] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]">
            <option value="all">All status</option>
            <option value="false">Active only</option>
            <option value="true">Suspended only</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] transition-colors">Search</button>
        </form>

        {/* Table */}
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a1a]/40 text-[10px] uppercase tracking-[0.05em] text-[#737373]">
                <tr>
                  <th className="text-left px-4 py-3 font-normal">User</th>
                  <th className="text-left px-4 py-3 font-normal">Role</th>
                  <th className="text-left px-4 py-3 font-normal">Status</th>
                  <th className="text-right px-4 py-3 font-normal">Holdings</th>
                  <th className="text-right px-4 py-3 font-normal">Trades</th>
                  <th className="text-right px-4 py-3 font-normal">Tx</th>
                  <th className="text-right px-4 py-3 font-normal">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-[#737373]">Loading…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-[#737373]">No users found.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="border-t border-[#ffffff05] hover:bg-[#0C8B44]/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[#E5E5E5]">{u.name}</p>
                      <p className="text-[11px] text-[#737373]">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-2 py-0.5 rounded"><ShieldCheck className="w-3 h-3" />Admin</span>
                      ) : (
                        <span className="text-[11px] text-[#A0A0A0]">User</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.suspended ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#f44336] bg-[#f44336]/10 px-2 py-0.5 rounded"><Ban className="w-3 h-3" />Suspended</span>
                      ) : (
                        <span className="text-[11px] text-[#4CAF50]">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#A0A0A0]">{u._count.holdings}</td>
                    <td className="px-4 py-3 text-right text-[#A0A0A0]">{u._count.trades}</td>
                    <td className="px-4 py-3 text-right text-[#A0A0A0]">{u._count.transactions}</td>
                    <td className="px-4 py-3 text-right text-[11px] text-[#737373]">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/users/${u.id}`} className="px-3 py-1.5 text-xs text-[#0C8B44] hover:bg-[#0C8B44]/10 rounded-lg transition-colors">Manage →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-xs text-[#A0A0A0]">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0f1619] border border-[#ffffff10] rounded-lg disabled:opacity-40 hover:border-[#0C8B44]/40">
            <ChevronLeft className="w-4 h-4" />Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0f1619] border border-[#ffffff10] rounded-lg disabled:opacity-40 hover:border-[#0C8B44]/40">
            Next<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); setPage(1); load() }} />}
    </div>
  )
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [initialUsdBalance, setInitialUsdBalance] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !name.trim() || password.length < 8) {
      toast.error('Email, name and an 8+ char password are required')
      return
    }
    setSubmitting(true)
    try {
      const initial = parseFloat(initialUsdBalance)
      await adminApi.createUser({
        email: email.trim(),
        name: name.trim(),
        password,
        role,
        initialUsdBalance: isFinite(initial) && initial > 0 ? initial : undefined,
      })
      toast.success(`Created ${email}`)
      onCreated()
    } catch (err) {
      toast.error((err as { error?: string }).error || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-[#0f1619] border border-[#ffffff10] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-light text-[#E5E5E5]">Create user</h2>
          <button onClick={onClose} aria-label="Close" className="text-[#737373] hover:text-[#E5E5E5]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email"><input autoFocus type="email" required placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" /></Field>
          <Field label="Name"><input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" /></Field>
          <Field label="Initial password (8+ chars)"><input type="text" required minLength={8} placeholder="Initial password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Role">
              <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')} className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Opening USD balance (optional)">
              <input type="number" min="0" step="0.01" value={initialUsdBalance} onChange={(e) => setInitialUsdBalance(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]" />
            </Field>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#ffffff10] text-sm text-[#A0A0A0] rounded-lg hover:border-[#ffffff20]">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#0C8B44] text-white text-sm rounded-lg hover:bg-[#0a7539] disabled:opacity-50"><UserPlus className="w-4 h-4" />{submitting ? 'Creating…' : 'Create user'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.05em] text-[#737373] mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}
