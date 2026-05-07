import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { prisma } from './db.js'
import { env } from './env.js'

const SECRET = env.JWT_SECRET
const EXPIRES_IN = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']

export interface AuthPayload {
  sub: string
  email: string
  v?: number // tokenVersion at issue time
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, SECRET) as AuthPayload
  } catch {
    return null
  }
}

export type Role = 'user' | 'admin'

export interface AuthedRequest extends Request {
  userId?: string
  userEmail?: string
  userRole?: Role
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Bearer-token only. The cookie path was a half-implemented dual-auth
  // model with no CSRF protection \u2014 strictly worse than Bearer for an
  // SPA. Keep things simple: client sends `Authorization: Bearer <jwt>`.
  const header = req.headers.authorization
  let token: string | undefined
  if (header?.startsWith('Bearer ')) token = header.slice(7)

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }
  // Cheap existence check; cache could be added later.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, suspended: true, tokenVersion: true },
  })
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }
  // tokenVersion lets admins force-revoke all sessions for a user.
  if (typeof payload.v === 'number' && payload.v !== user.tokenVersion) {
    res.status(401).json({ error: 'Session revoked. Please log in again.' })
    return
  }
  if (user.suspended) {
    res.status(403).json({ error: 'Account suspended' })
    return
  }
  req.userId = user.id
  req.userEmail = user.email
  req.userRole = user.role === 'admin' ? 'admin' : 'user'
  next()
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin only' })
    return
  }
  next()
}
