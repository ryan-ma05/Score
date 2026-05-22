import type { FormEvent } from 'react'
import type { Group, GroupGameSession, GroupMember, SavedGroupGame } from '../../../context/GroupContext'
import type { GroupSessionStatus } from '../../../context/GroupContext'
import {
  buildScoreKey,
  buildSessionScoreboard,
  formatDateTime,
  inputClassName,
} from '../groupDetailUtils'
import { DetailBlock, EmptyState, Panel, StatusPill } from './shared'
import GameTimer from './GameTimer'

type SessionFormState = {
  gameId: number | null
  shouldSchedule: boolean
  scheduledFor: string
  status: GroupSessionStatus
  ruleOverrides: string
}

interface Props {
  group: Group
  sessions: GroupGameSession[]
  savedGames: SavedGroupGame[]
  members: GroupMember[]
  sessionForm: SessionFormState
  savingSession: boolean
  scoreDrafts: Record<string, string>
  busyScoreKeys: Record<string, boolean>
  onUpdateSessionForm: (patch: Partial<SessionFormState>) => void
  onCreateSession: (event: FormEvent<HTMLFormElement>) => void
  onAdjustScore: (sessionId: number, userId: number, delta: number) => Promise<void>
  onSetScore: (sessionId: number, userId: number, currentScore: number) => Promise<void>
  onDraftChange: (sessionId: number, userId: number, value: string) => void
  onUpdateSessionStatus: (sessionId: number, status: GroupSessionStatus) => void
}

