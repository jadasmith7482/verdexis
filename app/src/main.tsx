import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initTheme } from './lib/themeApplier'
import { initAnalytics, initErrorReporting } from './lib/telemetry'
import { CurrencyProvider } from './lib/currencyContext'

initTheme()
initErrorReporting()
initAnalytics() // no-op unless cookies accepted AND VITE_PLAUSIBLE_DOMAIN set

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </BrowserRouter>
  </StrictMode>,
)
