import { Navigate, useLocation } from 'react-router-dom'
import { getToken } from '../lib/api'

/**
 * Wraps a route element. Redirects to '/' if no auth token AND no demo session
 * (verdexis_holdings localStorage key) is present. The latter keeps the existing
 * demo-mode UX working when the backend is offline.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hasToken = !!getToken()
  const hasAuth = !!localStorage.getItem('verdexis_auth')
  if (!(hasToken || hasAuth)) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
