const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware')

const router = express.Router({ mergeParams: true })
router.use(requireAuth)

function isMember(groupId, userId) {
  return !!db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId)
}

function isOwner(groupId, userId) {
  return !!db.prepare('SELECT 1 FROM groups WHERE id = ? AND owner_id = ?').get(groupId, userId)
}

function hydrateTournament(tournament) {
  const participants = db.prepare(`
    SELECT tp.user_id, tp.seed, u.name AS user_name
    FROM tournament_participants tp
    JOIN users u ON u.id = tp.user_id
    WHERE tp.tournament_id = ?
    ORDER BY tp.seed ASC NULLS LAST, u.name ASC
  `).all(tournament.id)

  const matches = db.prepare(`
    SELECT tm.*,
      p1.name AS player1_name, p2.name AS player2_name, w.name AS winner_name
    FROM tournament_matches tm
    LEFT JOIN users p1 ON p1.id = tm.player1_id
    LEFT JOIN users p2 ON p2.id = tm.player2_id
    LEFT JOIN users w  ON w.id  = tm.winner_id
    WHERE tm.tournament_id = ?
    ORDER BY tm.bracket_side ASC, tm.round ASC, tm.match_number ASC
  `).all(tournament.id)

  return { ...tournament, participants, matches }
}

// GET /api/groups/:id/tournaments
router.get('/', (req, res) => {
  const groupId = Number(req.params.id)
  if (!isMember(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of this group' })
  }

  const tournaments = db.prepare(`
    SELECT t.*, u.name AS created_by_name,
      (SELECT COUNT(*) FROM tournament_participants tp WHERE tp.tournament_id = t.id) AS participant_count
    FROM tournaments t
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.group_id = ?
    ORDER BY t.created_at DESC
  `).all(groupId)

  return res.json({ tournaments })
})

// POST /api/groups/:id/tournaments
router.post('/', (req, res) => {
  const groupId = Number(req.params.id)
  if (!isOwner(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Only the group owner can create tournaments' })
  }

  const { name, type, participantIds } = req.body ?? {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Tournament name is required' })
  }
  if (!['single_elimination', 'double_elimination', 'round_robin'].includes(type)) {
    return res.status(400).json({ error: 'type must be single_elimination, double_elimination, or round_robin' })
  }
  if (!Array.isArray(participantIds) || participantIds.length < 2) {
    return res.status(400).json({ error: 'At least 2 participants are required' })
  }

  // Verify all participants are group members
  const memberIds = new Set(
    db.prepare('SELECT user_id FROM group_members WHERE group_id = ?').all(groupId).map((r) => r.user_id)
  )
  for (const uid of participantIds) {
    if (!memberIds.has(uid)) {
      return res.status(400).json({ error: `User ${uid} is not a member of this group` })
    }
  }

  const result = db.transaction(() => {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO tournaments (group_id, name, type, created_by) VALUES (?, ?, ?, ?)'
    ).run(groupId, name.trim(), type, req.user.id)

    const tournamentId = Number(lastInsertRowid)
    const insertParticipant = db.prepare(
      'INSERT INTO tournament_participants (tournament_id, user_id, seed) VALUES (?, ?, ?)'
    )
    participantIds.forEach((uid, i) => insertParticipant.run(tournamentId, uid, i + 1))

    return db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId)
  })()

  return res.status(201).json({ tournament: hydrateTournament(result) })
})

