'use client'
import { Session } from '@/auth'
import { signIn, signOut } from "next-auth/react"

interface LoginProps {
  session: Session | null
}

export default function Login({ session }: LoginProps) {
  if (session) {
    return <button onClick={() => signOut()}>Sign out</button>
  }
  return <button onClick={() => signIn()}>Sign in</button>
}
