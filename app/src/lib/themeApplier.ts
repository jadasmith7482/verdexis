// Applies the user's chosen theme as a `data-theme` attribute on <html>.
// The app currently ships dark-first; this attribute is the hook future
// CSS can target to implement additional themes.

type Theme = 'dark' | 'light' | 'auto'

const PREFS_KEY = 'verdexis_prefs'

function readTheme(): Theme {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return 'dark'
    const parsed = JSON.parse(raw)
    return (parsed.theme as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

function resolve(theme: Theme): 'dark' | 'light' {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return theme
}

export function applyTheme(theme: Theme = readTheme()) {
  const resolved = resolve(theme)
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
}

export function initTheme() {
  applyTheme()
  // Re-apply when prefs change in this tab or another tab.
  window.addEventListener('storage', (e) => {
    if (e.key === PREFS_KEY) applyTheme()
  })
  window.addEventListener('verdexis:prefs', () => applyTheme())
  // React to system changes when on auto.
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  mq.addEventListener('change', () => {
    if (readTheme() === 'auto') applyTheme()
  })
}
