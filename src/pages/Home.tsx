import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupContext'
import type { GameDefinition } from '../lib/content'
import GroupList from '../components/groups/GroupList'
import CreateGroupModal from '../components/groups/CreateGroupModal'
import GroupInvites from '../components/groups/GroupInvites'
import GroupPlanningBoard from '../components/groups/GroupPlanningBoard'
import JoinGroupModal from '../components/groups/JoinGroupModal'

interface Props {
  gameCount: number
  clipCount: number
  games: GameDefinition[]
  onCatalogGameCreated?: (game: GameDefinition) => void
}

export default function Home({ gameCount, clipCount, games, onCatalogGameCreated }: Props) {
  const { user } = useAuth()
  const { groups, fetchGroups, fetchGroupInvites } = useGroups()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [planningRefreshKey, setPlanningRefreshKey] = useState(0)

  useEffect(() => {
    void Promise.all([
      fetchGroups(),
      fetchGroupInvites(),
    ])
  }, [fetchGroupInvites, fetchGroups])

  const ownedGroups = groups.filter((group) => group.owner_id === user?.id).length

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-600">Home</p>
              <h1 className="mt-2 text-3xl font-semibold text-gray-900">Welcome back, {user?.name}</h1>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-gray-600">
              Keep your groups organized, explore what people are playing, and move from planning a
              game to finding clips and friends without leaving the app.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowJoin(true)}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Join group
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Create group
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Groups joined" value={groups.length.toString()} tone="bg-amber-50 text-amber-700" />
        <MetricCard label="Groups you run" value={ownedGroups.toString()} tone="bg-sky-50 text-sky-700" />
        <MetricCard
          label="Discovery library"
          value={`${gameCount} games / ${clipCount} clips`}
          tone="bg-emerald-50 text-emerald-700"
        />
      </section>

      <GroupInvites />

      <GroupPlanningBoard groups={groups} refreshKey={planningRefreshKey} />

      <section className="space-y-4 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Your groups</h2>
            <p className="mt-1 text-sm text-gray-500">
              Open Manage Group to connect reusable game templates with specific sessions.
            </p>
          </div>
        </div>

        <GroupList
          availableGames={games}
          onCatalogGameCreated={onCatalogGameCreated}
          onPlanningChange={() => setPlanningRefreshKey((current) => current + 1)}
        />
      </section>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} />}
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: string
}) {
  return (
    <div className="rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>
          Live
        </span>
        <span className="text-2xl font-semibold text-gray-900">{value}</span>
      </div>
    </div>
  )
}
