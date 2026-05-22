import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import { Panel } from './shared'

interface LeaderboardEntry {
  user_id: number
  user_name: string
  sessions_played: number
  total_score: number
  avg_score: number
  wins: number
}

interface Props {
  groupId: number
}

export default function GroupLeaderboardPanel({ groupId }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch<{ leaderboard: LeaderboardEntry[] }>(`/api/groups/${groupId}/leaderboard`)
      .then(({ leaderboard }) => {
        if (!cancelled) setEntries(leaderboard)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load leaderboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [groupId])

  const hasActivity = entries.some((e) => e.sessions_played > 0)

  return (
    <Panel
      title="Leaderboard"
      subtitle="Cumulative stats across all completed sessions in this group."
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : !hasActivity ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/85 px-4 py-6 text-center text-sm text-slate-500">
          Complete at least one session to see the leaderboard.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Rank
                </th>
                <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Player
                </th>
                <th className="pb-3 pr-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Sessions
                </th>
                <th className="pb-3 pr-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Total
                </th>
                <th className="pb-3 pr-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Avg
                </th>
                <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Wins
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const rank = index + 1
                const medalColor =
                  rank === 1
                    ? 'text-amber-500'
                    : rank === 2
                      ? 'text-slate-400'
                      : rank === 3
                        ? 'text-amber-700'
                        : 'text-slate-300'

                return (
                  <tr
                    key={entry.user_id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <span className={`text-base font-bold ${medalColor}`}>
                        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">{entry.user_name}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                      {entry.sessions_played}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums font-semibold text-slate-900">
                      {entry.total_score}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                      {entry.avg_score}
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-600">{entry.wins}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
