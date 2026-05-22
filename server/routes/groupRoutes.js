const { Router } = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware')

const router = Router()
router.use(requireAuth)

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateUniqueCode() {
  let attempts = 0
  while (attempts < 10) {
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
    }
    const existing = db.prepare('SELECT id FROM groups WHERE join_code = ?').get(code)
    if (!existing) return code
    attempts++
  }
  throw new Error('Could not generate unique join code')
}

const SESSION_STATUSES = new Set(['scheduled', 'completed', 'cancelled'])

function getGroupById(groupId) {
  return db.prepare(`
    SELECT g.*,
           (
             SELECT COUNT(*)
             FROM group_members gm
             WHERE gm.group_id = g.id
           ) AS member_count,
           (
             SELECT COUNT(*)
             FROM group_members gm
             JOIN users u ON u.id = gm.user_id
             WHERE gm.group_id = g.id
               AND u.last_seen_at >= unixepoch() - 300
           ) AS active_member_count
    FROM groups g
    WHERE g.id = ?
  `).get(groupId)
}

function requireGroupMember(groupId, userId) {
  return db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId)
}

function getApprovedGame(gameId) {
  return db.prepare(`
    SELECT *
    FROM games
    WHERE id = ? AND moderation_status = 'approved'
  `).get(gameId)
}

function getGroupSessionById(sessionId) {
  return db.prepare(`
    SELECT s.*,
           g.name AS game_name,
           g.category,
           g.specific_game,
           g.scoring_system,
           u.name AS created_by_name
    FROM group_game_sessions s
    JOIN games g ON g.id = s.game_id
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.id = ?
  `).get(sessionId)
}

function withSessionScores(sessions) {
  if (sessions.length === 0) return sessions

  const sessionIds = sessions.map((session) => session.id)
  const placeholders = sessionIds.map(() => '?').join(', ')
  const scoreRows = db.prepare(`
    SELECT ss.session_id,
           ss.user_id,
           ss.score,
           ss.updated_at,
           u.name AS user_name
    FROM group_game_session_scores ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.session_id IN (${placeholders})
    ORDER BY u.name ASC
  `).all(...sessionIds)

  const scoresBySessionId = new Map()
  for (const row of scoreRows) {
    const current = scoresBySessionId.get(row.session_id) ?? []
    current.push(row)
    scoresBySessionId.set(row.session_id, current)
  }

  return sessions.map((session) => ({
    ...session,
    scores: scoresBySessionId.get(session.id) ?? [],
  }))
}

function parseOptionalTimestamp(value) {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    return normalizeEpoch(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) {
      return normalizeEpoch(numeric)
    }

    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000)
    }
  }

  return Number.NaN
}

function normalizeEpoch(value) {
  return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value)
}

