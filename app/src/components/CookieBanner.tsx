import { useEffect, useState } from 'react'
import { Cookie } from 'lucide-react'
import { onConsentAccepted } from '../lib/telemetry'

const KEY = 'verdexis_cookie_consent'

export default function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) {
        const t = setTimeout(() => setShow(true), 800)
        return () => clearTimeout(t)
      }
    } catch { /* ignore */ }
  }, [])

  const accept = (value: 'accept' | 'reject') => {
    try { localStorage.setItem(KEY, value) } catch { /* ignore */ }
    if (value === 'accept') onConsentAccepted()
    setShow(false)
  }

  if (!show) return null
  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm z-50">
      <div className="rounded-2xl bg-[#0f1619] border border-[#ffffff10] shadow-2xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#0C8B44]/15 flex items-center justify-center shrink-0">
            <Cookie className="w-4 h-4 text-[#0C8B44]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#E5E5E5]">We use cookies</p>
            <p className="text-xs text-[#A0A0A0] mt-1 leading-relaxed">
              We use only essential cookies to keep you signed in and remember your settings. No tracking, no ads.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => accept('reject')}
            className="flex-1 py-2 text-xs font-medium text-[#A0A0A0] border border-[#ffffff10] rounded-lg hover:border-[#ffffff25] transition-colors"
          >Reject</button>
          <button
            onClick={() => accept('accept')}
            className="flex-1 py-2 text-xs font-medium text-white bg-[#0C8B44] rounded-lg hover:bg-[#0a7539] transition-colors"
          >Accept</button>
        </div>
      </div>
    </div>
  )
}
