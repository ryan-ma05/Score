const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware')

const router = express.Router()
router.use(requireAuth)

router.get('/me/stats', (req, res) => {
  const userId = req.user.id

  const overall = db.prepare(`
    SELECT
      COUNT(DISTINCT s.group_id) AS groups_active,
      COUNT(DISTINCT sc.session_id) AS sessions_played,
      COALESCE(SUM(sc.score), 0) AS total_score,
      ROUND(COALESCE(AVG(sc.score * 1.0), 0), 1) AS avg_score,
      COALESCE(SUM(CASE WHEN sc.score = (
        SELECT MAX(sc2.score) FROM group_game_session_scores sc2
        WHERE sc2.session_id = sc.session_id
      ) AND sc.score > 0 THEN 1 ELSE 0 END), 0) AS wins
    FROM group_game_session_scores sc
    JOIN group_game_sessions s ON s.id = sc.session_id AND s.status = 'completed'
    WHERE sc.user_id = ?
  `).get(userId)

  const groups = db.prepare(`
    SELECT
      g.id AS group_id, g.name AS group_name,
      COUNT(DISTINCT sc.session_id) AS sessions,
      COALESCE(SUM(sc.score), 0) AS total_score,
      COALESCE(SUM(CASE WHEN sc.score = (
        SELECT MAX(sc2.score) FROM group_game_session_scores sc2
        WHERE sc2.session_id = sc.session_id
      ) AND sc.score > 0 THEN 1 ELSE 0 END), 0) AS wins
    FROM group_game_session_scores sc
    JOIN group_game_sessions s ON s.id = sc.session_id AND s.status = 'completed'
    JOIN groups g ON g.id = s.group_id
    WHERE sc.user_id = ?
    GROUP BY g.id, g.name
    ORDER BY total_score DESC
  `).all(userId)

  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(userId)

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    },
    stats: {
      groupsActive: overall.groups_active,
      sessionsPlayed: overall.sessions_played,
      totalScore: overall.total_score,
      avgScore: overall.avg_score,
      wins: overall.wins,
    },
    groups: groups.map((row) => ({
      groupId: row.group_id,
      groupName: row.group_name,
      sessions: row.sessions,
      totalScore: row.total_score,
      wins: row.wins,
    })),
  })
})

module.exports = router
