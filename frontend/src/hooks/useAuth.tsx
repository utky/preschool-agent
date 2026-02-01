import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiGet } from '@/lib/api'

interface User {
  name: string | null
  email: string | null
  image: string | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface SessionResponse {
  user: User | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const session = await apiGet<SessionResponse>('/api/auth/session')
        setUser(session.user)
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    fetchSession()
  }, [])

  const signIn = () => {
    window.location.href = '/api/auth/signin/google'
  }

  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      })
      setUser(null)
      window.location.href = '/login'
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
