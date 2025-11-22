'use client'
import { useSession, signIn, signOut } from "next-auth/react"

export default function Login() {
  const { data: session } = useSession();
  return session ?
    (<button onClick={() => signOut()}>Sign out</button>)
    :
    (<button onClick={() => signIn()}>Sign in</button>)
}
