import { sign, verify } from 'hono/jwt'
import type { JwtPayload, User } from '../types/auth.js'

const JWT_SECRET = process.env.AUTH_SECRET || 'development-secret'
const JWT_EXPIRY_DAYS = 90
const JWT_ALGORITHM = 'HS256'

export async function createToken(user: User): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: user.email,
    name: user.name,
    email: user.email,
    image: user.image,
    iat: now,
    exp: now + JWT_EXPIRY_DAYS * 24 * 60 * 60,
  }
  return await sign(payload, JWT_SECRET, JWT_ALGORITHM)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET, JWT_ALGORITHM)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export function getUserFromPayload(payload: JwtPayload): User {
  return {
    name: payload.name,
    email: payload.email,
    image: payload.image,
  }
}
