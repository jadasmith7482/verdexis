import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { prisma } from './db.js'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn']

export interface AuthPayload {
  sub: string
  email: string
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

export interface AuthedRequest extends Request {
  userId?: string
  userEmail?: string
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  let token: string | undefined
  if (header?.startsWith('Bearer ')) token = header.slice(7)
  if (!token && req.cookies?.verdexis_token) token = req.cookies.verdexis_token

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
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true } })
  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }
  req.userId = user.id
  req.userEmail = user.email
  next()
}
