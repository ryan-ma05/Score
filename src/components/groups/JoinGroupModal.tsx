import { useState } from 'react'
import type { FormEvent } from 'react'
import { useGroups } from '../../context/GroupContext'
import { ApiError } from '../../lib/api'

interface Props {
  onClose: () => void
}

export default function JoinGroupModal({ onClose }: Props) {
  const { joinGroup } = useGroups()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await joinGroup(code.trim())
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Join a group</h2>
        <p className="text-sm text-gray-500 mb-4">Enter the 6-character code shared by the group owner.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono tracking-widest uppercase text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium py-2 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2 transition-colors"
            >
              {loading ? 'Joining…' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
