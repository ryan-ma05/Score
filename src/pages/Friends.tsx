import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, apiFetch } from '../lib/api'

interface Friend {
  id: number
  name: string
  email: string
  friendship_id: number
  created_at: number
}

interface FriendRequest {
  id: number
  user_id: number
  name: string
  email: string
  created_at: number
}

interface FriendSearchResult {
  id: number
  name: string
  email: string
  friendship_status: 'pending' | 'accepted' | 'declined' | null
  friendship_direction: 'sent' | 'received' | null
}

export default function Friends() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [hasMoreFriends, setHasMoreFriends] = useState(false)
  const [friendsOffset, setFriendsOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [sent, setSent] = useState<FriendRequest[]>([])
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const FRIENDS_PAGE = 50

  const refreshLists = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true)
    }
    setError(null)

    try {
      const [friendsRes, requestsRes, sentRes] = await Promise.all([
        apiFetch<{ friends: Friend[]; hasMore: boolean }>(`/api/friends?limit=${FRIENDS_PAGE}&offset=0`),
        apiFetch<{ requests: FriendRequest[] }>('/api/friends/requests'),
        apiFetch<{ sent: FriendRequest[] }>('/api/friends/sent'),
      ])

      setFriends(friendsRes.friends)
      setHasMoreFriends(friendsRes.hasMore ?? false)
      setFriendsOffset(FRIENDS_PAGE)
      setRequests(requestsRes.requests)
      setSent(sentRes.sent)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load friends.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleLoadMoreFriends = useCallback(async () => {
    setLoadingMore(true)
    try {
      const { friends: data, hasMore } = await apiFetch<{ friends: Friend[]; hasMore: boolean }>(
        `/api/friends?limit=${FRIENDS_PAGE}&offset=${friendsOffset}`
      )
      setFriends((prev) => {
        const seen = new Set(prev.map((f) => f.id))
        return [...prev, ...data.filter((f) => !seen.has(f.id))]
      })
      setHasMoreFriends(hasMore ?? false)
      setFriendsOffset((prev) => prev + FRIENDS_PAGE)
    } finally {
      setLoadingMore(false)
    }
  }, [friendsOffset])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshLists(false)
    })
  }, [refreshLists])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)

    if (query.trim().length < 2) {
      setSearchResults([])
      setError('Search with at least 2 characters.')
      return
    }

    setSearching(true)
    setError(null)

    try {
      const res = await apiFetch<{ users: FriendSearchResult[] }>(
        `/api/friends/search?q=${encodeURIComponent(query.trim())}`,
      )
      setSearchResults(res.users)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Search failed.'
      setError(message)
    } finally {
      setSearching(false)
    }
  }

  async function sendFriendRequest(userId: number) {
    setFeedback(null)
    setError(null)

    try {
      const res = await apiFetch<{ message: string }>('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      })
      setFeedback(res.message)
      await refreshLists()
      await rerunSearch()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not send request.'
      setError(message)
    }
  }

  async function respondToRequest(id: number, action: 'accept' | 'decline') {
    setFeedback(null)
    setError(null)

    try {
      const res = await apiFetch<{ message: string }>(`/api/friends/${id}/${action}`, {
        method: 'POST',
      })
      setFeedback(res.message)
      await refreshLists()
      await rerunSearch()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : `Could not ${action} request.`
      setError(message)
    }
  }

  async function removeFriend(id: number) {
    setFeedback(null)
    setError(null)

    try {
      const res = await apiFetch<{ message: string }>(`/api/friends/${id}`, {
        method: 'DELETE',
      })
      setFeedback(res.message)
      await refreshLists()
      await rerunSearch()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not remove friend.'
      setError(message)
    }
  }

  const rerunSearch = useCallback(async () => {
    if (query.trim().length < 2) return

    try {
      const res = await apiFetch<{ users: FriendSearchResult[] }>(
        `/api/friends/search?q=${encodeURIComponent(query.trim())}`,
      )
      setSearchResults(res.users)
    } catch {
      setSearchResults([])
    }
  }, [query])

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-amber-600">Friends</p>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Build your people graph</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              You already have search, requests, accepted friends, and sent requests on the backend,
              so this page is connected to the live API today.
            </p>
          </div>

          <form onSubmit={handleSearch} className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by friend name"
              className={inputClassName}
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? 'Searching…' : 'Find friends'}
            </button>
          </form>
        </div>

        {error && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {feedback && (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback}
          </p>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <div className="space-y-6">
          <Panel
            title="Your friends"
            subtitle="Accepted friendships ready for invites, group building, and future social features."
          >
            {loading ? (
              <EmptyState message="Loading friends…" />
            ) : friends.length === 0 ? (
              <EmptyState message="You do not have any friends added yet." />
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div key={friend.friendship_id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{friend.name}</p>
                        <p className="mt-1 text-sm text-gray-500">{friend.email}</p>
                      </div>
                      <button
                        onClick={() => removeFriend(friend.friendship_id)}
                        className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {hasMoreFriends && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => void handleLoadMoreFriends()}
                      disabled={loadingMore}
                      className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="Search results"
            subtitle="Use this to find people, send requests, or spot pending relationships."
          >
            {searchResults.length === 0 ? (
              <EmptyState message="Search results will show up here." />
            ) : (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div key={result.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{result.name}</p>
                        <p className="mt-1 text-sm text-gray-500">{result.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.friendship_status === 'accepted' ? (
                          <StatusPill tone="bg-emerald-50 text-emerald-700" label="Already friends" />
                        ) : result.friendship_status === 'pending' && result.friendship_direction === 'sent' ? (
                          <StatusPill tone="bg-amber-50 text-amber-700" label="Request sent" />
                        ) : result.friendship_status === 'pending' && result.friendship_direction === 'received' ? (
                          <StatusPill tone="bg-sky-50 text-sky-700" label="Waiting on you" />
                        ) : (
                          <button
                            onClick={() => sendFriendRequest(result.id)}
                            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                          >
                            Add friend
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Incoming requests"
            subtitle="Requests other people have sent you."
          >
            {loading ? (
              <EmptyState message="Loading requests…" />
            ) : requests.length === 0 ? (
              <EmptyState message="No incoming requests right now." />
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{request.name}</p>
                    <p className="mt-1 text-sm text-gray-500">{request.email}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => respondToRequest(request.id, 'accept')}
                        className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondToRequest(request.id, 'decline')}
                        className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Sent requests"
            subtitle="Useful for visibility so users know whether a request is still pending."
          >
            {loading ? (
              <EmptyState message="Loading sent requests…" />
            ) : sent.length === 0 ? (
              <EmptyState message="No pending outgoing requests." />
            ) : (
              <div className="space-y-3">
                {sent.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">{request.name}</p>
                    <p className="mt-1 text-sm text-gray-500">{request.email}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-gray-400">Pending</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {message}
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>{label}</span>
}

const inputClassName =
  'w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
