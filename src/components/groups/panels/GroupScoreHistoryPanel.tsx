import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { apiFetch } from '../../../lib/api'
import { Panel } from './shared'

interface HistoryRow {
  session_id: number
  specific_game: string
  session_date: number
  user_id: number
  user_name: string
  score: number
}

interface ChartPoint {
  label: string
  [userName: string]: string | number
}

interface Props {
  groupId: number
}

const LINE_COLORS = [
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f43f5e', // rose-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
]

function toMs(value: number) {
  return value > 1e12 ? value : value * 1000
}

function shortDate(ts: number) {
  return new Date(toMs(ts)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function GroupScoreHistoryPanel({ groupId }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch<{ history: HistoryRow[] }>(`/api/groups/${groupId}/score-history`)
      .then(({ history: rows }) => {
        if (!cancelled) setHistory(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load score history.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [groupId])

  // Build chart data: one data point per session, one key per player
  const players = Array.from(new Set(history.map((r) => r.user_name)))

  const sessionIds = Array.from(new Set(history.map((r) => r.session_id)))
  const chartData: ChartPoint[] = sessionIds.map((sessionId) => {
    const rows = history.filter((r) => r.session_id === sessionId)
    const point: ChartPoint = {
      label: `${rows[0]?.specific_game ?? ''} · ${shortDate(rows[0]?.session_date ?? 0)}`,
    }
    for (const row of rows) {
      point[row.user_name] = row.score
    }
    return point
  })

  return (
    <Panel
      title="Score history"
      subtitle="Each player's score across completed sessions, in chronological order."
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : chartData.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/85 px-4 py-6 text-center text-sm text-slate-500">
          Complete at least one session to see score history.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                boxShadow: '0 4px 20px -8px rgba(15,23,42,0.2)',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
            />
            {players.map((player, i) => (
              <Line
                key={player}
                type="monotone"
                dataKey={player}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Panel>
  )
}