export default function GroupSessionsPanel({
  sessions,
  savedGames,
  members,
  sessionForm,
  savingSession,
  scoreDrafts,
  busyScoreKeys,
  onUpdateSessionForm,
  onCreateSession,
  onAdjustScore,
  onSetScore,
  onDraftChange,
  onUpdateSessionStatus,
}: Props) {
  const selectedSavedGame = savedGames.find((g) => g.gameId === sessionForm.gameId) ?? null
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled')
  const pastSessions = sessions.filter((s) => s.status !== 'scheduled')

  return (
    <div className="space-y-6">
      <Panel
        title="Session setup"
        subtitle="Build a specific event from a saved template. Scheduling it is optional, so unscheduled sessions can still be tracked and scored."
      >
        <form onSubmit={onCreateSession} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Template</span>
              <select
                value={sessionForm.gameId ?? ''}
                onChange={(event) => onUpdateSessionForm({ gameId: Number(event.target.value) || null })}
                className={inputClassName}
              >
                <option value="">Choose a saved template…</option>
                {savedGames.map((savedGame) => (
                  <option key={savedGame.gameId} value={savedGame.gameId}>
                    {savedGame.specificGame}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                value={sessionForm.status}
                onChange={(event) => onUpdateSessionForm({ status: event.target.value as GroupSessionStatus })}
                className={inputClassName}
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>

          {selectedSavedGame && (
            <div className="rounded-[24px] border border-amber-100 bg-amber-50/90 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                Template scoring system
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-900">{selectedSavedGame.scoringSystem}</p>
            </div>
          )}

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={sessionForm.shouldSchedule}
                onChange={(event) =>
                  onUpdateSessionForm({
                    shouldSchedule: event.target.checked,
                    scheduledFor: event.target.checked ? sessionForm.scheduledFor : '',
                  })
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Add a date and time</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Leave this off if you just want to log or prep a session without putting it on the
                  calendar yet.
                </p>
              </div>
            </label>

            {sessionForm.shouldSchedule && (
              <label className="mt-4 block space-y-2">
                <span className="text-sm font-medium text-slate-700">Scheduled for</span>
                <input
                  type="datetime-local"
                  value={sessionForm.scheduledFor}
                  onChange={(event) => onUpdateSessionForm({ scheduledFor: event.target.value })}
                  className={inputClassName}
                />
              </label>
            )}
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Rule overrides</span>
            <textarea
              rows={4}
              value={sessionForm.ruleOverrides}
              onChange={(event) => onUpdateSessionForm({ ruleOverrides: event.target.value })}
              placeholder="Optional session-specific rule changes"
              className={`${inputClassName} resize-none`}
            />
          </label>

          <button
            type="submit"
            disabled={savingSession || savedGames.length === 0}
            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingSession ? 'Saving…' : 'Create session'}
          </button>
        </form>
      </Panel>

      <Panel
        title="Session scoreboard"
        subtitle="Each session card keeps the template rules visible while making score edits quicker to scan and use."
      >
        <div className="space-y-6">
          <GameTimer />

          <SessionList
            label="Upcoming"
            emptyMessage="No scheduled sessions yet."
            sessions={upcomingSessions}
            members={members}
            busyScoreKeys={busyScoreKeys}
            scoreDrafts={scoreDrafts}
            onAdjustScore={onAdjustScore}
            onDraftChange={onDraftChange}
            onSetScore={onSetScore}
            onUpdateSessionStatus={onUpdateSessionStatus}
          />

          <div className="border-t border-slate-200 pt-6">
            <SessionList
              label="Recent history"
              emptyMessage="No completed or cancelled sessions yet."
              sessions={pastSessions}
              members={members}
              busyScoreKeys={busyScoreKeys}
              scoreDrafts={scoreDrafts}
              onAdjustScore={onAdjustScore}
              onDraftChange={onDraftChange}
              onSetScore={onSetScore}
            />
          </div>
        </div>
      </Panel>
    </div>
  )
}

function SessionList({
  label,
  sessions,
  members,
  emptyMessage,
  busyScoreKeys,
  scoreDrafts,
  onAdjustScore,
  onDraftChange,
  onSetScore,
  onUpdateSessionStatus,
}: {
  label: string
  sessions: GroupGameSession[]
  members: GroupMember[]
  emptyMessage: string
  busyScoreKeys: Record<string, boolean>
  scoreDrafts: Record<string, string>
  onAdjustScore: (sessionId: number, userId: number, delta: number) => Promise<void>
  onDraftChange: (sessionId: number, userId: number, value: string) => void
  onSetScore: (sessionId: number, userId: number, currentScore: number) => Promise<void>
  onUpdateSessionStatus?: (sessionId: number, status: GroupSessionStatus) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h4 className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
          {label}
        </h4>
        <span className="text-xs text-slate-400">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      {sessions.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="mt-3 space-y-3">
          {sessions.map((session) => {
            const scoreboard = buildSessionScoreboard(session, members)

            return (
              <article
                key={session.id}
                className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">{session.specificGame}</p>
                      <StatusPill status={session.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {session.category} •{' '}
                      {session.scheduledFor ? formatDateTime(session.scheduledFor) : 'No time scheduled'}
                    </p>
                    {session.ruleOverrides && (
                      <div className="mt-3 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Session overrides
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{session.ruleOverrides}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Created by {session.createdByName ?? 'a teammate'}
                  </p>
                </div>

                {onUpdateSessionStatus && (
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => onUpdateSessionStatus(session.id, 'completed')}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      Mark completed
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSessionStatus(session.id, 'cancelled')}
                      className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Cancel session
                    </button>
                  </div>
                )}

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                  <DetailBlock label="Scoring system" value={session.scoringSystem} />

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Scoreboard
                      </p>
                      <p className="text-xs text-slate-500">
                        Use +/- for quick updates or set an exact total.
                      </p>
                    </div>

                    <div className="mt-3 space-y-3">
                      {scoreboard.map((scoreRow) => {
                        const scoreKey = buildScoreKey(session.id, scoreRow.userId)
                        const currentValue = scoreDrafts[scoreKey] ?? String(scoreRow.score)
                        const isBusy = Boolean(busyScoreKeys[scoreKey])

                        return (
                          <div
                            key={scoreKey}
                            className="rounded-[24px] border border-slate-200 bg-white px-3 py-3 shadow-sm"
                          >
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{scoreRow.userName}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                  Updated {formatDateTime(scoreRow.updatedAt)}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                <button
                                  type="button"
                                  onClick={() => void onAdjustScore(session.id, scoreRow.userId, -1)}
                                  disabled={isBusy}
                                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  -1
                                </button>
                                <span className="min-w-14 rounded-full bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white">
                                  {scoreRow.score}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void onAdjustScore(session.id, scoreRow.userId, 1)}
                                  disabled={isBusy}
                                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  +1
                                </button>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  step="1"
                                  value={currentValue}
                                  onChange={(event) =>
                                    onDraftChange(session.id, scoreRow.userId, event.target.value)
                                  }
                                  className="w-24 rounded-[24px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                />
                                <button
                                  type="button"
                                  onClick={() => void onSetScore(session.id, scoreRow.userId, scoreRow.score)}
                                  disabled={isBusy}
                                  className="rounded-full bg-amber-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Set
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
