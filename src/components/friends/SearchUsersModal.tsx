import { useState, useEffect, useRef } from 'react'
import { useFriends } from '../../context/FriendContext'
import type { UserSearchResult } from '../../context/FriendContext'
import { ApiError } from '../../lib/api'

interface Props {
  onClose: () => void
}

function StatusBadge({ user }: { user: UserSearchResult }) {
  const { sendRequest } = useFriends()
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (user.friendship_status === 'accepted') {
    return <span className="text-xs text-green-600 font-medium">Friends</span>
  }
  if (user.friendship_status === 'pending') {
    return (
      <span className="text-xs text-gray-400">
        {user.friendship_direction === 'sent' ? 'Request sent' : 'Sent you a request'}
      </span>
    )
  }

  async function handle() {
    setSending(true)
    setErr(null)
    try {
      await sendRequest(user.id)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={sending}
        className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-3 py-1 rounded-lg transition-colors"
      >
        {sending ? '…' : 'Add friend'}
      </button>
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  )
}

export default function SearchUsersModal({ onClose }: Props) {
  const { searchResults, searchUsers, clearSearch } = useFriends()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    return () => clearSearch()
  }, [clearSearch])

  useEffect(() => {
    const t = setTimeout(() => { void searchUsers(query) }, 300)
    return () => clearTimeout(t)
  }, [query, searchUsers])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Find people</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
        />

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {query.length >= 2 && searchResults.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No users found.</p>
          )}
          {searchResults.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </div>
              <StatusBadge user={u} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