// GET /api/groups/:id/tournaments/:tournamentId
router.get('/:tournamentId', (req, res) => {
  const groupId = Number(req.params.id)
  const tournamentId = Number(req.params.tournamentId)

  if (!isMember(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of this group' })
  }

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND group_id = ?').get(tournamentId, groupId)
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' })

  return res.json({ tournament: hydrateTournament(tournament) })
})

// POST /api/groups/:id/tournaments/:tournamentId/start
router.post('/:tournamentId/start', (req, res) => {
  const groupId = Number(req.params.id)
  const tournamentId = Number(req.params.tournamentId)

  if (!isOwner(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Only the group owner can start tournaments' })
  }

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND group_id = ?').get(tournamentId, groupId)
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' })
  if (tournament.status !== 'pending') {
    return res.status(409).json({ error: 'Tournament has already started' })
  }

  const participants = db.prepare(`
    SELECT tp.user_id, u.name AS user_name
    FROM tournament_participants tp
    JOIN users u ON u.id = tp.user_id
    WHERE tp.tournament_id = ?
    ORDER BY tp.seed ASC
  `).all(tournamentId)

  db.transaction(() => {
    if (tournament.type === 'single_elimination') {
      generateSingleElimination(tournamentId, participants)
    } else if (tournament.type === 'double_elimination') {
      generateDoubleElimination(tournamentId, participants)
    } else {
      generateRoundRobin(tournamentId, participants)
    }
    db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('active', tournamentId)
  })()

  return res.json({ tournament: hydrateTournament(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId)) })
})

// PATCH /api/groups/:id/tournaments/:tournamentId/matches/:matchId
router.patch('/:tournamentId/matches/:matchId', (req, res) => {
  const groupId = Number(req.params.id)
  const tournamentId = Number(req.params.tournamentId)
  const matchId = Number(req.params.matchId)

  if (!isOwner(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Only the group owner can report match results' })
  }

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND group_id = ?').get(tournamentId, groupId)
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' })
  if (tournament.status !== 'active') {
    return res.status(409).json({ error: 'Tournament is not active' })
  }

  const match = db.prepare('SELECT * FROM tournament_matches WHERE id = ? AND tournament_id = ?').get(matchId, tournamentId)
  if (!match) return res.status(404).json({ error: 'Match not found' })
  if (match.status === 'completed') {
    return res.status(409).json({ error: 'Match already completed' })
  }

  const { winnerId, score1, score2 } = req.body ?? {}
  if (!winnerId) return res.status(400).json({ error: 'winnerId is required' })
  if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
    return res.status(400).json({ error: 'winnerId must be one of the match players' })
  }

  const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id

  db.transaction(() => {
    db.prepare(
      'UPDATE tournament_matches SET winner_id = ?, score1 = ?, score2 = ?, status = ? WHERE id = ?'
    ).run(winnerId, score1 ?? null, score2 ?? null, 'completed', matchId)

    // Advance winner to next match
    if (match.next_match_id) {
      const nextMatch = db.prepare('SELECT * FROM tournament_matches WHERE id = ?').get(match.next_match_id)
      if (nextMatch) {
        if (!nextMatch.player1_id) {
          db.prepare('UPDATE tournament_matches SET player1_id = ? WHERE id = ?').run(winnerId, match.next_match_id)
        } else {
          db.prepare('UPDATE tournament_matches SET player2_id = ? WHERE id = ?').run(winnerId, match.next_match_id)
        }
      }
    }

    // Advance loser to losers bracket match (double elimination)
    if (match.loser_next_match_id && loserId) {
      const loserNext = db.prepare('SELECT * FROM tournament_matches WHERE id = ?').get(match.loser_next_match_id)
      if (loserNext) {
        if (!loserNext.player1_id) {
          db.prepare('UPDATE tournament_matches SET player1_id = ? WHERE id = ?').run(loserId, match.loser_next_match_id)
        } else {
          db.prepare('UPDATE tournament_matches SET player2_id = ? WHERE id = ?').run(loserId, match.loser_next_match_id)
        }
      }
    }

    // Check if tournament is complete
    const pending = db.prepare(
      "SELECT COUNT(*) AS cnt FROM tournament_matches WHERE tournament_id = ? AND status NOT IN ('completed', 'bye')"
    ).get(tournamentId)

    if (pending.cnt === 0) {
      db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('completed', tournamentId)
    }
  })()

  return res.json({ tournament: hydrateTournament(db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId)) })
})

// DELETE /api/groups/:id/tournaments/:tournamentId
router.delete('/:tournamentId', (req, res) => {
  const groupId = Number(req.params.id)
  const tournamentId = Number(req.params.tournamentId)

  if (!isOwner(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Only the group owner can delete tournaments' })
  }

  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND group_id = ?').get(tournamentId, groupId)
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' })

  db.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId)
  return res.json({ ok: true })
})

// ─── Bracket generators ────────────────────────────────────────────────────

