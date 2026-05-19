import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useFriends } from '../../context/FriendContext'
import { useGroups } from '../../context/GroupContext'
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

interface Props {
  availableGames: GameDefinition[]
  group: Group
  onCatalogGameCreated?: (game: GameDefinition) => void
  onPlanningChange?: () => void
  onClose: () => void
}

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

  const isOwner = user?.id === currentGroup.owner_id

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
        if (!cancelled) {
          setError('Failed to load this group.')
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
  }, [fetchFriends, getGroupDetail, getGroupSavedGames, getGroupSessions, group.id])

  function updateTemplateField<K extends keyof CreateGameInput>(key: K, value: CreateGameInput[K]) {
    setTemplateForm((current) => ({ ...current, [key]: value }))
  }

  async function handleRemove(memberId: number) {
    setError(null)
    setFeedback(null)

    try {
      await removeMember(group.id, memberId)
      setMembers((prev) => prev.filter((member) => member.id !== memberId))
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
      setSavedGames((prev) => sortSavedGames([savedGame, ...prev.filter((game) => game.gameId !== savedGame.gameId)]))
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
    if (validationError) {
      setError(validationError)
      return
    }

    setCreatingTemplate(true)

    let createdCatalogGame: GameDefinition | null = null

    try {
      createdCatalogGame = await createGame(templateForm)
      onCatalogGameCreated?.(createdCatalogGame)

      const savedGame = await saveGameToGroup(group.id, createdCatalogGame.id)
      setSavedGames((prev) => sortSavedGames([savedGame, ...prev.filter((game) => game.gameId !== savedGame.gameId)]))
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
      setSavedGames((prev) => prev.filter((game) => game.gameId !== gameId))
      setSessionForm((prev) => ({
        ...prev,
        gameId: prev.gameId === gameId ? null : prev.gameId,
      }))
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
      setBusyScoreKeys((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }
  }

  async function handleSetScore(sessionId: number, userId: number, currentScore: number) {
    const key = buildScoreKey(sessionId, userId)
    const rawValue = (scoreDrafts[key] ?? String(currentScore)).trim()

    if (!rawValue) {
      setError('Enter a score before saving it.')
      return
    }

    const parsedScore = Number(rawValue)
    if (!Number.isFinite(parsedScore)) {
      setError('Scores must be numeric values.')
      return
    }

    setBusyScoreKeys((current) => ({ ...current, [key]: true }))
    setError(null)

    try {
      const updatedScore = await updateSessionScore(group.id, sessionId, userId, { score: parsedScore })
      applyScoreUpdate(updatedScore)
      setScoreDrafts((current) => ({ ...current, [key]: String(updatedScore.score) }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set this score')
    } finally {
      setBusyScoreKeys((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
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
            ...session.scores.filter((score) => score.userId !== updatedScore.userId),
          ]),
        }
      }),
    )
  }

  const memberIds = new Set(members.map((member) => member.id))
  const invitableFriends = friends.filter((friend) => !memberIds.has(friend.id))
  const nonOwnerMembers = members.filter((member) => member.id !== currentGroup.owner_id)
  const savedGameIds = new Set(savedGames.map((game) => game.gameId))
  const unsavedCatalogGames = availableGames.filter((game) => !savedGameIds.has(game.id))
  const selectedSavedGame = savedGames.find((savedGame) => savedGame.gameId === sessionForm.gameId) ?? null
  const upcomingSessions = sessions.filter((session) => session.status === 'scheduled')
  const pastSessions = sessions.filter((session) => session.status !== 'scheduled')
  const templateCount = savedGames.length
  const upcomingCount = upcomingSessions.length
  const historyCount = pastSessions.length

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 px-3 py-3 sm:px-5 sm:py-5">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,_#fffdf8_0%,_#f8fafc_56%,_#f3f7ff_100%)] shadow-[0_40px_120px_-48px_rgba(15,23,42,0.75)]">
        <div className="border-b border-slate-200/80 bg-white/88 px-5 py-5 backdrop-blur sm:px-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Manage group
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
                People, templates, and live sessions are grouped into clearer work areas below so
                you can move from planning to scorekeeping without hunting through the modal.
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
            <StatCard label="Saved templates" value={String(templateCount)} detail={templateCount === 1 ? '1 reusable game' : `${templateCount} reusable games`} />
            <StatCard label="Upcoming sessions" value={String(upcomingCount)} detail={upcomingCount === 0 ? 'Nothing scheduled yet' : 'Ready for scorekeeping'} />
            <StatCard label="Past sessions" value={String(historyCount)} detail={historyCount === 0 ? 'No history yet' : 'Completed or cancelled'} />
          </div>
        </div>

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
              <section className="space-y-5">
                <Panel
                  title="Group roster"
                  subtitle="See who is in the group and manage member access from one place."
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {members.map((member) => (
                      <div key={member.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {member.name}
                              {member.id === currentGroup.owner_id && (
                                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                                  Owner
                                </span>
                              )}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-400">{member.email}</p>
                          </div>
                          {isOwner && member.id !== user?.id && (
                            <button
                              onClick={() => handleRemove(member.id)}
                              className="shrink-0 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                {isOwner && invitableFriends.length > 0 && (
                  <Panel
                    title="Invite friends"
                    subtitle="Only friends who are not already members appear here."
                  >
                    <div className="space-y-3">
                      {invitableFriends.map((friend) => (
                        <div key={friend.id} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{friend.name}</p>
                              <p className="mt-1 truncate text-xs text-slate-400">{friend.email}</p>
                            </div>
                            <button
                              onClick={() => handleInvite(friend.id)}
                              className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                            >
                              Invite
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {isOwner && nonOwnerMembers.length > 0 && (
                  <Panel
                    title="Ownership"
                    subtitle="Hand the group off cleanly before leaving or changing who manages it."
                  >
                    <div className="rounded-[24px] border border-amber-100 bg-amber-50/80 p-4">
                      <div className="flex flex-col gap-3">
                        <select
                          value={transferTarget ?? ''}
                          onChange={(event) => setTransferTarget(Number(event.target.value) || null)}
                          className={inputClassName}
                        >
                          <option value="">Pick a member…</option>
                          {nonOwnerMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleTransfer}
                          disabled={!transferTarget}
                          className="rounded-full bg-amber-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Transfer ownership
                        </button>
                      </div>
                    </div>
                  </Panel>
                )}

                {!isOwner && (
                  <Panel
                    title="Membership"
                    subtitle="You can leave the group here whenever you no longer need access."
                  >
                    <div className="rounded-[24px] border border-rose-100 bg-rose-50/80 p-4">
                      <button
                        onClick={handleLeave}
                        className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        Leave group
                      </button>
                    </div>
                  </Panel>
                )}
              </section>

              <section className="space-y-6">
                <Panel
                  title="Game templates"
                  subtitle="Keep reusable games visible and separate from the one-off session details that sit below."
                >
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50/85 p-5 shadow-sm">
                      <p className="text-sm font-semibold text-slate-900">Add from shared catalog</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Official and community-approved games stay reusable across every group.
                      </p>

                      <div className="mt-4 flex flex-col gap-3">
                        <select
                          value={selectedCatalogGameId ?? ''}
                          onChange={(event) => setSelectedCatalogGameId(Number(event.target.value) || null)}
                          className={inputClassName}
                        >
                          <option value="">Choose from the main catalog…</option>
                          {unsavedCatalogGames.map((game) => (
                            <option key={game.id} value={game.id}>
                              {game.specificGame} • {game.category}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleSaveTemplate}
                          disabled={!selectedCatalogGameId || savingCatalogTemplate}
                          className="rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingCatalogTemplate ? 'Saving…' : 'Save template'}
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleCreateTemplate} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Create a custom template</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            This publishes the game to Search and saves it to this group after the
                            standard appropriateness check.
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                          New
                        </span>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Game name">
                          <input
                            value={templateForm.name}
                            onChange={(event) => updateTemplateField('name', event.target.value)}
                            placeholder="Friday Night Knockout"
                            className={inputClassName}
                          />
                        </Field>

                        <Field label="Category">
                          <select
                            value={templateForm.category}
                            onChange={(event) => updateTemplateField('category', event.target.value)}
                            className={inputClassName}
                          >
                            {GAME_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Specific game">
                          <input
                            value={templateForm.specificGame}
                            onChange={(event) => updateTemplateField('specificGame', event.target.value)}
                            placeholder="Hearts, Cup Pong, Pick-Up Soccer"
                            className={inputClassName}
                          />
                        </Field>

                        <Field label="Players">
                          <input
                            value={templateForm.playerCount}
                            onChange={(event) => updateTemplateField('playerCount', event.target.value)}
                            placeholder="2-8"
                            className={inputClassName}
                          />
                        </Field>

                        <Field label="Rounds">
                          <input
                            value={templateForm.roundCount}
                            onChange={(event) => updateTemplateField('roundCount', event.target.value)}
                            placeholder="5 rounds or first to 21"
                            className={inputClassName}
                          />
                        </Field>
                      </div>

                      <div className="mt-4 space-y-4">
                        <Field label="Scoring system">
                          <textarea
                            rows={3}
                            value={templateForm.scoringSystem}
                            onChange={(event) => updateTemplateField('scoringSystem', event.target.value)}
                            placeholder="Higher score wins. Add 2 points for a clean make, subtract 1 for a foul."
                            className={`${inputClassName} resize-none`}
                          />
                        </Field>

                        <Field label="Rules">
                          <textarea
                            rows={6}
                            value={templateForm.rules}
                            onChange={(event) => updateTemplateField('rules', event.target.value)}
                            placeholder={RULES_PLACEHOLDER}
                            className={`${inputClassName} resize-none`}
                          />
                        </Field>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          disabled={creatingTemplate}
                          className="rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creatingTemplate ? 'Creating…' : 'Create and save template'}
                        </button>
                        <span className="text-sm text-slate-500">
                          Templates stay reusable. Sessions can still override the rules later.
                        </span>
                      </div>
                    </form>
                  </div>

                  <div className="mt-5 space-y-3">
                    {savedGames.length === 0 ? (
                      <EmptyState message="No game templates saved yet. Save one from the shared catalog or create a new one here." />
                    ) : (
                      savedGames.map((savedGame) => (
                        <article key={savedGame.gameId} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-slate-900">{savedGame.specificGame}</h3>
                                <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                                  Template
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-500">
                                {savedGame.category} • {savedGame.playerCount} players • {savedGame.roundCount}
                              </p>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <DetailBlock label="Scoring system" value={savedGame.scoringSystem} />
                                <DetailBlock label="Rules" value={savedGame.rules} />
                              </div>
                              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-gray-400">
                                Saved by {savedGame.savedByName ?? 'a teammate'}
                              </p>
                            </div>

                            <button
                              onClick={() => handleRemoveTemplate(savedGame.gameId)}
                              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              Remove template
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </Panel>

              <Panel
                title="Session setup"
                subtitle="Build a specific event from a saved template. Scheduling it is optional, so unscheduled sessions can still be tracked and scored."
              >
                <form onSubmit={handleCreateSession} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-slate-700">Template</span>
                      <select
                        value={sessionForm.gameId ?? ''}
                        onChange={(event) =>
                          setSessionForm((prev) => ({
                            ...prev,
                            gameId: Number(event.target.value) || null,
                          }))
                        }
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
                        onChange={(event) =>
                          setSessionForm((prev) => ({
                            ...prev,
                            status: event.target.value as GroupSessionStatus,
                          }))
                        }
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
                          setSessionForm((prev) => ({
                            ...prev,
                            shouldSchedule: event.target.checked,
                            scheduledFor: event.target.checked ? prev.scheduledFor : '',
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">Add a date and time</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Leave this off if you just want to log or prep a session without putting
                          it on the calendar yet.
                        </p>
                      </div>
                    </label>

                    {sessionForm.shouldSchedule && (
                      <label className="mt-4 block space-y-2">
                        <span className="text-sm font-medium text-slate-700">Scheduled for</span>
                        <input
                          type="datetime-local"
                          value={sessionForm.scheduledFor}
                          onChange={(event) =>
                            setSessionForm((prev) => ({
                              ...prev,
                              scheduledFor: event.target.value,
                            }))
                          }
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
                      onChange={(event) =>
                        setSessionForm((prev) => ({
                          ...prev,
                          ruleOverrides: event.target.value,
                        }))
                      }
                      placeholder="Optional: first to 15 instead of 21, no redemption round, house scoring tweak, etc."
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
                <SessionList
                  emptyMessage="No scheduled sessions yet."
                  label="Upcoming"
                  members={members}
                  sessions={upcomingSessions}
                  busyScoreKeys={busyScoreKeys}
                  scoreDrafts={scoreDrafts}
                  onAdjustScore={handleAdjustScore}
                  onDraftChange={(sessionId, userId, value) =>
                    setScoreDrafts((current) => ({
                      ...current,
                      [buildScoreKey(sessionId, userId)]: value,
                    }))
                  }
                  onSetScore={handleSetScore}
                />
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <SessionList
                    emptyMessage="No completed or cancelled sessions yet."
                    label="Recent history"
                    members={members}
                    sessions={pastSessions}
                    busyScoreKeys={busyScoreKeys}
                    scoreDrafts={scoreDrafts}
                    onAdjustScore={handleAdjustScore}
                    onDraftChange={(sessionId, userId, value) =>
                      setScoreDrafts((current) => ({
                        ...current,
                        [buildScoreKey(sessionId, userId)]: value,
                      }))
                    }
                    onSetScore={handleSetScore}
                  />
                </div>
              </Panel>

              <Panel
                title="Rules roadmap"
                subtitle="Rules are still freeform today, but this is the structure worth moving toward."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {['Setup', 'Turn flow', 'Scoring', 'Win condition', 'Safety notes'].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/85 px-4 py-3 text-sm font-medium text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
                </Panel>
              </section>
            </div>
          )}
        </div>
      </div>
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
    <section className="rounded-[30px] border border-slate-200/90 bg-white/88 p-5 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  )
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-semibold text-slate-950">{value}</span>
      </div>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
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
              <article key={session.id} className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
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

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                  <DetailBlock label="Scoring system" value={session.scoringSystem} />

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Scoreboard
                      </p>
                      <p className="text-xs text-slate-500">Use +/- for quick updates or set an exact total.</p>
                    </div>

                    <div className="mt-3 space-y-3">
                      {scoreboard.map((scoreRow) => {
                        const scoreKey = buildScoreKey(session.id, scoreRow.userId)
                        const currentValue = scoreDrafts[scoreKey] ?? String(scoreRow.score)
                        const isBusy = Boolean(busyScoreKeys[scoreKey])

                        return (
                          <div key={scoreKey} className="rounded-[22px] border border-slate-200 bg-white px-3 py-3 shadow-sm">
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
                                  onChange={(event) => onDraftChange(session.id, scoreRow.userId, event.target.value)}
                                  className="w-24 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/85 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

function StatusPill({ status }: { status: GroupSessionStatus }) {
  const tone = {
    scheduled: 'bg-emerald-50 text-emerald-700',
    completed: 'bg-sky-50 text-sky-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }[status]

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {status}
    </span>
  )
}

function buildSessionScoreboard(session: GroupGameSession, members: GroupMember[]) {
  const scoreboard = new Map<number, GroupGameSessionScore>()

  for (const scoreRow of session.scores) {
    scoreboard.set(scoreRow.userId, scoreRow)
  }

  for (const member of members) {
    if (!scoreboard.has(member.id)) {
      scoreboard.set(member.id, {
        sessionId: session.id,
        userId: member.id,
        userName: member.name,
        score: 0,
        updatedAt: session.createdAt,
      })
    }
  }

  return sortSessionScores([...scoreboard.values()])
}

function buildScoreKey(sessionId: number, userId: number) {
  return `${sessionId}:${userId}`
}

function sortSavedGames(games: SavedGroupGame[]) {
  return [...games].sort((a, b) => b.savedAt - a.savedAt)
}

function sortSessions(sessions: GroupGameSession[]) {
  return [...sessions].sort((a, b) => {
    const left = a.scheduledFor ?? a.createdAt
    const right = b.scheduledFor ?? b.createdAt
    return right - left
  })
}

function sortSessionScores(scores: GroupGameSessionScore[]) {
  return [...scores].sort((a, b) => b.score - a.score || a.userName.localeCompare(b.userName))
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const RULES_PLACEHOLDER = [
  'Setup:',
  'Turn flow:',
  'Scoring:',
  'Win condition:',
  'Safety notes:',
].join('\n')

const inputClassName =
  'w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
