import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import DocumentTitle from './components/DocumentTitle'
import CookieBanner from './components/CookieBanner'
import OfflineToast from './components/OfflineToast'
import WhatsAppFab from './components/WhatsAppFab'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import CommandPalette from './components/CommandPalette'
import ErrorBoundary from './components/ErrorBoundary'
import AlertChecker from './components/AlertChecker'
import { Toaster } from 'sonner'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Trading = lazy(() => import('./pages/Trading'))
const Markets = lazy(() => import('./pages/Markets'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Wallet = lazy(() => import('./pages/Wallet'))
const News = lazy(() => import('./pages/News'))
const Settings = lazy(() => import('./pages/Settings'))
const Legal = lazy(() => import('./pages/Legal'))
const About = lazy(() => import('./pages/About'))
const NotFound = lazy(() => import('./pages/NotFound'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Goals = lazy(() => import('./pages/Goals'))
const StatusPage = lazy(() => import('./pages/Status'))
const Disclosures = lazy(() => import('./pages/Disclosures'))
const Help = lazy(() => import('./pages/Help'))
const AssetDetail = lazy(() => import('./pages/AssetDetail'))
const Activity = lazy(() => import('./pages/Activity'))
const AdminDeposits = lazy(() => import('./pages/AdminDeposits'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminUserDetail = lazy(() => import('./pages/AdminUserDetail'))
const AdminAudit = lazy(() => import('./pages/AdminAudit'))
const AdminTransfer = lazy(() => import('./pages/AdminTransfer'))
const AdminBroadcast = lazy(() => import('./pages/AdminBroadcast'))

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <DocumentTitle />
      <Suspense fallback={<PageFallback />}>
        <RoutedPages />
      </Suspense>
      <CommandPalette />
      <CookieBanner />
      <OfflineToast />
      <AlertChecker />
      <WhatsAppFab />
      <Toaster position="top-right" theme="dark" richColors />
    </ErrorBoundary>
  )
}

// Keyed wrapper so navigating between routes triggers the page-fade-in
// animation defined in index.css. Pure presentational polish — no state.
function RoutedPages() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-fade-in">
      <ErrorBoundary resetKey={location.pathname} scope="this page">
      <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/ai" element={<RequireAuth><AIAssistant /></RequireAuth>} />
          <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
          <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
          <Route path="/news" element={<News />} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
          <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin/status" element={<RequireAdmin><StatusPage /></RequireAdmin>} />
          <Route path="/disclosures" element={<Disclosures />} />
          <Route path="/help" element={<Help />} />
          <Route path="/asset/:id" element={<AssetDetail />} />
          <Route path="/coin/:id" element={<AssetDetail />} />
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
          <Route path="/admin/users/:id" element={<RequireAdmin><AdminUserDetail /></RequireAdmin>} />
          <Route path="/admin/audit" element={<RequireAdmin><AdminAudit /></RequireAdmin>} />
          <Route path="/admin/transfer" element={<RequireAdmin><AdminTransfer /></RequireAdmin>} />
          <Route path="/admin/broadcast" element={<RequireAdmin><AdminBroadcast /></RequireAdmin>} />
          <Route path="/admin/deposits" element={<RequireAdmin><AdminDeposits /></RequireAdmin>} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
      </div>
  )
}
