// Lightweight "new build available" notifier.
//
// Compares the build id baked into the bundle (via Vite `define`) against
// /version.json on the server. When they differ we surface a toast that
// reloads with a cache-busting query so iOS Safari (which loves to keep a
// stale index.html) actually picks up the new build.

import { toast } from 'sonner'

declare const __BUILD_ID__: string

const CURRENT = (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev')
let promptShown = false

async function checkOnce(): Promise<void> {
  if (promptShown) return
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    })
    if (!res.ok) return
    const { id } = (await res.json()) as { id?: string }
    if (!id || id === CURRENT) return
    promptShown = true
    toast('A new version is available', {
      description: 'Reload to get the latest changes.',
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => {
          // Cache-bust the document itself so Safari refetches index.html.
          const url = new URL(window.location.href)
          url.searchParams.set('v', id)
          window.location.replace(url.toString())
        },
      },
    })
  } catch {
    // Network blip — try again on the next tick.
  }
}

export function initUpdatePrompt(): void {
  if (typeof window === 'undefined') return
  // Initial check after first paint so it doesn't compete with hydration.
  setTimeout(() => { void checkOnce() }, 4000)
  // Re-check every 2 minutes and whenever the tab regains focus.
  setInterval(() => { void checkOnce() }, 120_000)
  window.addEventListener('focus', () => { void checkOnce() })
}
