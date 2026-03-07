import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import UserProfile from '@/components/auth/UserProfile'
import { apiGet } from '@/lib/api'

export default function Navbar() {
  const { isAuthenticated, isLoading, signIn } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // ルート変更時にメニューを閉じる
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // ヘルス状態を取得
  useEffect(() => {
    apiGet<{ status: string }>('/api/health')
      .then(d => setHealthOk(d.status === 'ok'))
      .catch(() => setHealthOk(false))
  }, [])

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

  // ユーザーメニュー外クリックで閉じる
  useEffect(() => {
    if (!userMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  // ルート変更時にユーザーメニューを閉じる
  useEffect(() => {
    setUserMenuOpen(false)
  }, [location.pathname])

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
                  ホーム
                </Link>
                <Link to="/documents" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  文書
                </Link>
                <Link to="/chat" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  調べる
                </Link>
                <Link to="/events" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                  予定
                </Link>
              </div>
            )}
          </div>

          <div className="flex justify-center items-center gap-2">
            <span className="text-lg font-bold text-gray-900 tracking-tight truncate">
              幼稚園のお知らせ
            </span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              healthOk === null ? 'bg-gray-300' :
              healthOk ? 'bg-green-500' : 'bg-red-500'
            }`} />
          </div>

          <div className="flex justify-end items-center gap-2">
            {isLoading ? (
              <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
            ) : isAuthenticated ? (
              <UserProfile />
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="focus:outline-none"
                  aria-label="ユーザーメニュー"
                  aria-expanded={userMenuOpen}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                  </div>
                </button>

                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-100 py-1 z-50">
                    <button
                      onClick={() => { setUserMenuOpen(false); signIn() }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign in
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="h-16" />
    </>
  )
}
