import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import CookieBanner from './components/CookieBanner'
import OfflineToast from './components/OfflineToast'
import RequireAuth from './components/RequireAuth'
import { Toaster } from 'sonner'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Trading = lazy(() => import('./pages/Trading'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Wallet = lazy(() => import('./pages/Wallet'))
const News = lazy(() => import('./pages/News'))
const Settings = lazy(() => import('./pages/Settings'))
const Legal = lazy(() => import('./pages/Legal'))
const About = lazy(() => import('./pages/About'))
const NotFound = lazy(() => import('./pages/NotFound'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/ai" element={<RequireAuth><AIAssistant /></RequireAuth>} />
          <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
          <Route path="/news" element={<News />} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/about" element={<About />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <CookieBanner />
      <OfflineToast />
      <Toaster position="top-right" theme="dark" richColors />
    </>
  )
}