function insertMatch(tournamentId, round, matchNumber, bracketSide, player1Id, player2Id, status) {
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO tournament_matches (tournament_id, round, match_number, bracket_side, player1_id, player2_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(tournamentId, round, matchNumber, bracketSide, player1Id ?? null, player2Id ?? null, status)
  return Number(lastInsertRowid)
}

function setNextMatch(matchId, nextMatchId) {
  db.prepare('UPDATE tournament_matches SET next_match_id = ? WHERE id = ?').run(nextMatchId, matchId)
}

function setLoserNextMatch(matchId, loserNextMatchId) {
  db.prepare('UPDATE tournament_matches SET loser_next_match_id = ? WHERE id = ?').run(loserNextMatchId, matchId)
}

function nextPow2(n) {
  let p = 1
  while (p < n) p *= 2
  return p
}

function generateSingleElimination(tournamentId, participants) {
  const n = participants.length
  const size = nextPow2(n)
  const byes = size - n

  // Round 1: fill with participants + byes
  const round1Ids = []
  let matchNumber = 1
  let playerIndex = 0

  for (let i = 0; i < size / 2; i++) {
    const p1 = participants[playerIndex++] ?? null
    const p2 = byes > 0 && i < byes ? null : participants[playerIndex++] ?? null

    const isBye = p2 === null
    const status = isBye ? 'bye' : 'pending'
    const id = insertMatch(tournamentId, 1, matchNumber++, 'winners', p1?.user_id, p2?.user_id, status)

    // Immediately mark bye winner
    if (isBye && p1) {
      db.prepare('UPDATE tournament_matches SET winner_id = ?, status = ? WHERE id = ?').run(p1.user_id, 'bye', id)
    }

    round1Ids.push({ id, winnerId: isBye ? p1?.user_id : null })
  }

  // Subsequent rounds
  let prevRoundIds = round1Ids.map((m) => m.id)
  let round = 2

  while (prevRoundIds.length > 1) {
    const nextRoundIds = []
    matchNumber = 1

    for (let i = 0; i < prevRoundIds.length; i += 2) {
      const nextId = insertMatch(tournamentId, round, matchNumber++, 'winners', null, null, 'pending')
      nextRoundIds.push(nextId)

      setNextMatch(prevRoundIds[i], nextId)
      if (prevRoundIds[i + 1] !== undefined) setNextMatch(prevRoundIds[i + 1], nextId)

      // Pre-fill bye winners into next round
      const m1 = db.prepare('SELECT winner_id FROM tournament_matches WHERE id = ?').get(prevRoundIds[i])
      const m2 = prevRoundIds[i + 1] !== undefined
        ? db.prepare('SELECT winner_id FROM tournament_matches WHERE id = ?').get(prevRoundIds[i + 1])
        : null

      if (m1?.winner_id) {
        db.prepare('UPDATE tournament_matches SET player1_id = ? WHERE id = ?').run(m1.winner_id, nextId)
      }
      if (m2?.winner_id) {
        db.prepare('UPDATE tournament_matches SET player2_id = ? WHERE id = ?').run(m2.winner_id, nextId)
      }
    }

    prevRoundIds = nextRoundIds
    round++
  }
}

function generateRoundRobin(tournamentId, participants) {
  const list = [...participants]
  if (list.length % 2 !== 0) list.push(null) // phantom bye player

  const rounds = list.length - 1
  const half = list.length / 2
  let matchNumber = 1

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const p1 = list[i]
      const p2 = list[list.length - 1 - i]
      if (p1 && p2) {
        insertMatch(tournamentId, r + 1, matchNumber++, 'winners', p1.user_id, p2.user_id, 'pending')
      }
    }
    // Rotate all except first element
    const last = list.splice(list.length - 1, 1)[0]
    list.splice(1, 0, last)
  }
}

