import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useGroups } from '../../context/GroupContext'
import type { Group } from '../../context/GroupContext'
import type { GameDefinition } from '../../lib/content'
import GroupDetailModal from './GroupDetailModal'

function GroupCard({
  group,
  availableGames,
  onCatalogGameCreated,
  onPlanningChange,
}: {
  group: Group
  availableGames: GameDefinition[]
  onCatalogGameCreated?: (game: GameDefinition) => void
  onPlanningChange?: () => void
}) {
  const { user } = useAuth()
  const isOwner = user?.id === group.owner_id
  const [showDetail, setShowDetail] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(group.join_code)
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">{group.name}</h3>
            {group.description && (
              <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
            )}
          </div>
          {isOwner && (
            <span className="text-xs text-indigo-400 font-medium shrink-0">Owner</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Code:</span>
            <span className="font-mono text-sm font-semibold tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {group.join_code}
            </span>
            <button
              onClick={handleCopy}
              className="text-xs text-gray-400 hover:text-gray-600"
              title="Copy code"
            >
              Copy
            </button>
          </div>
          <span className="text-xs text-gray-400">
            {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
          </span>
        </div>

        <button
          onClick={() => setShowDetail(true)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium text-left"
        >
          {isOwner ? 'Manage group →' : 'View members →'}
        </button>
      </div>

      {showDetail && (
        <GroupDetailModal
          availableGames={availableGames}
          group={group}
          onCatalogGameCreated={onCatalogGameCreated}
          onPlanningChange={onPlanningChange}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  )
}

export default function GroupList({
  availableGames = [],
  onCatalogGameCreated,
  onPlanningChange,
}: {
  availableGames?: GameDefinition[]
  onCatalogGameCreated?: (game: GameDefinition) => void
  onPlanningChange?: () => void
}) {
  const { groups, loading, error } = useGroups()

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500 text-center py-8">{error}</p>
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        You're not in any groups yet. Create one or join with a code.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          availableGames={availableGames}
          onCatalogGameCreated={onCatalogGameCreated}
          onPlanningChange={onPlanningChange}
        />
      ))}
    </div>
  )
}
