import { Hono } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { createToken, verifyToken, getUserFromPayload } from '../lib/jwt.js'
import type { GoogleUserInfo, User } from '../types/auth.js'

const auth = new Hono()

// 開発時はFRONTEND_URLでVite dev serverにリダイレクトする
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
    console.error('OAuth error:', error)
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
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
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
      console.error('Failed to get user info')
      return c.redirect(getFrontendUrl('/login?error=user_info_failed'))
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo

    if (!googleUser.email_verified) {
      console.log('Email not verified:', googleUser.email)
      return c.redirect(getFrontendUrl('/login?error=email_not_verified'))
    }

    if (
      ALLOWED_USER_EMAILS.length > 0 &&
      !ALLOWED_USER_EMAILS.includes(googleUser.email)
    ) {
      console.log('User not in allowed list:', googleUser.email)
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
    console.error('OAuth callback error:', err)
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
