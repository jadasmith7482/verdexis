import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../lib/api'

/**
 * Wraps a route element. Redirects to '/' if no auth token AND no demo session
 * (verdexis_holdings localStorage key) is present. The latter keeps the existing
 * demo-mode UX working when the backend is offline.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [check, setCheck] = useState<'pending' | 'ok' | 'redirect'>('pending')

  useEffect(() => {
    const hasToken = !!getToken()
    const hasDemo = !!localStorage.getItem('verdexis_holdings')
    setCheck(hasToken || hasDemo ? 'ok' : 'redirect')
  }, [])

  if (check === 'pending') {
    return (
      <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (check === 'redirect') {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
