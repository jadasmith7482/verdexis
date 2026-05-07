import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { Lock, ArrowLeft, CheckCircle } from 'lucide-react'
import { api, type ApiError } from '../lib/api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) toast.error('Missing reset token in URL')
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await api.reset(token, password)
      setDone(true)
      toast.success('Password reset — you can sign in now')
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      const e = err as ApiError
      toast.error(e.error || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070C0E] flex items-center justify-center px-6">
      <Toaster position="top-right" theme="dark" richColors />
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#737373] hover:text-[#E5E5E5] mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to home
        </Link>
        <div className="rounded-2xl bg-[#0f1619]/50 border border-[#ffffff08] p-8">
          {done ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-[#0C8B44] mx-auto mb-4" />
              <h1 className="text-2xl font-light text-[#E5E5E5] mb-2">Password reset</h1>
              <p className="text-sm text-[#A0A0A0]">Redirecting you home…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-[#0C8B44]" />
                </div>
                <div>
                  <h1 className="text-xl font-light text-[#E5E5E5]">Reset your password</h1>
                  <p className="text-xs text-[#737373]">Enter a new password for your account.</p>
                </div>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-[0.05em] text-[#737373] mb-2">New password</label>
                  <input
                    type="password"
                    aria-label="New password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2.5 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]/40"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-[0.05em] text-[#737373] mb-2">Confirm password</label>
                  <input
                    type="password"
                    aria-label="Confirm new password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-3 py-2.5 text-sm bg-[#0a0f11] border border-[#ffffff10] rounded-lg text-[#E5E5E5] focus:outline-none focus:border-[#0C8B44]/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full py-3 bg-[#0C8B44] text-white text-sm font-medium uppercase tracking-[0.04em] rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
