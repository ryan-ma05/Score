import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { apiFetch } from '../lib/api'

export interface Group {
  id: number
  name: string
  description: string
  join_code: string
  owner_id: number
  member_count: number
  active_member_count: number
  created_at: number
}

export interface GroupMember {
  id: number
  name: string
  email: string
  joined_at: number
}

export interface GroupInvite {
  id: number
  group_id: number
  inviter_id: number
  group_name: string
  group_description: string
  inviter_name: string
  created_at: number
}

export interface SavedGroupGame {
  groupId: number
  gameId: number
  name: string
  category: string
  specificGame: string
  playerCount: string
  roundCount: string
  scoringSystem: string
  rules: string
  source: 'official' | 'community'
  moderationStatus: 'approved' | 'pending' | 'rejected'
  savedAt: number
  savedBy: number | null
  savedByName: string | null
}

export type GroupSessionStatus = 'scheduled' | 'completed' | 'cancelled'

export interface GroupGameSessionScore {
  sessionId: number
  userId: number
  userName: string
  score: number
  updatedAt: number
}

export interface GroupGameSession {
  id: number
  groupId: number
  gameId: number
  gameName: string
  category: string
  specificGame: string
  scoringSystem: string
  createdBy: number | null
  createdByName: string | null
  scheduledFor: number | null
  status: GroupSessionStatus
  ruleOverrides: string
  createdAt: number
  scores: GroupGameSessionScore[]
}

interface CreateGroupSessionInput {
  gameId: number
  scheduledFor?: string | null
  status: GroupSessionStatus
  ruleOverrides?: string
}

interface GroupContextType {
  groups: Group[]
  groupInvites: GroupInvite[]
  loading: boolean
  error: string | null
  fetchGroups: () => Promise<void>
  fetchGroupInvites: () => Promise<void>
  createGroup: (name: string, description: string) => Promise<void>
  joinGroup: (code: string) => Promise<void>
  leaveGroup: (id: number) => Promise<void>
  inviteToGroup: (groupId: number, userId: number) => Promise<void>
  removeMember: (groupId: number, userId: number) => Promise<void>
  transferOwnership: (groupId: number, userId: number) => Promise<void>
  acceptGroupInvite: (inviteId: number) => Promise<void>
  declineGroupInvite: (inviteId: number) => Promise<void>
  getGroupDetail: (groupId: number) => Promise<{ group: Group; members: GroupMember[] }>
  getGroupSavedGames: (groupId: number) => Promise<SavedGroupGame[]>
  saveGameToGroup: (groupId: number, gameId: number) => Promise<SavedGroupGame>
  removeSavedGame: (groupId: number, gameId: number) => Promise<void>
  getGroupSessions: (groupId: number, status?: GroupSessionStatus | '') => Promise<GroupGameSession[]>
  createGroupSession: (groupId: number, input: CreateGroupSessionInput) => Promise<GroupGameSession>
  updateSessionScore: (
    groupId: number,
    sessionId: number,
    userId: number,
    input: { delta?: number; score?: number },
  ) => Promise<GroupGameSessionScore>
  updateSessionStatus: (
    groupId: number,
    sessionId: number,
    status: GroupSessionStatus,
  ) => Promise<GroupGameSession>
}

const GroupContext = createContext<GroupContextType | null>(null)

