import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import UserProfile from '@/components/auth/UserProfile'
import LoginButton from '@/components/auth/LoginButton'

export default function Navbar() {
  const { isAuthenticated, isLoading } = useAuth()

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 h-full grid grid-cols-3 items-center">
          <div className="flex justify-start gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Home
            </Link>
            <Link to="/documents" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Documents
            </Link>
            <Link to="/chat" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Chat
            </Link>
          </div>

          <div className="flex justify-center">
            <span className="text-lg font-bold text-gray-900 tracking-tight truncate">
              Preschool Agent
            </span>
          </div>

          <div className="flex justify-end items-center gap-2">
            {isLoading ? (
              <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
            ) : isAuthenticated ? (
              <UserProfile />
            ) : (
              <LoginButton />
            )}
          </div>
        </div>
      </nav>

      <div className="h-16" />
    </>
  )
}
