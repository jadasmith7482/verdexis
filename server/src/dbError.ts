export function isDbUnavailableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  const code = (err as { code?: string }).code
  if (typeof code === 'string' && /^(P1000|P1001|P1008|P1010|P1011|P1024)$/i.test(code)) {
    return true
  }

  const msg = err.message
  return /(?:connection.*refused|connection.*reset|timeout|timed out|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|EPIPE|could not connect|database.*unavailable|access denied|authentication failed)/i.test(msg)
}
