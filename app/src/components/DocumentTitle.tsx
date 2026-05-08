import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'

/**
 * Centralised <title> management. Maps each route path to a human label and
 * sets `document.title` whenever the location changes. Dynamic routes
 * (`/asset/:id`, `/admin/users/:id`) resolve to a generic label rather than
 * leaking ids into the tab title — the page itself can override later.
 */
const ROUTE_TITLES: Record<string, string> = {
  '/': 'AI-Powered Trading & Portfolio Management',
  '/dashboard': 'Dashboard',
  '/trading': 'Trade',
  '/ai': 'AI Analyst',
  '/wallet': 'Wallet',
  '/activity': 'Activity',
  '/news': 'Market News',
  '/settings': 'Settings',
  '/alerts': 'Price Alerts',
  '/goals': 'Goals',
  '/legal': 'Legal',
  '/about': 'About',
  '/status': 'System Status',
  '/disclosures': 'Risk Disclosures',
  '/reset': 'Reset Password',
  '/admin': 'Admin Console',
  '/admin/users': 'Admin · Users',
  '/admin/audit': 'Admin · Audit Log',
  '/admin/transfer': 'Admin · Transfer Funds',
  '/admin/broadcast': 'Admin · Broadcast',
  '/admin/deposits': 'Admin · Deposits',
}

const BRAND = 'Verdexis'

function resolveTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  // Dynamic segments — strip the trailing id and look up the parent.
  if (pathname.startsWith('/asset/') || pathname.startsWith('/coin/')) return 'Market'
  if (pathname.startsWith('/admin/users/')) return 'Admin · User Detail'
  return BRAND
}

export default function DocumentTitle() {
  const { pathname } = useLocation()
  // Pull the dynamic id (if any) so /asset/bitcoin reads "BITCOIN · Verdexis"
  // before the page hydrates.
  const params = useParams()
  useEffect(() => {
    const base = resolveTitle(pathname)
    const idHint = (params as Record<string, string | undefined>).id
    const label = idHint && (pathname.startsWith('/asset/') || pathname.startsWith('/coin/'))
      ? `${idHint.toUpperCase()} · Market`
      : base
    document.title = label === BRAND ? BRAND : `${label} · ${BRAND}`
  }, [pathname, params])
  return null
}