export function GroupProvider({ children }: { children: ReactNode }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { groups: data } = await apiFetch<{ groups: Group[] }>('/api/groups')
      setGroups(data)
    } catch {
      setError('Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGroupInvites = useCallback(async () => {
    const { invites } = await apiFetch<{ invites: GroupInvite[] }>('/api/groups/invites')
    setGroupInvites(invites)
  }, [])

  const createGroup = useCallback(async (name: string, description: string) => {
    const { group } = await apiFetch<{ group: Group }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
    setGroups((prev) => [{ ...group, member_count: 1, active_member_count: 1 }, ...prev])
  }, [])

  const joinGroup = useCallback(async (code: string) => {
    const { group } = await apiFetch<{ group: Group }>('/api/groups/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
    setGroups((prev) => [...prev, { ...group, member_count: Math.max(group.member_count, 1), active_member_count: Math.max(group.active_member_count, 1) }])
    await fetchGroups()
  }, [fetchGroups])

  const leaveGroup = useCallback(async (id: number) => {
    await apiFetch(`/api/groups/${id}/leave`, { method: 'DELETE' })
    setGroups((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const inviteToGroup = useCallback(async (groupId: number, userId: number) => {
    await apiFetch(`/api/groups/${groupId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  }, [])

  const removeMember = useCallback(async (groupId: number, userId: number) => {
    await apiFetch(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' })
    await fetchGroups()
  }, [fetchGroups])

  const transferOwnership = useCallback(async (groupId: number, userId: number) => {
    await apiFetch(`/api/groups/${groupId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, owner_id: userId } : g))
    )
  }, [])

  const acceptGroupInvite = useCallback(async (inviteId: number) => {
    const { group } = await apiFetch<{ group: Group }>(`/api/groups/invites/${inviteId}/accept`, { method: 'POST' })
    setGroupInvites((prev) => prev.filter((i) => i.id !== inviteId))
    setGroups((prev) => [...prev, { ...group, member_count: Math.max(group.member_count, 1), active_member_count: Math.max(group.active_member_count, 1) }])
    await fetchGroups()
  }, [fetchGroups])

  const declineGroupInvite = useCallback(async (inviteId: number) => {
    await apiFetch(`/api/groups/invites/${inviteId}/decline`, { method: 'POST' })
    setGroupInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }, [])

  const getGroupDetail = useCallback(async (groupId: number) => {
    return apiFetch<{ group: Group; members: GroupMember[] }>(`/api/groups/${groupId}`)
  }, [])

  const getGroupSavedGames = useCallback(async (groupId: number) => {
    const { saved_games } = await apiFetch<{ saved_games: SavedGameRow[] }>(`/api/groups/${groupId}/saved-games`)
    return saved_games.map(mapSavedGame)
  }, [])

  const saveGameToGroup = useCallback(async (groupId: number, gameId: number) => {
    const { saved_game } = await apiFetch<{ saved_game: SavedGameRow }>(`/api/groups/${groupId}/saved-games`, {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    })
    return mapSavedGame(saved_game)
  }, [])

  const removeSavedGame = useCallback(async (groupId: number, gameId: number) => {
    await apiFetch(`/api/groups/${groupId}/saved-games/${gameId}`, { method: 'DELETE' })
  }, [])

  const getGroupSessions = useCallback(async (groupId: number, status: GroupSessionStatus | '' = '') => {
    const suffix = status ? `?status=${status}` : ''
    const { sessions } = await apiFetch<{ sessions: GroupSessionRow[] }>(`/api/groups/${groupId}/sessions${suffix}`)
    return sessions.map(mapGroupSession)
  }, [])

  const createGroupSession = useCallback(async (groupId: number, input: CreateGroupSessionInput) => {
    const { session } = await apiFetch<{ session: GroupSessionRow }>(`/api/groups/${groupId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return mapGroupSession(session)
  }, [])

  const updateSessionScore = useCallback(async (
    groupId: number,
    sessionId: number,
    userId: number,
    input: { delta?: number; score?: number },
  ) => {
    const { score } = await apiFetch<{ score: GroupSessionScoreRow }>(`/api/groups/${groupId}/sessions/${sessionId}/scores`, {
      method: 'POST',
      body: JSON.stringify({ userId, ...input }),
    })
    return mapGroupSessionScore(score)
  }, [])

  const updateSessionStatus = useCallback(async (
    groupId: number,
    sessionId: number,
    status: GroupSessionStatus,
  ) => {
    const { session } = await apiFetch<{ session: GroupSessionRow }>(`/api/groups/${groupId}/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    return mapGroupSession(session)
  }, [])

  return (
    <GroupContext.Provider value={{
      groups, groupInvites, loading, error,
      fetchGroups, fetchGroupInvites, createGroup, joinGroup, leaveGroup,
      inviteToGroup, removeMember, transferOwnership,
      acceptGroupInvite, declineGroupInvite, getGroupDetail,
      getGroupSavedGames, saveGameToGroup, removeSavedGame,
      getGroupSessions, createGroupSession, updateSessionScore, updateSessionStatus,
    }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroups() {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error('useGroups must be used within GroupProvider')
  return ctx
}

interface SavedGameRow {
  group_id: number
  id: number
  name: string
  category: string
  specific_game: string
  player_count: string
  round_count: string
  scoring_system: string
  rules: string
  source: 'official' | 'community'
  moderation_status: 'approved' | 'pending' | 'rejected'
  saved_at: number
  saved_by: number | null
  saved_by_name: string | null
}

interface GroupSessionRow {
  id: number
  group_id: number
  game_id: number
  game_name: string
  category: string
  specific_game: string
  scoring_system: string
  created_by: number | null
  created_by_name: string | null
  scheduled_for: number | null
  status: GroupSessionStatus
  rule_overrides: string
  created_at: number
  scores?: GroupSessionScoreRow[]
}

interface GroupSessionScoreRow {
  session_id: number
  user_id: number
  user_name: string
  score: number
  updated_at: number
}

function mapSavedGame(row: SavedGameRow): SavedGroupGame {
  return {
    groupId: row.group_id,
    gameId: row.id,
    name: row.name,
    category: row.category,
    specificGame: row.specific_game,
    playerCount: row.player_count,
    roundCount: row.round_count,
    scoringSystem: row.scoring_system,
    rules: row.rules,
    source: row.source,
    moderationStatus: row.moderation_status,
    savedAt: toMilliseconds(row.saved_at),
    savedBy: row.saved_by,
    savedByName: row.saved_by_name,
  }
}

function mapGroupSession(row: GroupSessionRow): GroupGameSession {
  return {
    id: row.id,
    groupId: row.group_id,
    gameId: row.game_id,
    gameName: row.game_name,
    category: row.category,
    specificGame: row.specific_game,
    scoringSystem: row.scoring_system,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    scheduledFor: row.scheduled_for == null ? null : toMilliseconds(row.scheduled_for),
    status: row.status,
    ruleOverrides: row.rule_overrides,
    createdAt: toMilliseconds(row.created_at),
    scores: (row.scores ?? []).map(mapGroupSessionScore),
  }
}

function mapGroupSessionScore(row: GroupSessionScoreRow): GroupGameSessionScore {
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    userName: row.user_name,
    score: row.score,
    updatedAt: toMilliseconds(row.updated_at),
  }
}

function toMilliseconds(value: number) {
  return value > 1e12 ? value : value * 1000
}
