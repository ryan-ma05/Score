import { useEffect, useState } from 'react'
import { apiFetch } from '../../../lib/api'
import type { Group, GroupMember } from '../../../context/GroupContext'
import { Panel, EmptyState } from './shared'

type TournamentType = 'single_elimination' | 'double_elimination' | 'round_robin'
type TournamentStatus = 'pending' | 'active' | 'completed'
type MatchStatus = 'pending' | 'bye' | 'active' | 'completed'

interface TournamentMatch {
  id: number
  tournament_id: number
  round: number
  match_number: number
  bracket_side: 'winners' | 'losers' | 'final'
  player1_id: number | null
  player2_id: number | null
  player1_name: string | null
  player2_name: string | null
  winner_id: number | null
  winner_name: string | null
  score1: number | null
  score2: number | null
  status: MatchStatus
  next_match_id: number | null
}

interface TournamentParticipant {
  user_id: number
  user_name: string
  seed: number | null
}

interface Tournament {
  id: number
  group_id: number
  name: string
  type: TournamentType
  status: TournamentStatus
  created_by: number | null
  created_by_name?: string
  created_at: number
  participant_count?: number
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
}

interface Props {
  group: Group
  members: GroupMember[]
  isOwner: boolean
}

const TYPE_LABELS: Record<TournamentType, string> = {
  single_elimination: 'Single Elim',
  double_elimination: 'Double Elim',
  round_robin: 'Round Robin',
}

const STATUS_COLORS: Record<TournamentStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
}

