export interface User {
  name: string | null
  email: string
  image: string | null
}

export interface JwtPayload {
  sub: string
  name: string | null
  email: string
  image: string | null
  iat: number
  exp: number
}

export interface GoogleUserInfo {
  sub: string
  name: string
  email: string
  email_verified: boolean
  picture: string
}
