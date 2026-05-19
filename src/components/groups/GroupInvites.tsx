import { useGroups } from '../../context/GroupContext'

export default function GroupInvites() {
  const { groupInvites, acceptGroupInvite, declineGroupInvite } = useGroups()

  if (groupInvites.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Group invites ({groupInvites.length})
      </h3>
      <div className="space-y-2">
        {groupInvites.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{inv.group_name}</p>
              <p className="text-xs text-gray-500">Invited by {inv.inviter_name}</p>
              {inv.group_description && (
                <p className="text-xs text-gray-400 mt-0.5">{inv.group_description}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => acceptGroupInvite(inv.id)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => declineGroupInvite(inv.id)}
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