export default function GroupTournamentsPanel({ group, members, isOwner }: Props) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [createName, setCreateName] = useState('')
  const [createType, setCreateType] = useState<TournamentType>('single_elimination')
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([])
  const [creating, setCreating] = useState(false)

  // Match result entry
  const [reportingMatchId, setReportingMatchId] = useState<number | null>(null)
  const [reportWinnerId, setReportWinnerId] = useState<number | ''>('')
  const [reportScore1, setReportScore1] = useState('')
  const [reportScore2, setReportScore2] = useState('')
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch<{ tournaments: Tournament[] }>(`/api/groups/${group.id}/tournaments`)
      .then(({ tournaments: rows }) => { if (!cancelled) setTournaments(rows) })
      .catch(() => { if (!cancelled) setError('Failed to load tournaments.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [group.id])

  async function loadDetail(tournamentId: number) {
    const { tournament } = await apiFetch<{ tournament: Tournament }>(`/api/groups/${group.id}/tournaments/${tournamentId}`)
    setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? tournament : t)))
    return tournament
  }

  function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      void loadDetail(id)
    }
  }

  function toggleParticipant(userId: number) {
    setSelectedParticipants((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function handleCreate() {
    if (!createName.trim()) { setError('Tournament name is required.'); return }
    if (selectedParticipants.length < 2) { setError('Select at least 2 participants.'); return }

    setCreating(true)
    setError(null)
    setFeedback(null)
    try {
      const { tournament } = await apiFetch<{ tournament: Tournament }>(`/api/groups/${group.id}/tournaments`, {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim(), type: createType, participantIds: selectedParticipants }),
      })
      setTournaments((prev) => [tournament, ...prev])
      setCreateName('')
      setCreateType('single_elimination')
      setSelectedParticipants([])
      setShowCreate(false)
      setFeedback('Tournament created.')
      setExpandedId(tournament.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create tournament.')
    } finally {
      setCreating(false)
    }
  }

  async function handleStart(tournamentId: number) {
    setError(null)
    setFeedback(null)
    try {
      const { tournament } = await apiFetch<{ tournament: Tournament }>(`/api/groups/${group.id}/tournaments/${tournamentId}/start`, {
        method: 'POST',
      })
      setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? tournament : t)))
      setFeedback('Tournament started. Bracket generated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start tournament.')
    }
  }

  async function handleReportMatch(tournament: Tournament) {
    if (!reportingMatchId || !reportWinnerId) { setError('Select a winner.'); return }
    setReporting(true)
    setError(null)
    setFeedback(null)
    try {
      const { tournament: updated } = await apiFetch<{ tournament: Tournament }>(
        `/api/groups/${group.id}/tournaments/${tournament.id}/matches/${reportingMatchId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            winnerId: reportWinnerId,
            score1: reportScore1 !== '' ? Number(reportScore1) : undefined,
            score2: reportScore2 !== '' ? Number(reportScore2) : undefined,
          }),
        }
      )
      setTournaments((prev) => prev.map((t) => (t.id === tournament.id ? updated : t)))
      setReportingMatchId(null)
      setReportWinnerId('')
      setReportScore1('')
      setReportScore2('')
      setFeedback(updated.status === 'completed' ? 'Tournament completed!' : 'Match result recorded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not report match result.')
    } finally {
      setReporting(false)
    }
  }

  async function handleDelete(tournamentId: number) {
    setError(null)
    try {
      await apiFetch(`/api/groups/${group.id}/tournaments/${tournamentId}`, { method: 'DELETE' })
      setTournaments((prev) => prev.filter((t) => t.id !== tournamentId))
      if (expandedId === tournamentId) setExpandedId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete tournament.')
    }
  }

  const expandedTournament = tournaments.find((t) => t.id === expandedId) ?? null

  return (
    <Panel
      title="Tournaments"
      subtitle="Run single elimination, double elimination, or round robin competitions within this group."
    >
      {error && (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {feedback && (
        <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </p>
      )}

      {isOwner && (
        <div className="mb-4">
          {showCreate ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-800">New tournament</p>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Name</span>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Friday Night Bracket"
                  className="w-full rounded-[24px] border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Format</span>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as TournamentType)}
                  className="w-full rounded-[24px] border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                >
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                  <option value="round_robin">Round Robin</option>
                </select>
              </label>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Participants ({selectedParticipants.length} selected)
                </p>
                <div className="max-h-48 overflow-y-auto rounded-[24px] border border-slate-200 bg-white">
                  {members.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(member.id)}
                        onChange={() => toggleParticipant(member.id)}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                      />
                      <span className="text-sm text-slate-800">{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  className="rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create tournament'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setError(null) }}
                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-700"
            >
              + New tournament
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : tournaments.length === 0 ? (
        <EmptyState message="No tournaments yet. Create one to get started." />
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <div key={t.id} className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleExpand(t.id)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[t.status]}`}>
                      {t.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {TYPE_LABELS[t.type]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {t.participant_count ?? t.participants?.length ?? 0} players
                  </p>
                </div>
                <span className="text-slate-400">{expandedId === t.id ? '▲' : '▼'}</span>
              </button>

              {expandedId === t.id && t.participants && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
                  {/* Owner actions */}
                  {isOwner && t.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleStart(t.id)}
                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                      >
                        Start tournament
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t.id)}
                        className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {/* Participants */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-2">
                      Participants
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {t.participants.map((p) => (
                        <span
                          key={p.user_id}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {p.user_name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bracket or standings */}
                  {t.matches && t.matches.length > 0 && (
                    t.type === 'round_robin'
                      ? <RoundRobinView matches={t.matches} participants={t.participants} />
                      : <EliminationBracketView
                          matches={t.matches}
                          tournament={t}
                          isOwner={isOwner}
                          reportingMatchId={reportingMatchId}
                          reportWinnerId={reportWinnerId}
                          reportScore1={reportScore1}
                          reportScore2={reportScore2}
                          reporting={reporting}
                          onStartReport={(matchId) => {
                            setReportingMatchId(matchId)
                            setReportWinnerId('')
                            setReportScore1('')
                            setReportScore2('')
                          }}
                          onSetWinner={(id) => setReportWinnerId(id)}
                          onSetScore1={setReportScore1}
                          onSetScore2={setReportScore2}
                          onCancelReport={() => setReportingMatchId(null)}
                          onSubmitReport={() => void handleReportMatch(t)}
                        />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

// ─── Elimination Bracket View ─────────────────────────────────────────────

function EliminationBracketView({
  matches,
  tournament,
  isOwner,
  reportingMatchId,
  reportWinnerId,
  reportScore1,
  reportScore2,
  reporting,
  onStartReport,
  onSetWinner,
  onSetScore1,
  onSetScore2,
  onCancelReport,
  onSubmitReport,
}: {
  matches: TournamentMatch[]
  tournament: Tournament
  isOwner: boolean
  reportingMatchId: number | null
  reportWinnerId: number | ''
  reportScore1: string
  reportScore2: string
  reporting: boolean
  onStartReport: (matchId: number) => void
  onSetWinner: (id: number) => void
  onSetScore1: (v: string) => void
  onSetScore2: (v: string) => void
  onCancelReport: () => void
  onSubmitReport: () => void
}) {
  const sides = Array.from(new Set(matches.map((m) => m.bracket_side)))
  const sideOrder = ['winners', 'losers', 'final'] as const

  return (
    <div className="space-y-6">
      {sideOrder.filter((s) => sides.includes(s)).map((side) => {
        const sideMatches = matches.filter((m) => m.bracket_side === side)
        const rounds = Array.from(new Set(sideMatches.map((m) => m.round))).sort((a, b) => a - b)

        return (
          <div key={side}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {side === 'winners' ? 'Winners bracket' : side === 'losers' ? 'Losers bracket' : 'Grand Final'}
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {rounds.map((round) => {
                const roundMatches = sideMatches.filter((m) => m.round === round)
                return (
                  <div key={round} className="min-w-[200px] space-y-3">
                    <p className="text-center text-xs font-medium text-slate-400">
                      {side === 'final' ? 'Final' : `Round ${round}`}
                    </p>
                    {roundMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        tournament={tournament}
                        isOwner={isOwner}
                        reportingMatchId={reportingMatchId}
                        reportWinnerId={reportWinnerId}
                        reportScore1={reportScore1}
                        reportScore2={reportScore2}
                        reporting={reporting}
                        onStartReport={onStartReport}
                        onSetWinner={onSetWinner}
                        onSetScore1={onSetScore1}
                        onSetScore2={onSetScore2}
                        onCancelReport={onCancelReport}
                        onSubmitReport={onSubmitReport}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MatchCard({
  match,
  tournament,
  isOwner,
  reportingMatchId,
  reportWinnerId,
  reportScore1,
  reportScore2,
  reporting,
  onStartReport,
  onSetWinner,
  onSetScore1,
  onSetScore2,
  onCancelReport,
  onSubmitReport,
}: {
  match: TournamentMatch
  tournament: Tournament
  isOwner: boolean
  reportingMatchId: number | null
  reportWinnerId: number | ''
  reportScore1: string
  reportScore2: string
  reporting: boolean
  onStartReport: (matchId: number) => void
  onSetWinner: (id: number) => void
  onSetScore1: (v: string) => void
  onSetScore2: (v: string) => void
  onCancelReport: () => void
  onSubmitReport: () => void
}) {
  const isReporting = reportingMatchId === match.id
  const canReport =
    isOwner &&
    tournament.status === 'active' &&
    match.status !== 'completed' &&
    match.status !== 'bye' &&
    match.player1_id !== null &&
    match.player2_id !== null

  const p1Won = match.winner_id === match.player1_id
  const p2Won = match.winner_id === match.player2_id

  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm">
      <PlayerRow name={match.player1_name} score={match.score1} isWinner={p1Won} isBye={match.status === 'bye'} />
      <div className="my-1.5 border-t border-slate-200" />
      <PlayerRow name={match.player2_name} score={match.score2} isWinner={p2Won} isBye={false} />

      {match.status === 'completed' && (
        <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wide text-emerald-600">
          Done
        </p>
      )}

      {canReport && !isReporting && (
        <button
          type="button"
          onClick={() => onStartReport(match.id)}
          className="mt-2 w-full rounded-full border border-slate-300 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          Report result
        </button>
      )}

      {isReporting && (
        <div className="mt-3 space-y-2">
          <select
            value={reportWinnerId}
            onChange={(e) => onSetWinner(Number(e.target.value))}
            className="w-full rounded-[16px] border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-400"
          >
            <option value="">Winner…</option>
            {match.player1_id && <option value={match.player1_id}>{match.player1_name}</option>}
            {match.player2_id && <option value={match.player2_id}>{match.player2_name}</option>}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={match.player1_name ?? 'P1 score'}
              value={reportScore1}
              onChange={(e) => onSetScore1(e.target.value)}
              className="w-full rounded-[16px] border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-amber-400"
            />
            <input
              type="number"
              placeholder={match.player2_name ?? 'P2 score'}
              value={reportScore2}
              onChange={(e) => onSetScore2(e.target.value)}
              className="w-full rounded-[16px] border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSubmitReport}
              disabled={reporting}
              className="flex-1 rounded-full bg-emerald-600 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {reporting ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancelReport}
              className="flex-1 rounded-full border border-slate-300 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerRow({
  name,
  score,
  isWinner,
  isBye,
}: {
  name: string | null
  score: number | null
  isWinner: boolean
  isBye: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${isWinner ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
      <span className="truncate text-xs">
        {isBye ? 'BYE' : (name ?? 'TBD')}
      </span>
      {score !== null && <span className="text-xs tabular-nums">{score}</span>}
      {isWinner && <span className="text-amber-500 text-xs">✓</span>}
    </div>
  )
}

// ─── Round Robin View ─────────────────────────────────────────────────────

function RoundRobinView({
  matches,
  participants,
}: {
  matches: TournamentMatch[]
  participants: TournamentParticipant[]
}) {
  // Compute standings
  const wins: Record<number, number> = {}
  const scored: Record<number, number> = {}

  for (const p of participants) {
    wins[p.user_id] = 0
    scored[p.user_id] = 0
  }

  for (const m of matches) {
    if (m.winner_id) wins[m.winner_id] = (wins[m.winner_id] ?? 0) + 1
    if (m.player1_id && m.score1 != null) scored[m.player1_id] = (scored[m.player1_id] ?? 0) + m.score1
    if (m.player2_id && m.score2 != null) scored[m.player2_id] = (scored[m.player2_id] ?? 0) + m.score2
  }

  const standings = participants
    .map((p) => ({ ...p, wins: wins[p.user_id] ?? 0, score: scored[p.user_id] ?? 0 }))
    .sort((a, b) => b.wins - a.wins || b.score - a.score)

  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Standings</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="pb-2 pr-4 text-xs font-medium text-slate-400">#</th>
              <th className="pb-2 pr-4 text-xs font-medium text-slate-400">Player</th>
              <th className="pb-2 pr-4 text-right text-xs font-medium text-slate-400">W</th>
              <th className="pb-2 text-right text-xs font-medium text-slate-400">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((p, i) => (
              <tr key={p.user_id} className="border-b border-slate-50 last:border-0">
                <td className="py-1.5 pr-4 text-xs text-slate-400">{i + 1}</td>
                <td className={`py-1.5 pr-4 text-xs ${i === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{p.user_name}</td>
                <td className="py-1.5 pr-4 text-right text-xs tabular-nums text-slate-600">{p.wins}</td>
                <td className="py-1.5 text-right text-xs tabular-nums text-slate-600">{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Matches</p>
        <div className="space-y-2">
          {rounds.map((round) => (
            <div key={round}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mb-1">Round {round}</p>
              {matches.filter((m) => m.round === round).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-[16px] border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs"
                >
                  <span className={m.winner_id === m.player1_id ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                    {m.player1_name ?? 'TBD'}
                  </span>
                  <span className="text-slate-300 mx-2">vs</span>
                  <span className={m.winner_id === m.player2_id ? 'font-semibold text-slate-900' : 'text-slate-500'}>
                    {m.player2_name ?? 'TBD'}
                  </span>
                  {m.status === 'completed' && (
                    <span className="ml-3 text-slate-400 tabular-nums">
                      {m.score1 ?? '—'}–{m.score2 ?? '—'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
