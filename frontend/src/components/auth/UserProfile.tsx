import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function UserProfile() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  // ルート変更時に閉じる
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!user) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="focus:outline-none"
        aria-label="ユーザーメニュー"
        aria-expanded={open}
      >
        <div className="relative">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || 'User'}
              className="w-9 h-9 rounded-full border border-gray-200"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-600 text-sm font-medium">
                {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <span className="absolute bottom-0 right-0 block w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
        </div>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-100 py-1 z-50">
          <div className="px-4 py-2 text-sm text-gray-500 truncate">
            {user.name || user.email}
          </div>
          <hr className="border-gray-100" />
          <button
            onClick={() => { setOpen(false); signOut() }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
