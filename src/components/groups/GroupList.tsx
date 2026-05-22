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
  const activeMembers = group.active_member_count ?? 0

  function handleCopy() {
    void navigator.clipboard.writeText(group.join_code)
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">{group.name}</h3>
            {group.description && (
              <p className="mt-0.5 text-sm text-slate-500">{group.description}</p>
            )}
          </div>
          {isOwner && (
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              Owner
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Code</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold tracking-widest text-slate-700">
              {group.join_code}
            </span>
            <button
              onClick={handleCopy}
              className="text-xs text-slate-400 transition-colors hover:text-slate-600"
              title="Copy join code"
            >
              Copy
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {activeMembers}/{group.member_count} online
          </span>
        </div>

        <button
          onClick={() => setShowDetail(true)}
          className="self-start rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-700"
        >
          {isOwner ? 'Manage group' : 'View group'}
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
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </p>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/85 px-4 py-8 text-center text-sm text-slate-500">
        You're not in any groups yet. Create one or join with a code above.
      </div>
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
