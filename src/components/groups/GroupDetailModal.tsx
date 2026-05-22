import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useFriends } from '../../context/FriendContext'
import { useGroups } from '../../context/GroupContext'
import { getSocket, joinSession as socketJoinSession, leaveSession as socketLeaveSession } from '../../lib/socket'
import type {
  Group,
  GroupGameSession,
  GroupGameSessionScore,
  GroupMember,
  GroupSessionStatus,
  SavedGroupGame,
} from '../../context/GroupContext'
import { ApiError } from '../../lib/api'
import {
  GAME_CATEGORIES,
  validateGameSubmission,
  type CreateGameInput,
  type GameDefinition,
} from '../../lib/content'
import { createGame } from '../../lib/contentApi'
import {
  buildScoreKey,
  sortSavedGames,
  sortSessions,
  sortSessionScores,
} from './groupDetailUtils'
import GroupRosterPanel from './panels/GroupRosterPanel'
import GroupGamesPanel from './panels/GroupGamesPanel'
import GroupSessionsPanel from './panels/GroupSessionsPanel'
import GroupLeaderboardPanel from './panels/GroupLeaderboardPanel'
import GroupScoreHistoryPanel from './panels/GroupScoreHistoryPanel'
import GroupTournamentsPanel from './panels/GroupTournamentsPanel'
import { StatCard } from './panels/shared'

interface Props {
  availableGames: GameDefinition[]
  group: Group
  onCatalogGameCreated?: (game: GameDefinition) => void
  onPlanningChange?: () => void
  onClose: () => void
}

type RightTab = 'sessions' | 'games' | 'leaderboard' | 'history' | 'tournaments'

const RIGHT_TABS: { label: string; value: RightTab }[] = [
  { label: 'Sessions', value: 'sessions' },
  { label: 'Games', value: 'games' },
  { label: 'Leaderboard', value: 'leaderboard' },
  { label: 'History', value: 'history' },
  { label: 'Tournaments', value: 'tournaments' },
]

type SessionFormState = {
  gameId: number | null
  shouldSchedule: boolean
  scheduledFor: string
  status: GroupSessionStatus
  ruleOverrides: string
}

const EMPTY_SESSION_FORM: SessionFormState = {
  gameId: null,
  shouldSchedule: false,
  scheduledFor: '',
  status: 'scheduled',
  ruleOverrides: '',
}

const EMPTY_TEMPLATE_FORM: CreateGameInput = {
  name: '',
  playerCount: '',
  roundCount: '',
  scoringSystem: '',
  rules: '',
  category: GAME_CATEGORIES[0],
  specificGame: '',
}

