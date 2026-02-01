import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import LoginButton from '@/components/auth/LoginButton'

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Preschool Agent</h1>
          <p className="mt-2 text-gray-600">Sign in to continue</p>
        </div>
        <div className="flex justify-center">
          <LoginButton />
        </div>
      </div>
    </div>
  )
}
