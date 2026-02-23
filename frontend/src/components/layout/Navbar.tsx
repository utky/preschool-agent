import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import UserProfile from '@/components/auth/UserProfile'
import LoginButton from '@/components/auth/LoginButton'

export default function Navbar() {
  const { isAuthenticated, isLoading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // ルート変更時にメニューを閉じる
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 h-full grid grid-cols-3 items-center">
          <div className="flex justify-start relative" ref={menuRef}>
            <button
              type="button"
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="メニュー"
              aria-expanded={menuOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-100 py-1 z-50">
                <Link to="/" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Home
                </Link>
                <Link to="/documents" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Documents
                </Link>
                <Link to="/chat" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Chat
                </Link>
                <Link to="/events" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  Events
                </Link>
              </div>
            )}
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
