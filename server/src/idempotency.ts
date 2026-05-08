// Stripe-style idempotency for money-mutating endpoints.
//
// Why: every money endpoint here is an `INSERT + balance update` inside a
// Prisma transaction. If the client retries the same request — because of a
// flaky VPN, a double-click, a browser auto-retry, React StrictMode in dev,
// a 502 from the load balancer, etc. — without idempotency the user gets
// charged / transferred TWICE. Real fintechs (Stripe, Plaid, banks)
// require an `Idempotency-Key` header on every mutating call so the server
// can collapse duplicates to a single effect and replay the original
// response. We do the same.
//
// Storage: in-memory LRU + TTL. This is intentionally simple — the keys are
// only used for short-window dedup (default 10 minutes). For a single-node
// deployment (Render free tier, Railway hobby) that's perfect. If/when this
// scales horizontally, swap `IdempotencyStore` for a Redis-backed impl
// with the same `get/set/markPending/finish` interface.
//
// Scope: keys are scoped to (userId, route, method) so two different users
// can independently send the same UUID without collision, and a key for
// /transfer can't replay against /transactions.

import type { Request, Response, NextFunction } from 'express'
import type { AuthedRequest } from './auth.js'

interface CachedResponse {
  status: number
  body: unknown
  /** Hash of the request body so we can refuse a key reuse with a *different* payload. */
  bodyHash: string
  expiresAt: number
}

interface PendingEntry {
  /** Promise that resolves once the original handler finishes. */
  promise: Promise<CachedResponse>
  bodyHash: string
  startedAt: number
}

const TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ENTRIES = 5_000

// Two separate maps because a finished response is just data; a pending
// request has to be awaited so concurrent retries serialize on the same
// in-flight handler instead of racing each other.
const finished = new Map<string, CachedResponse>()
const pending = new Map<string, PendingEntry>()

// Cheap, deterministic body hash. We use this to refuse the case where a
// caller reuses the same Idempotency-Key with different parameters — that
// almost always indicates a client bug and should error loud, not silently
// return the wrong original response.
function hashBody(body: unknown): string {
  try {
    const json = JSON.stringify(body ?? {})
    let h = 0
    for (let i = 0; i < json.length; i++) {
      h = ((h << 5) - h + json.charCodeAt(i)) | 0
    }
    return h.toString(36)
  } catch {
    return '0'
  }
}

function evictExpired(): void {
  const now = Date.now()
  // Cap the work per call: if the map is small, just sweep; otherwise rely
  // on the LRU-ish trim below.
  if (finished.size < 1_000) {
    for (const [k, v] of finished) {
      if (v.expiresAt <= now) finished.delete(k)
    }
  }
  if (finished.size > MAX_ENTRIES) {
    // Drop the oldest ~10% by insertion order (Map iteration is insertion
    // order in JS).
    const drop = Math.ceil(finished.size * 0.1)
    let i = 0
    for (const k of finished.keys()) {
      if (i++ >= drop) break
      finished.delete(k)
    }
  }
  // Pending entries that have been "in flight" for > 60s are almost certainly
  // a crashed handler or a leaked promise; drop them so the next retry can
  // actually execute instead of awaiting forever.
  for (const [k, v] of pending) {
    if (now - v.startedAt > 60_000) pending.delete(k)
  }
}

function keyFor(req: AuthedRequest, headerKey: string): string {
  const userId = req.userId || 'anon'
  // Scope by full URL path + method so the same UUID can't be replayed
  // across different endpoints (e.g. /transfer vs /transactions).
  return `${userId}|${req.method}|${req.baseUrl}${req.path}|${headerKey}`
}

/**
 * Express middleware. If the request carries an `Idempotency-Key` header:
 *   - First time we see it: capture the response, cache it, return as
 *     normal. Subsequent retries within TTL replay the captured response.
 *   - Concurrent retry while the first is still running: await the first
 *     and return its result (no double-charge).
 *   - Replay with a different body: 422, refusing to lie about the result.
 *
 * If the header is absent the middleware is a no-op — the route runs
 * exactly as it did before, so adding the middleware is non-breaking for
 * older clients.
 *
 * MUST be mounted AFTER `requireAuth` so `req.userId` is populated.
 */
