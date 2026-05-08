import { useEffect } from 'react'

/**
 * Sets `document.title` for the lifetime of the calling component, restoring
 * the previous title on unmount. Pass a page-specific label and we suffix the
 * brand name so browser tabs read e.g. "Dashboard · Verdexis".
 *
 * Pass `null` or an empty string to leave the existing title alone (useful
 * while data is still loading).
 */
const BRAND = 'Verdexis'

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} · ${BRAND}`
    return () => {
      document.title = previous
    }
  }, [title])
}