// GET /api/groups — list groups the current user belongs to
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT g.id, g.name, g.description, g.join_code, g.owner_id, g.created_at,
           COUNT(gm2.user_id) AS member_count,
           COALESCE(SUM(CASE WHEN u2.last_seen_at >= unixepoch() - 300 THEN 1 ELSE 0 END), 0) AS active_member_count
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ?
    JOIN group_members gm2 ON gm2.group_id = g.id
    JOIN users u2 ON u2.id = gm2.user_id
    GROUP BY g.id
    ORDER BY g.created_at DESC
  `).all(req.user.id)
  return res.json({ groups: rows })
})

// GET /api/groups/invites — pending group invites for current user
router.get('/invites', (req, res) => {
  const rows = db.prepare(`
    SELECT gi.id, gi.group_id, gi.inviter_id, gi.created_at,
           g.name AS group_name, g.description AS group_description,
           u.name AS inviter_name
    FROM group_invites gi
    JOIN groups g ON g.id = gi.group_id
    JOIN users u ON u.id = gi.inviter_id
    WHERE gi.invitee_id = ? AND gi.status = 'pending'
    ORDER BY gi.created_at DESC
  `).all(req.user.id)
  return res.json({ invites: rows })
})

// POST /api/groups — create a group
router.post('/', (req, res) => {
  const { name, description = '' } = req.body ?? {}
  if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' })

  const join_code = generateUniqueCode()

  const createGroup = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO groups (name, description, join_code, owner_id) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), description.trim(), join_code, req.user.id)

    const groupId = result.lastInsertRowid
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, req.user.id)
    return getGroupById(groupId)
  })

  const group = createGroup()
  return res.status(201).json({ group })
})

// POST /api/groups/join — join by code
router.post('/join', (req, res) => {
  const { code } = req.body ?? {}
  if (!code) return res.status(400).json({ error: 'code is required' })

  const group = db.prepare('SELECT * FROM groups WHERE join_code = ?').get(code.toUpperCase().trim())
  if (!group) return res.status(404).json({ error: 'Invalid join code' })

  const already = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, req.user.id)
  if (already) return res.status(409).json({ error: 'Already a member of this group' })

  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, req.user.id)
  return res.json({ group: getGroupById(group.id) })
})

// POST /api/groups/invites/:inviteId/accept
router.post('/invites/:inviteId/accept', (req, res) => {
  const inviteId = Number(req.params.inviteId)
  const invite = db.prepare('SELECT * FROM group_invites WHERE id = ?').get(inviteId)

  if (!invite || invite.invitee_id !== req.user.id) return res.status(404).json({ error: 'Invite not found' })
  if (invite.status !== 'pending') return res.status(400).json({ error: 'Invite is no longer pending' })

  const accept = db.transaction(() => {
    db.prepare("UPDATE group_invites SET status = 'accepted' WHERE id = ?").run(inviteId)
    const already = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(invite.group_id, req.user.id)
    if (!already) {
      db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(invite.group_id, req.user.id)
    }
    return getGroupById(invite.group_id)
  })

  const group = accept()
  return res.json({ group })
})

// POST /api/groups/invites/:inviteId/decline
router.post('/invites/:inviteId/decline', (req, res) => {
  const inviteId = Number(req.params.inviteId)
  const invite = db.prepare('SELECT * FROM group_invites WHERE id = ?').get(inviteId)

  if (!invite || invite.invitee_id !== req.user.id) return res.status(404).json({ error: 'Invite not found' })
  if (invite.status !== 'pending') return res.status(400).json({ error: 'Invite is no longer pending' })

  db.prepare("UPDATE group_invites SET status = 'declined' WHERE id = ?").run(inviteId)
  return res.json({ message: 'Invite declined' })
})

// GET /api/groups/:id/saved-games — group bookmarks
router.get('/:id/saved-games', (req, res) => {
  const groupId = Number(req.params.id)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  const rows = db.prepare(`
    SELECT g.*,
           s.group_id,
           s.saved_by,
           s.created_at AS saved_at,
           u.name AS saved_by_name
    FROM group_saved_games s
    JOIN games g ON g.id = s.game_id
    LEFT JOIN users u ON u.id = s.saved_by
    WHERE s.group_id = ?
    ORDER BY s.created_at DESC
  `).all(groupId)

  return res.json({ saved_games: rows })
})

// POST /api/groups/:id/saved-games — bookmark a game for the group
router.post('/:id/saved-games', (req, res) => {
  const groupId = Number(req.params.id)
  const gameId = Number(req.body?.gameId ?? req.body?.game_id)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  if (!Number.isInteger(gameId) || gameId <= 0) {
    return res.status(400).json({ error: 'Valid gameId is required' })
  }

  const game = getApprovedGame(gameId)
  if (!game) return res.status(404).json({ error: 'Game not found' })

  const result = db.prepare(`
    INSERT OR IGNORE INTO group_saved_games (group_id, game_id, saved_by)
    VALUES (?, ?, ?)
  `).run(groupId, gameId, req.user.id)

  const savedGame = db.prepare(`
    SELECT g.*,
           s.group_id,
           s.saved_by,
           s.created_at AS saved_at,
           u.name AS saved_by_name
    FROM group_saved_games s
    JOIN games g ON g.id = s.game_id
    LEFT JOIN users u ON u.id = s.saved_by
    WHERE s.group_id = ? AND s.game_id = ?
  `).get(groupId, gameId)

  return res.status(result.changes > 0 ? 201 : 200).json({ saved_game: savedGame })
})

// DELETE /api/groups/:id/saved-games/:gameId — remove a bookmarked game
router.delete('/:id/saved-games/:gameId', (req, res) => {
  const groupId = Number(req.params.id)
  const gameId = Number(req.params.gameId)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  const result = db.prepare(`
    DELETE FROM group_saved_games
    WHERE group_id = ? AND game_id = ?
  `).run(groupId, gameId)

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Saved game not found' })
  }

  return res.json({ message: 'Saved game removed' })
})

// GET /api/groups/:id/sessions — scheduled or logged game nights
router.get('/:id/sessions', (req, res) => {
  const groupId = Number(req.params.id)
  const status = String(req.query.status ?? '').trim()

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  if (status && !SESSION_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid session status filter' })
  }

  const rows = db.prepare(`
    SELECT s.*,
           g.name AS game_name,
           g.category,
           g.specific_game,
           g.scoring_system,
           u.name AS created_by_name
    FROM group_game_sessions s
    JOIN games g ON g.id = s.game_id
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.group_id = ?
      AND (? = '' OR s.status = ?)
    ORDER BY COALESCE(s.scheduled_for, s.created_at) DESC, s.created_at DESC
  `).all(groupId, status, status)

  return res.json({ sessions: withSessionScores(rows) })
})

// POST /api/groups/:id/sessions — schedule or log a game night
router.post('/:id/sessions', (req, res) => {
  const groupId = Number(req.params.id)
  const gameId = Number(req.body?.gameId ?? req.body?.game_id)
  const status = String(req.body?.status ?? 'scheduled').trim()
  const ruleOverrides = String(req.body?.ruleOverrides ?? req.body?.rule_overrides ?? '').trim()
  const scheduledFor = parseOptionalTimestamp(req.body?.scheduledFor ?? req.body?.scheduled_for)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  if (!Number.isInteger(gameId) || gameId <= 0) {
    return res.status(400).json({ error: 'Valid gameId is required' })
  }

  if (!SESSION_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be scheduled, completed, or cancelled' })
  }

  if (Number.isNaN(scheduledFor)) {
    return res.status(400).json({ error: 'scheduledFor must be an ISO date string or unix timestamp' })
  }

  const game = getApprovedGame(gameId)
  if (!game) return res.status(404).json({ error: 'Game not found' })

  const createSession = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO group_game_sessions (
        group_id, game_id, created_by, scheduled_for, status, rule_overrides
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(groupId, gameId, req.user.id, scheduledFor, status, ruleOverrides)

    const sessionId = Number(result.lastInsertRowid)
    const members = db.prepare(`
      SELECT user_id
      FROM group_members
      WHERE group_id = ?
    `).all(groupId)

    const insertScore = db.prepare(`
      INSERT OR IGNORE INTO group_game_session_scores (session_id, user_id, score)
      VALUES (?, ?, 0)
    `)

    for (const memberRow of members) {
      insertScore.run(sessionId, memberRow.user_id)
    }

    return sessionId
  })

  const sessionId = createSession()
  const session = getGroupSessionById(sessionId)

  return res.status(201).json({ session: withSessionScores([session])[0] })
})

// POST /api/groups/:id/sessions/:sessionId/scores — adjust or set a member score
router.post('/:id/sessions/:sessionId/scores', (req, res) => {
  const groupId = Number(req.params.id)
  const sessionId = Number(req.params.sessionId)
  const userId = Number(req.body?.userId)
  const score = req.body?.score
  const delta = req.body?.delta

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  const session = getGroupSessionById(sessionId)
  if (!session || session.group_id !== groupId) {
    return res.status(404).json({ error: 'Session not found' })
  }

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Valid userId is required' })
  }

  const targetMembership = requireGroupMember(groupId, userId)
  if (!targetMembership) {
    return res.status(404).json({ error: 'User is not a member of this group' })
  }

  const hasExplicitScore = score !== undefined && score !== null && score !== ''
  const parsedScore = hasExplicitScore ? Number(score) : null
  const parsedDelta = delta === undefined || delta === null || delta === '' ? 1 : Number(delta)

  if (hasExplicitScore && !Number.isFinite(parsedScore)) {
    return res.status(400).json({ error: 'score must be a number when provided' })
  }

  if (!hasExplicitScore && !Number.isFinite(parsedDelta)) {
    return res.status(400).json({ error: 'delta must be a number when provided' })
  }

  db.prepare(`
    INSERT OR IGNORE INTO group_game_session_scores (session_id, user_id, score)
    VALUES (?, ?, 0)
  `).run(sessionId, userId)

  if (hasExplicitScore) {
    db.prepare(`
      UPDATE group_game_session_scores
      SET score = ?, updated_at = unixepoch()
      WHERE session_id = ? AND user_id = ?
    `).run(parsedScore, sessionId, userId)
  } else {
    db.prepare(`
      UPDATE group_game_session_scores
      SET score = score + ?, updated_at = unixepoch()
      WHERE session_id = ? AND user_id = ?
    `).run(parsedDelta, sessionId, userId)
  }

  const scoreRow = db.prepare(`
    SELECT ss.session_id,
           ss.user_id,
           ss.score,
           ss.updated_at,
           u.name AS user_name
    FROM group_game_session_scores ss
    JOIN users u ON u.id = ss.user_id
    WHERE ss.session_id = ? AND ss.user_id = ?
  `).get(sessionId, userId)

  req.io.to(`session:${sessionId}`).emit('score-updated', scoreRow)

  return res.json({ score: scoreRow })
})

// GET /api/groups/:id/leaderboard — cumulative stats across completed sessions
router.get('/:id/leaderboard', (req, res) => {
  const groupId = Number(req.params.id)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  const rows = db.prepare(`
    SELECT
      u.id                                            AS user_id,
      u.name                                          AS user_name,
      COUNT(DISTINCT sc.session_id)                   AS sessions_played,
      COALESCE(SUM(sc.score), 0)                      AS total_score,
      ROUND(COALESCE(AVG(sc.score * 1.0), 0), 1)      AS avg_score,
      COALESCE(SUM(
        CASE WHEN sc.score = (
          SELECT MAX(sc2.score)
          FROM group_game_session_scores sc2
          WHERE sc2.session_id = sc.session_id
        ) AND sc.score > 0 THEN 1 ELSE 0 END
      ), 0)                                           AS wins
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN group_game_session_scores sc ON sc.user_id = u.id
    LEFT JOIN group_game_sessions s
      ON s.id = sc.session_id AND s.group_id = ? AND s.status = 'completed'
    WHERE gm.group_id = ?
    GROUP BY u.id, u.name
    ORDER BY total_score DESC, u.name ASC
  `).all(groupId, groupId)

  return res.json({ leaderboard: rows })
})

// GET /api/groups/:id — group detail + members
router.get('/:id', (req, res) => {
  const groupId = Number(req.params.id)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  const member = requireGroupMember(groupId, req.user.id)
  if (!member) return res.status(403).json({ error: 'Not a member of this group' })

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, gm.joined_at
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `).all(groupId)

  return res.json({ group, members })
})