function generateDoubleElimination(tournamentId, participants) {
  const n = participants.length
  const size = nextPow2(n)
  const byes = size - n

  // --- Winners bracket round 1 ---
  const wRound1Ids = []
  let matchNum = 1
  let playerIndex = 0

  for (let i = 0; i < size / 2; i++) {
    const p1 = participants[playerIndex++] ?? null
    const p2 = byes > 0 && i < byes ? null : participants[playerIndex++] ?? null

    const isBye = p2 === null
    const status = isBye ? 'bye' : 'pending'
    const id = insertMatch(tournamentId, 1, matchNum++, 'winners', p1?.user_id, p2?.user_id, status)

    if (isBye && p1) {
      db.prepare('UPDATE tournament_matches SET winner_id = ?, status = ? WHERE id = ?').run(p1.user_id, 'bye', id)
    }
    wRound1Ids.push(id)
  }

  // --- Winners bracket subsequent rounds ---
  let wPrevIds = wRound1Ids
  let wRound = 2
  const wRoundIds = [wRound1Ids]

  while (wPrevIds.length > 1) {
    const thisRound = []
    matchNum = 1
    for (let i = 0; i < wPrevIds.length; i += 2) {
      const id = insertMatch(tournamentId, wRound, matchNum++, 'winners', null, null, 'pending')
      thisRound.push(id)
      setNextMatch(wPrevIds[i], id)
      if (wPrevIds[i + 1] !== undefined) setNextMatch(wPrevIds[i + 1], id)

      // Pre-fill byes
      const m1 = db.prepare('SELECT winner_id FROM tournament_matches WHERE id = ?').get(wPrevIds[i])
      const m2 = wPrevIds[i + 1] !== undefined
        ? db.prepare('SELECT winner_id FROM tournament_matches WHERE id = ?').get(wPrevIds[i + 1])
        : null
      if (m1?.winner_id) db.prepare('UPDATE tournament_matches SET player1_id = ? WHERE id = ?').run(m1.winner_id, id)
      if (m2?.winner_id) db.prepare('UPDATE tournament_matches SET player2_id = ? WHERE id = ?').run(m2.winner_id, id)
    }
    wRoundIds.push(thisRound)
    wPrevIds = thisRound
    wRound++
  }

  // --- Losers bracket ---
  // L-R1 receives losers from W-R1 (pairs)
  // L-R2 receives winners from L-R1 vs. losers from W-R2, etc.
  const lRoundIds = []
  let lRound = 1
  matchNum = 1

  // L-R1: pair up losers from W-R1
  const lR1 = []
  for (let i = 0; i < wRound1Ids.length; i += 2) {
    const id = insertMatch(tournamentId, lRound, matchNum++, 'losers', null, null, 'pending')
    lR1.push(id)
    setLoserNextMatch(wRound1Ids[i], id)
    if (wRound1Ids[i + 1] !== undefined) setLoserNextMatch(wRound1Ids[i + 1], id)
  }
  lRoundIds.push(lR1)
  lRound++

  // Each subsequent winners bracket round drops losers into a new losers round
  for (let wIdx = 1; wIdx < wRoundIds.length - 1; wIdx++) {
    const wDroppers = wRoundIds[wIdx]
    const lPrev = lRoundIds[lRoundIds.length - 1]

    // Match L-prev winners vs. W droppers
    const lMerge = []
    matchNum = 1
    for (let i = 0; i < Math.max(lPrev.length, wDroppers.length); i++) {
      const id = insertMatch(tournamentId, lRound, matchNum++, 'losers', null, null, 'pending')
      lMerge.push(id)
      if (lPrev[i] !== undefined) setNextMatch(lPrev[i], id)
      if (wDroppers[i] !== undefined) setLoserNextMatch(wDroppers[i], id)
    }
    lRoundIds.push(lMerge)
    lRound++

    // Within-losers-bracket round if more than one match
    if (lMerge.length > 1) {
      const lWithin = []
      matchNum = 1
      for (let i = 0; i < lMerge.length; i += 2) {
        const id = insertMatch(tournamentId, lRound, matchNum++, 'losers', null, null, 'pending')
        lWithin.push(id)
        setNextMatch(lMerge[i], id)
        if (lMerge[i + 1] !== undefined) setNextMatch(lMerge[i + 1], id)
      }
      lRoundIds.push(lWithin)
      lRound++
    }
  }

  // --- Grand final ---
  const wFinalId = wPrevIds[0]
  const lFinalId = lRoundIds[lRoundIds.length - 1]?.[0]

  if (wFinalId && lFinalId) {
    const grandFinalId = insertMatch(tournamentId, 1, 1, 'final', null, null, 'pending')
    setNextMatch(wFinalId, grandFinalId)
    setNextMatch(lFinalId, grandFinalId)
  }
}

module.exports = router
