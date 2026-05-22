import { useEffect, useState, type MouseEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFriends } from '../context/FriendContext'
import { useGroups } from '../context/GroupContext'
import type { Group } from '../context/GroupContext'
import type { GameDefinition } from '../lib/content'
import CreateGroupModal from '../components/groups/CreateGroupModal'
import GroupDetailModal from '../components/groups/GroupDetailModal'
import GroupInvites from '../components/groups/GroupInvites'
import JoinGroupModal from '../components/groups/JoinGroupModal'

interface Props {
  games: GameDefinition[]
  onCatalogGameCreated?: (game: GameDefinition) => void
}

export default function Home({ games, onCatalogGameCreated }: Props) {
  const { user } = useAuth()
  const { groups, groupInvites, fetchGroups, fetchGroupInvites } = useGroups()
  const { incomingRequests, fetchRequests } = useFriends()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  useEffect(() => {
    void Promise.all([
      fetchGroups(),
      fetchGroupInvites(),
      fetchRequests(),
    ])
  }, [fetchGroupInvites, fetchGroups, fetchRequests])

  useEffect(() => {
    function syncSelectedGroupFromHash() {
      setSelectedGroupId(parseGroupHash(window.location.hash))
    }

    syncSelectedGroupFromHash()
    window.addEventListener('hashchange', syncSelectedGroupFromHash)

    return () => {
      window.removeEventListener('hashchange', syncSelectedGroupFromHash)
    }
  }, [])

  const ownedGroups = groups.filter((group) => group.owner_id === user?.id)
  const joinedGroups = groups.filter((group) => group.owner_id !== user?.id)
  const notificationCount = groupInvites.length + incomingRequests.length
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null

  function openGroupPage(groupId: number) {
    setSelectedGroupId(groupId)

    const nextHash = `#group-${groupId}`
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash
    }
  }

  function closeGroupPage() {
    setSelectedGroupId(null)

    if (window.location.hash.startsWith('#group-')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }

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
              Run your groups and joined groups from the cards below, with direct access into the
              full group workspace without needing a separate section farther down the page.
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

      <section className="grid gap-4 xl:grid-cols-3">
        <HomeGroupDropdownCard
          currentUserId={user?.id ?? null}
          emptyMessage="You are not running any groups yet."
          groups={ownedGroups}
          label="Groups you run"
          tone="bg-sky-50 text-sky-700"
          value={ownedGroups.length.toString()}
          onOpenGroup={openGroupPage}
        />
        <HomeGroupDropdownCard
          currentUserId={user?.id ?? null}
          emptyMessage="You have not joined any groups you do not own yet."
          groups={joinedGroups}
          label="Groups joined"
          tone="bg-amber-50 text-amber-700"
          value={joinedGroups.length.toString()}
          onOpenGroup={openGroupPage}
        />
        <NotificationsCard
          friendRequestCount={incomingRequests.length}
          groupInviteCount={groupInvites.length}
          total={notificationCount}
        />
      </section>

      <GroupInvites />

      {selectedGroup && (
        <GroupDetailModal
          availableGames={games}
          group={selectedGroup}
          onCatalogGameCreated={onCatalogGameCreated}
          onPlanningChange={() => {
            void fetchGroups()
          }}
          onClose={closeGroupPage}
        />
      )}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} />}
    </div>
  )
}

