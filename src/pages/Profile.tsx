import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

interface UserStats {
  groupsActive: number
  sessionsPlayed: number
  totalScore: number
  avgScore: number
  wins: number
}

interface GroupStat {
  groupId: number
  groupName: string
  sessions: number
  totalScore: number
  wins: number
}

interface ProfileData {
  user: { id: number; name: string; email: string; createdAt: number }
  stats: UserStats
  groups: GroupStat[]
}

function toMs(value: number) {
  return value > 1e12 ? value : value * 1000
}

function formatDate(ts: number) {
  return new Date(toMs(ts)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Profile() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<ProfileData>('/api/users/me/stats')
      .then(setData)
      .catch(() => setError('Could not load profile stats.'))
      .finally(() => setLoading(false))
  }, [])

  const winRate =
    data && data.stats.sessionsPlayed > 0
      ? Math.round((data.stats.wins / data.stats.sessionsPlayed) * 100)
      : 0

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-white/70 bg-white/90 px-6 py-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">Profile</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              {loading ? '…' : (data?.user.name ?? 'My profile')}
            </h2>
            {data && (
              <p className="mt-1 text-sm text-slate-500">
                {data.user.email} · Member since {formatDate(data.user.createdAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      )}

      {error && (
        <p className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </p>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Sessions played" value={String(data.stats.sessionsPlayed)} />
            <StatCard label="Total score" value={String(data.stats.totalScore)} />
            <StatCard label="Avg score" value={String(data.stats.avgScore)} />
            <StatCard label="Wins" value={String(data.stats.wins)} />
            <StatCard label="Win rate" value={`${winRate}%`} />
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/90 px-6 py-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Per-group breakdown</p>

            {data.groups.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">
                Complete at least one group session to see a breakdown here.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Group</th>
                      <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sessions</th>
                      <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Total score</th>
                      <th className="pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.groups.map((g) => (
                      <tr key={g.groupId}>
                        <td className="py-3 pr-4 font-medium text-slate-900">{g.groupName}</td>
                        <td className="py-3 pr-4 text-slate-600">{g.sessions}</td>
                        <td className="py-3 pr-4 text-slate-600">{g.totalScore}</td>
                        <td className="py-3 text-slate-600">{g.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}
