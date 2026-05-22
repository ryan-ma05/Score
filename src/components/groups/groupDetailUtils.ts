import type { GroupGameSession, GroupGameSessionScore, GroupMember, SavedGroupGame } from '../../context/GroupContext'

export function buildSessionScoreboard(session: GroupGameSession, members: GroupMember[]) {
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

export function buildScoreKey(sessionId: number, userId: number) {
  return `${sessionId}:${userId}`
}

export function sortSavedGames(games: SavedGroupGame[]) {
  return [...games].sort((a, b) => b.savedAt - a.savedAt)
}

export function sortSessions(sessions: GroupGameSession[]) {
  return [...sessions].sort((a, b) => {
    const left = a.scheduledFor ?? a.createdAt
    const right = b.scheduledFor ?? b.createdAt
    return right - left
  })
}

export function sortSessionScores(scores: GroupGameSessionScore[]) {
  return [...scores].sort((a, b) => b.score - a.score || a.userName.localeCompare(b.userName))
}

export function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const inputClassName =
  'w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