export function idempotency() {
  return async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
    const ar = req as AuthedRequest
    const raw = req.header('Idempotency-Key') || req.header('idempotency-key')
    if (!raw) return next()

    // Reject obviously malformed keys early. We accept anything 8\u2013128 chars
    // of safe ASCII so callers can use UUIDv4, ULID, KSUID, hex, etc.
    const headerKey = raw.trim()
    if (!/^[A-Za-z0-9_\-:.]{8,128}$/.test(headerKey)) {
      res.status(400).json({ error: 'Invalid Idempotency-Key (8\u2013128 safe ASCII chars)' })
      return
    }

    evictExpired()
    const key = keyFor(ar, headerKey)
    const bodyHash = hashBody(req.body)

    // Replay path \u2014 finished response in cache.
    const done = finished.get(key)
    if (done) {
      if (done.bodyHash !== bodyHash) {
        res.status(422).json({
          error: 'Idempotency-Key reused with a different request body. Generate a new key for a new operation.',
        })
        return
      }
      res.setHeader('Idempotent-Replay', 'true')
      res.status(done.status).json(done.body)
      return
    }

    // Concurrent retry path \u2014 first request still in flight.
    const inflight = pending.get(key)
    if (inflight) {
      if (inflight.bodyHash !== bodyHash) {
        res.status(422).json({
          error: 'Idempotency-Key reused concurrently with a different request body.',
        })
        return
      }
      try {
        const cached = await inflight.promise
        res.setHeader('Idempotent-Replay', 'true')
        res.status(cached.status).json(cached.body)
      } catch (err) {
        // The original handler crashed; surface a 500 so the client can
        // retry with a NEW idempotency key (the failed one will be evicted
        // by the pending-stale sweep within 60s).
        res.status(500).json({ error: (err as Error).message || 'Original request failed' })
      }
      return
    }

    // First-time path \u2014 register a pending promise BEFORE running the route
    // so concurrent retries serialize correctly.
    let resolveCached: (v: CachedResponse) => void = () => {}
    let rejectCached: (e: unknown) => void = () => {}
    const promise = new Promise<CachedResponse>((resolve, reject) => {
      resolveCached = resolve
      rejectCached = reject
    })
    pending.set(key, { promise, bodyHash, startedAt: Date.now() })

    // Monkey-patch res.status/res.json to capture the outgoing payload.
    // We wrap rather than replace so any other middleware that already
    // hooked these still works.
    const origStatus = res.status.bind(res)
    const origJson = res.json.bind(res)
    let captured: { status: number; body: unknown } = { status: 200, body: null }
    res.status = (code: number) => {
      captured.status = code
      return origStatus(code)
    }
    res.json = (body: unknown) => {
      captured = { status: res.statusCode || captured.status, body }
      // Only cache successful + client-error responses. Don't cache 5xx so
      // a transient server failure doesn't get pinned for 10 minutes \u2014 the
      // client can safely retry with the same key.
      if (captured.status >= 200 && captured.status < 500) {
        const entry: CachedResponse = {
          status: captured.status,
          body,
          bodyHash,
          expiresAt: Date.now() + TTL_MS,
        }
        finished.set(key, entry)
        resolveCached(entry)
      } else {
        rejectCached(new Error(`upstream status ${captured.status}`))
      }
      pending.delete(key)
      return origJson(body)
    }

    // If the response ends without res.json being called (e.g. via res.end
    // or res.sendFile), or if the route throws, we need to release the
    // pending entry so a future retry can execute.
    res.on('close', () => {
      if (pending.has(key)) {
        pending.delete(key)
        rejectCached(new Error('response closed without json body'))
      }
    })

    next()
  }
}

// Test-only hook for unit tests; not used in production code.
export function __resetIdempotencyForTests(): void {
  finished.clear()
  pending.clear()
}