function HomeGroupDropdownCard({
  currentUserId,
  emptyMessage,
  groups,
  label,
  tone,
  value,
  onOpenGroup,
}: {
  currentUserId: number | null
  emptyMessage: string
  groups: Group[]
  label: string
  tone: string
  value: string
  onOpenGroup: (groupId: number) => void
}) {
  const [open, setOpen] = useState(false)

  function handleGroupClick(event: MouseEvent<HTMLAnchorElement>, groupId: number) {
    event.preventDefault()
    setOpen(false)
    onOpenGroup(groupId)
  }

  function handleOpenGroup(groupId: number) {
    setOpen(false)
    onOpenGroup(groupId)
  }

  return (
    <div className="rounded-[24px]">
      <button
        onClick={() => setOpen((current) => !current)}
        className={[
          'w-full rounded-[24px] border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors',
          open ? 'rounded-b-[16px] border-b-transparent shadow-none' : 'hover:border-gray-300',
        ].join(' ')}
      >
        <p className="text-sm text-gray-500">{label}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>
            Live
          </span>
          <span className="text-2xl font-semibold text-gray-900">{value}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="text-gray-500">
            {groups.length === 0
              ? 'No groups yet'
              : open
                ? 'Hide group links'
                : 'Open group links'}
          </span>
          <span className="text-lg text-gray-400">{open ? '−' : '+'}</span>
        </div>
      </button>

      {open && (
        <div className="-mt-3 rounded-[0_0_24px_24px] border border-gray-200 bg-white px-4 pb-4 pt-7 shadow-sm">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <HomeManagedGroupCard
                  key={group.id}
                  currentUserId={currentUserId}
                  group={group}
                  onFollowGroupLink={handleGroupClick}
                  onOpenGroup={handleOpenGroup}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationsCard({
  friendRequestCount,
  groupInviteCount,
  total,
}: {
  friendRequestCount: number
  groupInviteCount: number
  total: number
}) {
  return (
    <div className="rounded-[24px] border border-rose-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Notifications</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
              Alert
            </span>
            <span className="text-2xl font-semibold text-gray-900">{total}</span>
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-black text-rose-600">
          !
        </div>
      </div>

      <div className="mt-5 space-y-2 rounded-[20px] border border-rose-100 bg-rose-50/50 p-4 text-sm text-gray-600">
        <NotificationLine
          label="Group invites"
          value={groupInviteCount}
        />
        <NotificationLine
          label="Friend requests"
          value={friendRequestCount}
        />
        {total === 0 && (
          <p className="text-sm font-medium text-emerald-700">You are all caught up.</p>
        )}
      </div>
    </div>
  )
}

function NotificationLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-rose-100">
        {value}
      </span>
    </div>
  )
}

function HomeManagedGroupCard({
  currentUserId,
  group,
  onFollowGroupLink,
  onOpenGroup,
}: {
  currentUserId: number | null
  group: Group
  onFollowGroupLink: (event: MouseEvent<HTMLAnchorElement>, groupId: number) => void
  onOpenGroup: (groupId: number) => void
}) {
  const activeMembers = group.active_member_count ?? 0
  const isOwner = group.owner_id === currentUserId

  function handleCopyCode() {
    void navigator.clipboard.writeText(group.join_code)
  }

  return (
    <article className="rounded-[24px] border border-gray-200 bg-gray-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={`#group-${group.id}`}
            onClick={(event) => onFollowGroupLink(event, group.id)}
            className="text-sm font-semibold text-gray-900 underline-offset-4 transition-colors hover:text-amber-700 hover:underline"
          >
            {group.name}
          </a>
          <p className="mt-1 text-sm text-gray-500">
            {group.description || 'No description yet.'}
          </p>
        </div>
        <span
          className={[
            'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
            isOwner ? 'bg-sky-50 text-sky-700' : 'bg-gray-200 text-gray-700',
          ].join(' ')}
        >
          {isOwner ? 'Run' : 'Joined'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          {activeMembers}/{group.member_count} online
        </span>
        <span className="rounded-full bg-white px-3 py-1 font-mono text-[11px] text-gray-500 ring-1 ring-gray-200">
          {group.join_code}
        </span>
        <button
          onClick={handleCopyCode}
          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Copy code
        </button>
      </div>

      <div className="mt-4">
        <button
          onClick={() => onOpenGroup(group.id)}
          className="rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-700"
        >
          {isOwner ? 'Manage group' : 'View group'}
        </button>
      </div>
    </article>
  )
}

function parseGroupHash(hash: string) {
  if (!hash.startsWith('#group-')) return null

  const groupId = Number(hash.slice(7))
  return Number.isInteger(groupId) && groupId > 0 ? groupId : null
}
