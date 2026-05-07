/**
 * Privacy-respecting analytics + error reporting.
 *
 * - Loads Plausible only when:
 *     (a) the user has ACCEPTED cookies, AND
 *     (b) VITE_PLAUSIBLE_DOMAIN is configured at build time.
 *   With no DSN configured this is a no-op — perfect for self-hosted/dev.
 *
 * - Reports unhandled errors to a Sentry-compatible endpoint when
 *   VITE_SENTRY_DSN is set AND the user accepted cookies.
 *   Falls back to console-only when not configured.
 */

const CONSENT_KEY = 'verdexis_cookie_consent'

function consented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accept'
  } catch {
    return false
  }
}

let analyticsLoaded = false

export function initAnalytics() {
  if (analyticsLoaded) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!consented()) return

  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined
  const src = (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) || 'https://plausible.io/js/script.js'

  if (!domain) return // no-op when DSN not configured

  const s = document.createElement('script')
  s.defer = true
  s.setAttribute('data-domain', domain)
  s.src = src
  document.head.appendChild(s)
  analyticsLoaded = true
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (!consented()) return
  // @ts-expect-error plausible global injected by script
  if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
    // @ts-expect-error plausible global injected by script
    window.plausible(name, { props })
  }
}

let errorsWired = false

export function initErrorReporting() {
  if (errorsWired) return
  if (typeof window === 'undefined') return
  errorsWired = true

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

  const handler = (event: ErrorEvent | PromiseRejectionEvent) => {
    const isRejection = 'reason' in event
    const err = isRejection ? (event as PromiseRejectionEvent).reason : (event as ErrorEvent).error
    const message = err instanceof Error ? err.message : String(err ?? 'unknown')
    const stack = err instanceof Error ? err.stack : undefined

    // Always log locally
    // eslint-disable-next-line no-console
    console.error('[verdexis]', isRejection ? 'unhandled rejection' : 'uncaught error', err)

    // Only send remotely if user consented AND a DSN is configured
    if (!consented() || !dsn) return

    try {
      const payload = {
        message,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        ts: Date.now(),
        kind: isRejection ? 'unhandledrejection' : 'error',
      }
      // Use sendBeacon when possible so we don't block unload
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      if (navigator.sendBeacon) navigator.sendBeacon(dsn, blob)
      else fetch(dsn, { method: 'POST', body: blob, keepalive: true }).catch(() => { /* noop */ })
    } catch { /* noop */ }
  }

  window.addEventListener('error', handler)
  window.addEventListener('unhandledrejection', handler)
}

/** Call this when the user clicks "Accept" in the cookie banner. */
export function onConsentAccepted() {
  initAnalytics()
  // initErrorReporting was already wired at boot; it just starts uploading now.
}
