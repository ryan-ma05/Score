import { useFriends } from '../../context/FriendContext'

export default function FriendRequests() {
  const { incomingRequests, acceptRequest, declineRequest } = useFriends()

  if (incomingRequests.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Pending requests ({incomingRequests.length})
      </h3>
      <div className="space-y-2">
        {incomingRequests.map((r) => (
          <div key={r.id} className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-500">{r.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => acceptRequest(r.id)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => declineRequest(r.id)}
                className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