export default function GroupDetailModal({
  availableGames,
  group,
  onCatalogGameCreated,
  onPlanningChange,
  onClose,
}: Props) {
  const { user } = useAuth()
  const {
    createGroupSession,
    getGroupDetail,
    getGroupSavedGames,
    getGroupSessions,
    inviteToGroup,
    leaveGroup,
    removeMember,
    removeSavedGame,
    saveGameToGroup,
    transferOwnership,
    updateSessionScore,
    updateSessionStatus,
  } = useGroups()
  const { fetchFriends, friends } = useFriends()
  const [members, setMembers] = useState<GroupMember[]>([])
  const [savedGames, setSavedGames] = useState<SavedGroupGame[]>([])
  const [sessions, setSessions] = useState<GroupGameSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [currentGroup, setCurrentGroup] = useState(group)
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const [selectedCatalogGameId, setSelectedCatalogGameId] = useState<number | null>(null)
  const [sessionForm, setSessionForm] = useState<SessionFormState>(EMPTY_SESSION_FORM)
  const [templateForm, setTemplateForm] = useState<CreateGameInput>(EMPTY_TEMPLATE_FORM)
  const [savingCatalogTemplate, setSavingCatalogTemplate] = useState(false)
  const [creatingTemplate, setCreatingTemplate] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({})
  const [busyScoreKeys, setBusyScoreKeys] = useState<Record<string, boolean>>({})
  const [rightTab, setRightTab] = useState<RightTab>('sessions')

  const isOwner = user?.id === currentGroup.owner_id

  // Keep a stable ref to applyScoreUpdate so the socket listener never goes stale
  const applyScoreUpdateRef = useRef(applyScoreUpdate)
  applyScoreUpdateRef.current = applyScoreUpdate

  // Subscribe to live score events from the server
  useEffect(() => {
    const socket = getSocket()

    function handleScoreUpdate(raw: {
      session_id: number
      user_id: number
      user_name: string
      score: number
      updated_at: number
    }) {
      applyScoreUpdateRef.current({
        sessionId: raw.session_id,
        userId: raw.user_id,
        userName: raw.user_name,
        score: raw.score,
        updatedAt: raw.updated_at > 1e12 ? raw.updated_at : raw.updated_at * 1000,
      })
    }

    socket.on('score-updated', handleScoreUpdate)
    return () => { socket.off('score-updated', handleScoreUpdate) }
  }, [])

  // Join socket rooms for newly loaded sessions (incremental — never leaves mid-session)
  const joinedRooms = useRef(new Set<number>())
  useEffect(() => {
    for (const session of sessions) {
      if (!joinedRooms.current.has(session.id)) {
        socketJoinSession(session.id)
        joinedRooms.current.add(session.id)
      }
    }
  }, [sessions])

  // Leave all rooms only when this modal unmounts
  useEffect(() => {
    return () => {
      for (const id of joinedRooms.current) {
        socketLeaveSession(id)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getGroupDetail(group.id),
      getGroupSavedGames(group.id),
      getGroupSessions(group.id),
      fetchFriends().catch(() => undefined),
    ])
      .then(([detail, saved, sessionRows]) => {
        if (cancelled) return
        setCurrentGroup(detail.group)
        setMembers(detail.members)
        setSavedGames(sortSavedGames(saved))
        setSessions(sortSessions(sessionRows))
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load this group.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [fetchFriends, getGroupDetail, getGroupSavedGames, getGroupSessions, group.id])

  function updateTemplateField<K extends keyof CreateGameInput>(key: K, value: CreateGameInput[K]) {
    setTemplateForm((current) => ({ ...current, [key]: value }))
  }

  function handleCopyJoinCode() {
    void navigator.clipboard.writeText(currentGroup.join_code)
    setFeedback('Join code copied.')
  }

  async function handleRemove(memberId: number) {
    setError(null)
    setFeedback(null)
    try {
      await removeMember(group.id, memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      setFeedback('Member removed from the group.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member')
    }
  }

  async function handleTransfer() {
    if (!transferTarget) return
    setError(null)
    setFeedback(null)
    try {
      await transferOwnership(group.id, transferTarget)
      setCurrentGroup((prev) => ({ ...prev, owner_id: transferTarget }))
      setTransferTarget(null)
      setFeedback('Ownership transferred.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to transfer ownership')
    }
  }

  async function handleLeave() {
    setError(null)
    setFeedback(null)
    try {
      await leaveGroup(group.id)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to leave group')
    }
  }

  async function handleInvite(friendId: number) {
    setError(null)
    setFeedback(null)
    try {
      await inviteToGroup(group.id, friendId)
      setFeedback('Invite sent.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send invite')
    }
  }

  async function handleSaveTemplate() {
    if (!selectedCatalogGameId) return
    setSavingCatalogTemplate(true)
    setError(null)
    setFeedback(null)
    try {
      const savedGame = await saveGameToGroup(group.id, selectedCatalogGameId)
      setSavedGames((prev) => sortSavedGames([savedGame, ...prev.filter((g) => g.gameId !== savedGame.gameId)]))
      setSelectedCatalogGameId(null)
      setSessionForm((prev) => ({ ...prev, gameId: savedGame.gameId }))
      setFeedback('Game template saved for this group.')
      onPlanningChange?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this game template')
    } finally {
      setSavingCatalogTemplate(false)
    }
  }

  async function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setFeedback(null)

    const validationError = validateGameSubmission(templateForm)
    if (validationError) { setError(validationError); return }

    setCreatingTemplate(true)
    let createdCatalogGame: GameDefinition | null = null

    try {
      createdCatalogGame = await createGame(templateForm)
      onCatalogGameCreated?.(createdCatalogGame)
      const savedGame = await saveGameToGroup(group.id, createdCatalogGame.id)
      setSavedGames((prev) => sortSavedGames([savedGame, ...prev.filter((g) => g.gameId !== savedGame.gameId)]))
      setSessionForm((prev) => ({ ...prev, gameId: savedGame.gameId }))
      setTemplateForm(EMPTY_TEMPLATE_FORM)
      setFeedback('Custom game template created, approved, and saved to this group.')
      onPlanningChange?.()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not create this custom template'
      setError(
        createdCatalogGame
          ? `${message} The game is in the shared catalog, so you can still save it from the picker above.`
          : message,
      )
    } finally {
      setCreatingTemplate(false)
    }
  }

  async function handleRemoveTemplate(gameId: number) {
    setError(null)
    setFeedback(null)
    try {
      await removeSavedGame(group.id, gameId)
      setSavedGames((prev) => prev.filter((g) => g.gameId !== gameId))
      setSessionForm((prev) => ({ ...prev, gameId: prev.gameId === gameId ? null : prev.gameId }))
      setFeedback('Saved template removed from the group.')
      onPlanningChange?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this saved template')
    }
  }

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionForm.gameId) {
      setError('Save at least one game template, then choose it for the session.')
      return
    }
    setSavingSession(true)
    setError(null)
    setFeedback(null)
    try {
      const createdSession = await createGroupSession(group.id, {
        gameId: sessionForm.gameId,
        scheduledFor: sessionForm.shouldSchedule ? sessionForm.scheduledFor || null : null,
        status: sessionForm.status,
        ruleOverrides: sessionForm.ruleOverrides,
      })
      setSessions((prev) => sortSessions([createdSession, ...prev]))
      setSessionForm((prev) => ({ ...EMPTY_SESSION_FORM, gameId: prev.gameId }))
      setFeedback('Group session saved.')
      onPlanningChange?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this session')
    } finally {
      setSavingSession(false)
    }
  }

  async function handleUpdateSessionStatus(sessionId: number, status: GroupSessionStatus) {
    setError(null)
    setFeedback(null)
    try {
      const updatedSession = await updateSessionStatus(group.id, sessionId, status)
      setSessions((prev) =>
        sortSessions(prev.map((s) => (s.id === sessionId ? { ...s, status: updatedSession.status } : s)))
      )
      setFeedback(status === 'completed' ? 'Session marked as completed.' : 'Session cancelled.')
      onPlanningChange?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update session status')
    }
  }

  async function handleAdjustScore(sessionId: number, userId: number, delta: number) {
    const key = buildScoreKey(sessionId, userId)
    setBusyScoreKeys((current) => ({ ...current, [key]: true }))
    setError(null)
    try {
      const updatedScore = await updateSessionScore(group.id, sessionId, userId, { delta })
      applyScoreUpdate(updatedScore)
      setScoreDrafts((current) => ({ ...current, [key]: String(updatedScore.score) }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this score')
    } finally {
      setBusyScoreKeys((current) => { const next = { ...current }; delete next[key]; return next })
    }
  }

  async function handleSetScore(sessionId: number, userId: number, currentScore: number) {
    const key = buildScoreKey(sessionId, userId)
    const rawValue = (scoreDrafts[key] ?? String(currentScore)).trim()
    if (!rawValue) { setError('Enter a score before saving it.'); return }
    const parsedScore = Number(rawValue)
    if (!Number.isFinite(parsedScore)) { setError('Scores must be numeric values.'); return }

    setBusyScoreKeys((current) => ({ ...current, [key]: true }))
    setError(null)
    try {
      const updatedScore = await updateSessionScore(group.id, sessionId, userId, { score: parsedScore })
      applyScoreUpdate(updatedScore)
      setScoreDrafts((current) => ({ ...current, [key]: String(updatedScore.score) }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set this score')
    } finally {
      setBusyScoreKeys((current) => { const next = { ...current }; delete next[key]; return next })
    }
  }

  function applyScoreUpdate(updatedScore: GroupGameSessionScore) {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== updatedScore.sessionId) return session
        return {
          ...session,
          scores: sortSessionScores([
            updatedScore,
            ...session.scores.filter((s) => s.userId !== updatedScore.userId),
          ]),
        }
      }),
    )
  }

  const memberIds = new Set(members.map((m) => m.id))
  const invitableFriends = friends.filter((f) => !memberIds.has(f.id))
  const nonOwnerMembers = members.filter((m) => m.id !== currentGroup.owner_id)
  const savedGameIds = new Set(savedGames.map((g) => g.gameId))
  const unsavedCatalogGames = availableGames.filter((g) => !savedGameIds.has(g.id))
  const upcomingCount = sessions.filter((s) => s.status === 'scheduled').length
  const historyCount = sessions.filter((s) => s.status !== 'scheduled').length

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 px-3 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8fafc_56%,_#f3f7ff_100%)] shadow-[0_40px_120px_-48px_rgba(15,23,42,0.75)]">
        {/* Header */}
        <div className="border-b border-slate-200/80 bg-white/88 px-5 py-5 backdrop-blur sm:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  {isOwner ? 'Manage group' : 'Group details'}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Code {currentGroup.join_code}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{currentGroup.name}</h2>
                {currentGroup.description && (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{currentGroup.description}</p>
                )}
              </div>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                {isOwner
                  ? 'Owner controls, member tools, templates, and live sessions are grouped together below so you can run the group from one place.'
                  : 'Group details, sessions, and shared game templates are grouped together below so you can participate without losing context.'}
              </p>
            </div>

            <button
              onClick={onClose}
              className="self-start rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Members" value={String(members.length)} detail={isOwner ? 'Owner controls active' : 'Member access'} />
            <StatCard label="Saved templates" value={String(savedGames.length)} detail={savedGames.length === 1 ? '1 reusable game' : `${savedGames.length} reusable games`} />
            <StatCard label="Upcoming sessions" value={String(upcomingCount)} detail={upcomingCount === 0 ? 'Nothing scheduled yet' : 'Ready for scorekeeping'} />
            <StatCard label="Past sessions" value={String(historyCount)} detail={historyCount === 0 ? 'No history yet' : 'Completed or cancelled'} />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {error && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
              {error}
            </p>
          )}
          {feedback && (
            <p className={`${error ? 'mt-4' : ''} rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm`}>
              {feedback}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] 2xl:grid-cols-[minmax(340px,0.76fr)_minmax(0,1.24fr)]">
              <GroupRosterPanel
                group={currentGroup}
                members={members}
                isOwner={isOwner}
                currentUserId={user?.id ?? -1}
                invitableFriends={invitableFriends}
                nonOwnerMembers={nonOwnerMembers}
                transferTarget={transferTarget}
                onCopyCode={handleCopyJoinCode}
                onRemove={handleRemove}
                onInvite={handleInvite}
                onSetTransferTarget={setTransferTarget}
                onTransfer={handleTransfer}
                onLeave={handleLeave}
              />

              <section className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-1.5 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5">
                    {RIGHT_TABS.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setRightTab(tab.value)}
                        className={[
                          'rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                          rightTab === tab.value
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:bg-white/60 hover:text-slate-700',
                        ].join(' ')}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {rightTab === 'games' && (
                  <GroupGamesPanel
                    group={currentGroup}
                    savedGames={savedGames}
                    unsavedCatalogGames={unsavedCatalogGames}
                    selectedCatalogGameId={selectedCatalogGameId}
                    templateForm={templateForm}
                    savingCatalogTemplate={savingCatalogTemplate}
                    creatingTemplate={creatingTemplate}
                    onSelectCatalogGame={setSelectedCatalogGameId}
                    onSaveTemplate={handleSaveTemplate}
                    onUpdateTemplateField={updateTemplateField}
                    onCreateTemplate={handleCreateTemplate}
                    onRemoveTemplate={handleRemoveTemplate}
                  />
                )}

                {rightTab === 'sessions' && (
                  <GroupSessionsPanel
                    group={currentGroup}
                    sessions={sessions}
                    savedGames={savedGames}
                    members={members}
                    sessionForm={sessionForm}
                    savingSession={savingSession}
                    scoreDrafts={scoreDrafts}
                    busyScoreKeys={busyScoreKeys}
                    onUpdateSessionForm={(patch) => setSessionForm((prev) => ({ ...prev, ...patch }))}
                    onCreateSession={handleCreateSession}
                    onAdjustScore={handleAdjustScore}
                    onSetScore={handleSetScore}
                    onDraftChange={(sessionId, userId, value) =>
                      setScoreDrafts((current) => ({
                        ...current,
                        [buildScoreKey(sessionId, userId)]: value,
                      }))
                    }
                    onUpdateSessionStatus={handleUpdateSessionStatus}
                  />
                )}

                {rightTab === 'leaderboard' && <GroupLeaderboardPanel groupId={currentGroup.id} />}

                {rightTab === 'history' && <GroupScoreHistoryPanel groupId={currentGroup.id} />}

                {rightTab === 'tournaments' && (
                  <GroupTournamentsPanel
                    group={currentGroup}
                    members={members}
                    isOwner={isOwner}
                  />
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