// POST /api/groups/:id/invite — owner invites a friend
router.post('/:id/invite', (req, res) => {
  const groupId = Number(req.params.id)
  const { userId } = req.body ?? {}

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })
  if (group.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can invite members' })

  if (!userId) return res.status(400).json({ error: 'userId is required' })

  // Must be friends
  const friendship = db.prepare(`
    SELECT 1 FROM friendships
    WHERE ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      AND status = 'accepted'
  `).get(req.user.id, userId, userId, req.user.id)
  if (!friendship) return res.status(403).json({ error: 'You can only invite friends' })

  const alreadyMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId)
  if (alreadyMember) return res.status(409).json({ error: 'User is already a member' })

  try {
    db.prepare(
      'INSERT INTO group_invites (group_id, inviter_id, invitee_id) VALUES (?, ?, ?)'
    ).run(groupId, req.user.id, userId)
  } catch {
    return res.status(409).json({ error: 'Invite already sent to this user' })
  }

  return res.status(201).json({ message: 'Invite sent' })
})

// DELETE /api/groups/:id/members/:userId — owner removes a member
router.delete('/:id/members/:userId', (req, res) => {
  const groupId = Number(req.params.id)
  const targetId = Number(req.params.userId)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })
  if (group.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can remove members' })
  if (targetId === req.user.id) return res.status(400).json({ error: 'Use transfer ownership before leaving' })

  const result = db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetId)
  if (result.changes === 0) return res.status(404).json({ error: 'User is not a member' })

  // Also cancel any pending invite
  db.prepare("UPDATE group_invites SET status = 'declined' WHERE group_id = ? AND invitee_id = ? AND status = 'pending'").run(groupId, targetId)

  return res.json({ message: 'Member removed' })
})

