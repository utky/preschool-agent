import { useAuth } from '@/hooks/useAuth'

export default function UserProfile() {
  const { user, signOut } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
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
      <button
        onClick={signOut}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        Sign out
      </button>
    </div>
  )
}
