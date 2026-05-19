import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../context/GroupContext'
import { useFriends } from '../context/FriendContext'
import GroupList from '../components/groups/GroupList'
import GroupInvites from '../components/groups/GroupInvites'
import CreateGroupModal from '../components/groups/CreateGroupModal'
import JoinGroupModal from '../components/groups/JoinGroupModal'
import FriendsList from '../components/friends/FriendsList'

type Tab = 'groups' | 'friends'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { fetchGroups, fetchGroupInvites, groupInvites } = useGroups()
  const { fetchFriends, fetchRequests, incomingRequests } = useFriends()
  const [tab, setTab] = useState<Tab>('groups')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)

  useEffect(() => {
    void fetchGroups()
    void fetchGroupInvites()
    void fetchFriends()
    void fetchRequests()
  }, [fetchGroups, fetchGroupInvites, fetchFriends, fetchRequests])

  const friendBadge = incomingRequests.length > 0 ? incomingRequests.length : null
  const groupBadge = groupInvites.length > 0 ? groupInvites.length : null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900">Score</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 flex gap-0">
          {(['groups', 'friends'] as Tab[]).map((t) => {
            const badge = t === 'groups' ? groupBadge : friendBadge
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-5 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                  tab === t
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t}
                {badge !== null && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-xs bg-indigo-600 text-white rounded-full">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {tab === 'groups' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Your groups</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowJoin(true)}
                  className="rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50 transition-colors"
                >
                  Join group
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  + Create group
                </button>
              </div>
            </div>
            <GroupInvites />
            <GroupList />
          </>
        )}

        {tab === 'friends' && <FriendsList />}
      </main>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} />}
    </div>
  )
}
