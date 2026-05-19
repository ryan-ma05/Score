import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { apiFetch } from '../lib/api'

export interface Friend {
  id: number
  name: string
  email: string
  friendship_id: number
  created_at: number
}

export interface FriendRequest {
  id: number
  user_id: number
  name: string
  email: string
  created_at: number
}

export interface UserSearchResult {
  id: number
  name: string
  email: string
  friendship_status: string | null
  friendship_direction: 'sent' | 'received' | null
}

interface FriendContextType {
  friends: Friend[]
  incomingRequests: FriendRequest[]
  sentRequests: FriendRequest[]
  searchResults: UserSearchResult[]
  loading: boolean
  fetchFriends: () => Promise<void>
  fetchRequests: () => Promise<void>
  searchUsers: (q: string) => Promise<void>
  clearSearch: () => void
  sendRequest: (userId: number) => Promise<void>
  acceptRequest: (friendshipId: number) => Promise<void>
  declineRequest: (friendshipId: number) => Promise<void>
  unfriend: (friendshipId: number) => Promise<void>
}

const FriendContext = createContext<FriendContextType | null>(null)

export function FriendProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const fetchFriends = useCallback(async () => {
    setLoading(true)
    try {
      const { friends: data } = await apiFetch<{ friends: Friend[] }>('/api/friends')
      setFriends(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRequests = useCallback(async () => {
    const [{ requests }, { sent }] = await Promise.all([
      apiFetch<{ requests: FriendRequest[] }>('/api/friends/requests'),
      apiFetch<{ sent: FriendRequest[] }>('/api/friends/sent'),
    ])
    setIncomingRequests(requests)
    setSentRequests(sent)
  }, [])

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return }
    const { users } = await apiFetch<{ users: UserSearchResult[] }>(`/api/friends/search?q=${encodeURIComponent(q)}`)
    setSearchResults(users)
  }, [])

  const clearSearch = useCallback(() => setSearchResults([]), [])

  const sendRequest = useCallback(async (userId: number) => {
    await apiFetch('/api/friends/request', { method: 'POST', body: JSON.stringify({ userId }) })
    setSearchResults((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, friendship_status: 'pending', friendship_direction: 'sent' }
          : u
      )
    )
    await fetchRequests()
  }, [fetchRequests])

  const acceptRequest = useCallback(async (friendshipId: number) => {
    await apiFetch(`/api/friends/${friendshipId}/accept`, { method: 'POST' })
    setIncomingRequests((prev) => prev.filter((r) => r.id !== friendshipId))
    await fetchFriends()
  }, [fetchFriends])

  const declineRequest = useCallback(async (friendshipId: number) => {
    await apiFetch(`/api/friends/${friendshipId}/decline`, { method: 'POST' })
    setIncomingRequests((prev) => prev.filter((r) => r.id !== friendshipId))
  }, [])

  const unfriend = useCallback(async (friendshipId: number) => {
    await apiFetch(`/api/friends/${friendshipId}`, { method: 'DELETE' })
    setFriends((prev) => prev.filter((f) => f.friendship_id !== friendshipId))
  }, [])

  return (
    <FriendContext.Provider value={{
      friends, incomingRequests, sentRequests, searchResults, loading,
      fetchFriends, fetchRequests, searchUsers, clearSearch,
      sendRequest, acceptRequest, declineRequest, unfriend,
    }}>
      {children}
    </FriendContext.Provider>
  )
}

export function useFriends() {
  const ctx = useContext(FriendContext)
  if (!ctx) throw new Error('useFriends must be used within FriendProvider')
  return ctx
}
