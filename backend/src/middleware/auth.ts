import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyToken, getUserFromPayload } from '../lib/jwt.js'
import type { User } from '../types/auth.js'

declare module 'hono' {
  interface ContextVariableMap {
    user: User | null
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const token = getCookie(c, 'auth_token')

  if (!token) {
    c.set('user', null)
    return next()
  }

  const payload = await verifyToken(token)
  if (!payload) {
    c.set('user', null)
    return next()
  }

  c.set('user', getUserFromPayload(payload))
  return next()
}

export async function requireAuth(c: Context, next: Next) {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
}
