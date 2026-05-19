import { useEffect, useState } from 'react'
import { useGroups } from '../../context/GroupContext'
import type { Group, GroupGameSession } from '../../context/GroupContext'

interface Props {
  groups: Group[]
  refreshKey?: number
}

interface GroupPlanningSnapshot {
  group: Group
  savedTemplateCount: number
  sessionCount: number
  nextSession: GroupGameSession | null
}

export default function GroupPlanningBoard({ groups, refreshKey = 0 }: Props) {
  const { getGroupSavedGames, getGroupSessions } = useGroups()
  const [snapshots, setSnapshots] = useState<GroupPlanningSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (groups.length === 0) {
      queueMicrotask(() => {
        if (cancelled) return
        setSnapshots([])
        setLoading(false)
        setError(null)
      })

      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
    })

    Promise.all(
      groups.map(async (group) => {
        const [savedGames, sessions] = await Promise.all([
          getGroupSavedGames(group.id),
          getGroupSessions(group.id),
        ])

        const nextSession = [...sessions]
          .filter((session) => session.status === 'scheduled')
          .sort((a, b) => (a.scheduledFor ?? Number.MAX_SAFE_INTEGER) - (b.scheduledFor ?? Number.MAX_SAFE_INTEGER))[0] ?? null

        return {
          group,
          savedTemplateCount: savedGames.length,
          sessionCount: sessions.length,
          nextSession,
        }
      }),
    )
      .then((rows) => {
        if (!cancelled) {
          setSnapshots(rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load saved games and sessions yet.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [groups, getGroupSavedGames, getGroupSessions, refreshKey])

  const totalTemplates = snapshots.reduce((sum, snapshot) => sum + snapshot.savedTemplateCount, 0)
  const upcomingSessions = snapshots.filter((snapshot) => snapshot.nextSession).length

  return (
    <section className="space-y-4 rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Group planning</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Saved games act as reusable templates. Sessions are the specific nights or events those
            templates power.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <SummaryPill label="Templates" value={totalTemplates.toString()} tone="bg-amber-50 text-amber-700" />
          <SummaryPill label="Upcoming sessions" value={upcomingSessions.toString()} tone="bg-emerald-50 text-emerald-700" />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          Loading group planning details…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : snapshots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          Join or create a group to start saving game templates and scheduling sessions.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {snapshots.map((snapshot) => (
            <article key={snapshot.group.id} className="rounded-[24px] border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{snapshot.group.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{snapshot.group.member_count} members</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
                  {snapshot.savedTemplateCount} templates
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Next session</p>
                  {snapshot.nextSession ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-gray-900">{snapshot.nextSession.specificGame}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {snapshot.nextSession.scheduledFor
                          ? formatDateTime(snapshot.nextSession.scheduledFor)
                          : 'No time scheduled yet'}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500">No scheduled sessions yet.</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Total logged or planned sessions</span>
                  <span className="font-semibold text-gray-900">{snapshot.sessionCount}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SummaryPill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-full px-4 py-2 text-sm font-semibold ${tone}`}>
      {label}: {value}
    </div>
  )
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
