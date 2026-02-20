import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { createToken, verifyToken, getUserFromPayload } from '../lib/jwt.js'
import { logger } from '../lib/logger.js'
import type { GoogleUserInfo, User } from '../types/auth.js'

const auth = new Hono()

// productionではbackendがindex.htmlを配信する同一オリジン構成のため相対パスでリダイレクト
// 開発時のみFRONTEND_URLを設定し、Vite dev server (localhost:5173) にリダイレクト
function getFrontendUrl(path: string = '/'): string {
  const base = process.env.FRONTEND_URL
  return base ? `${base}${path}` : path
}

const GOOGLE_CLIENT_ID = process.env.AUTH_GOOGLE_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.AUTH_GOOGLE_SECRET || ''
const ALLOWED_USER_EMAILS = (process.env.ALLOWED_USER_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean)

function getBaseUrl(c: { req: { url: string; header: (name: string) => string | undefined } }): string {
  const url = new URL(c.req.url)
  const proto = c.req.header('x-forwarded-proto') || url.protocol.replace(':', '')
  return `${proto}://${url.host}`
}

auth.get('/signin/google', (c) => {
  const baseUrl = getBaseUrl(c)
  const redirectUri = `${baseUrl}/api/auth/callback/google`

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  })

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

auth.get('/callback/google', async (c) => {
  const code = c.req.query('code')
  const error = c.req.query('error')
  const baseUrl = getBaseUrl(c)

  if (error) {
    logger.error({ 'oauth.step': 'callback', 'oauth.error': error }, 'OAuth error received')
    return c.redirect(getFrontendUrl('/login?error=oauth_error'))
  }

  if (!code) {
    return c.redirect(getFrontendUrl('/login?error=no_code'))
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/callback/google`

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      await tokenResponse.text()
      logger.error({ 'oauth.step': 'token_exchange' }, 'Token exchange failed')
      return c.redirect(getFrontendUrl('/login?error=token_exchange_failed'))
    }

    const tokens = (await tokenResponse.json()) as { access_token: string }

    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    )

    if (!userInfoResponse.ok) {
      logger.error({ 'oauth.step': 'user_info' }, 'Failed to get user info')
      return c.redirect(getFrontendUrl('/login?error=user_info_failed'))
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo

    if (!googleUser.email_verified) {
      logger.warn({ reason: 'email_not_verified' }, 'Authentication rejected')
      return c.redirect(getFrontendUrl('/login?error=email_not_verified'))
    }

    if (
      ALLOWED_USER_EMAILS.length > 0 &&
      !ALLOWED_USER_EMAILS.includes(googleUser.email)
    ) {
      logger.warn({ reason: 'user_not_in_allowed_list' }, 'Authorization rejected')
      return c.redirect(getFrontendUrl('/login?error=not_allowed'))
    }

    const user: User = {
      name: googleUser.name,
      email: googleUser.email,
      image: googleUser.picture,
    }

    const token = await createToken(user)

    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 90 * 24 * 60 * 60,
      path: '/',
    })

    return c.redirect(getFrontendUrl('/'))
  } catch (err) {
    logger.error({ err, 'oauth.step': 'callback' }, 'OAuth callback error')
    return c.redirect(getFrontendUrl('/login?error=callback_failed'))
  }
})

auth.post('/signout', (c) => {
  deleteCookie(c, 'auth_token', {
    path: '/',
  })
  return c.json({ success: true })
})

auth.get('/session', async (c) => {
  const token = getCookie(c, 'auth_token')

  if (!token) {
    return c.json({ user: null })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({ user: null })
  }

  return c.json({ user: getUserFromPayload(payload) })
})

export default auth
