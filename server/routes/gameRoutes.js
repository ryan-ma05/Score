const { Router } = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware')

const router = Router()
router.use(requireAuth)

const FLAGGED_TERMS = ['kill yourself', 'sexual assault', 'nazi']

router.get('/', (req, res) => {
  const query = String(req.query.q ?? '').trim().toLowerCase()
  const category = String(req.query.category ?? '').trim()

  const rows = db.prepare(`
    SELECT g.*,
           u.name AS created_by_name
    FROM games g
    LEFT JOIN users u ON u.id = g.created_by
    WHERE g.moderation_status = 'approved'
      AND (? = '' OR g.category = ?)
      AND (
        ? = ''
        OR LOWER(g.name || ' ' || g.specific_game || ' ' || g.category || ' ' || g.scoring_system || ' ' || g.rules) LIKE ?
      )
    ORDER BY CASE WHEN g.source = 'official' THEN 0 ELSE 1 END, g.created_at DESC
  `).all(
    category,
    category,
    query,
    query ? `%${query}%` : '',
  )

  return res.json({ games: rows })
})

router.post('/', (req, res) => {
  const payload = normalizeGamePayload(req.body)
  if (!payload.ok) return res.status(400).json({ error: payload.error })

  const combined = [
    payload.value.name,
    payload.value.category,
    payload.value.specificGame,
    payload.value.playerCount,
    payload.value.roundCount,
    payload.value.scoringSystem,
    payload.value.rules,
  ].join(' ').toLowerCase()

  const flagged = FLAGGED_TERMS.find((term) => combined.includes(term))
  if (flagged) {
    return res.status(422).json({ error: 'This game needs manual review before it can be published.' })
  }

  try {
    const result = db.prepare(`
      INSERT INTO games (
        name, category, specific_game, player_count, round_count, scoring_system, rules, source, moderation_status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'community', 'approved', ?)
    `).run(
      payload.value.name,
      payload.value.category,
      payload.value.specificGame,
      payload.value.playerCount,
      payload.value.roundCount,
      payload.value.scoringSystem,
      payload.value.rules,
      req.user.id,
    )

    const game = db.prepare(`
      SELECT g.*, u.name AS created_by_name
      FROM games g
      LEFT JOIN users u ON u.id = g.created_by
      WHERE g.id = ?
    `).get(result.lastInsertRowid)

    return res.status(201).json({ game })
  } catch (err) {
    if (isUniqueConstraint(err)) {
      return res.status(409).json({ error: 'That game already exists in the catalog.' })
    }

    throw err
  }
})

module.exports = router

function normalizeGamePayload(body) {
  const name = String(body?.name ?? '').trim()
  const category = String(body?.category ?? '').trim()
  const specificGame = String(body?.specificGame ?? body?.specific_game ?? '').trim()
  const playerCount = String(body?.playerCount ?? body?.player_count ?? '').trim()
  const roundCount = String(body?.roundCount ?? body?.round_count ?? '').trim()
  const scoringSystem = String(body?.scoringSystem ?? body?.scoring_system ?? '').trim()
  const rules = String(body?.rules ?? '').trim()

  if (!name || !category || !specificGame || !playerCount || !roundCount || !scoringSystem || !rules) {
    return { ok: false, error: 'name, category, specificGame, playerCount, roundCount, scoringSystem, and rules are required' }
  }

  if (scoringSystem.length < 10) {
    return { ok: false, error: 'Describe the scoring system clearly enough for a group to track it.' }
  }

  if (rules.length < 24) {
    return { ok: false, error: 'Rules should be detailed enough for a new group to play the game.' }
  }

  return {
    ok: true,
    value: {
      name,
      category,
      specificGame,
      playerCount,
      roundCount,
      scoringSystem,
      rules,
    },
  }
}

function isUniqueConstraint(err) {
  return err && typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')
}
