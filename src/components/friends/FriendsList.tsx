import { useState } from 'react'
import { useFriends } from '../../context/FriendContext'
import SearchUsersModal from './SearchUsersModal'
import FriendRequests from './FriendRequests'

export default function FriendsList() {
  const { friends, loading, unfriend } = useFriends()
  const [showSearch, setShowSearch] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Friends</h1>
        <button
          onClick={() => setShowSearch(true)}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          + Add friend
        </button>
      </div>

      <FriendRequests />

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && friends.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          No friends yet. Search for people to add them.
        </p>
      )}

      {!loading && friends.length > 0 && (
        <div className="space-y-2">
          {friends.map((f) => (
            <div key={f.friendship_id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{f.name}</p>
                <p className="text-xs text-gray-400">{f.email}</p>
              </div>
              <button
                onClick={() => unfriend(f.friendship_id)}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {showSearch && <SearchUsersModal onClose={() => setShowSearch(false)} />}
    </div>
  )
}
