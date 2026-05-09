/**
 * Dashboard density preference. "comfortable" (default) keeps the original
 * paddings; "compact" trims paddings on cards opting-in via .dash-pad-card,
 * .dash-gap, .dash-mb. Toggling writes a class on <html> so CSS handles
 * the rest \u2014 no React re-renders required for already-mounted DOM.
 */
export type Density = 'comfortable' | 'compact'

const KEY = 'verdexis_dashboard_density'

export function getDensity(): Density {
  if (typeof window === 'undefined') return 'comfortable'
  return (localStorage.getItem(KEY) as Density) || 'comfortable'
}

export function setDensity(d: Density): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, d)
  apply(d)
  window.dispatchEvent(new CustomEvent('verdexis:density', { detail: d }))
}

export function toggleDensity(): Density {
  const next: Density = getDensity() === 'compact' ? 'comfortable' : 'compact'
  setDensity(next)
  return next
}

function apply(d: Density) {
  const cl = document.documentElement.classList
  if (d === 'compact') cl.add('density-compact')
  else cl.remove('density-compact')
}

/** Call once on app boot so the saved preference applies before paint. */
export function hydrateDensity(): void {
  apply(getDensity())
}
