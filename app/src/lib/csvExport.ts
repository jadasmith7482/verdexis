// Tiny CSV builder + browser download helper. Used by the dashboard
// export menu to dump trades / holdings / transactions for tax/record use.

function csvEscape(v: unknown): string {
  if (v == null) return ''
  let s = String(v)
  // CSV “formula injection” defence: cells that begin with =, +, -, @ or a
  // leading tab/CR are interpreted as a formula by Excel/Google Sheets and
  // can be used to exfiltrate data or run shell commands when the file is
  // opened. Prefix a single quote so the cell renders as plain text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], headers?: (keyof T)[]): string {
  if (!rows.length) return ''
  const cols = (headers ?? (Object.keys(rows[0]) as (keyof T)[]))
  const head = cols.map((c) => csvEscape(String(c))).join(',')
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(',')).join('\n')
  return `${head}\n${body}`
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
