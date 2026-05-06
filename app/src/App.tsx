import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

const Home = lazy(() => import('./pages/Home'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Trading = lazy(() => import('./pages/Trading'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Wallet = lazy(() => import('./pages/Wallet'))
const News = lazy(() => import('./pages/News'))

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#070C0E] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/news" element={<News />} />
      </Routes>
    </Suspense>
  )
}