// POST /api/groups/:id/transfer — transfer ownership to another member
router.post('/:id/transfer', (req, res) => {
  const groupId = Number(req.params.id)
  const { userId } = req.body ?? {}

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })
  if (group.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can transfer ownership' })
  if (!userId || userId === req.user.id) return res.status(400).json({ error: 'Choose a different member' })

  const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId)
  if (!isMember) return res.status(404).json({ error: 'Target user is not a member' })

  db.prepare('UPDATE groups SET owner_id = ? WHERE id = ?').run(userId, groupId)
  return res.json({ message: 'Ownership transferred' })
})

// DELETE /api/groups/:id/leave
router.delete('/:id/leave', (req, res) => {
  const groupId = Number(req.params.id)

  const group = getGroupById(groupId)
  if (!group) return res.status(404).json({ error: 'Group not found' })

  if (group.owner_id === req.user.id) {
    return res.status(400).json({ error: 'Transfer ownership before leaving the group' })
  }

  const result = db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, req.user.id)
  if (result.changes === 0) return res.status(404).json({ error: 'Not a member of this group' })
  return res.json({ message: 'Left group' })
})

// PATCH /api/groups/:id/sessions/:sessionId — update session status
router.patch('/:id/sessions/:sessionId', (req, res) => {
  const groupId = Number(req.params.id)
  const sessionId = Number(req.params.sessionId)
  const { status } = req.body ?? {}

  if (!['completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'status must be completed or cancelled' })
  }

  if (!requireGroupMember(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of this group' })
  }

  const session = db.prepare('SELECT * FROM group_game_sessions WHERE id = ? AND group_id = ?').get(sessionId, groupId)
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.status !== 'scheduled') {
    return res.status(409).json({ error: 'Only scheduled sessions can be updated' })
  }

  db.prepare('UPDATE group_game_sessions SET status = ? WHERE id = ?').run(status, sessionId)

  const updated = db.prepare(`
    SELECT s.*, g.name AS game_name, g.category, g.specific_game, g.scoring_system,
           u.name AS created_by_name
    FROM group_game_sessions s
    JOIN games g ON g.id = s.game_id
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.id = ?
  `).get(sessionId)

  return res.json({ session: { ...updated, scores: [] } })
})

// GET /api/groups/:id/score-history — per-session score timeline for chart
router.get('/:id/score-history', (req, res) => {
  const groupId = Number(req.params.id)

  if (!requireGroupMember(groupId, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of this group' })
  }

  const rows = db.prepare(`
    SELECT
      s.id AS session_id,
      g.specific_game,
      COALESCE(s.scheduled_for, s.created_at) AS session_date,
      sc.user_id,
      u.name AS user_name,
      sc.score
    FROM group_game_sessions s
    JOIN games g ON g.id = s.game_id
    JOIN group_game_session_scores sc ON sc.session_id = s.id
    JOIN users u ON u.id = sc.user_id
    WHERE s.group_id = ? AND s.status = 'completed'
    ORDER BY session_date ASC
  `).all(groupId)

  return res.json({ history: rows })
})

module.exports = router
