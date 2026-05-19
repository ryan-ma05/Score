const { Router } = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware')

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const query = String(req.query.q ?? '').trim().toLowerCase()
  const sort = req.query.sort === 'recent' ? 'recent' : 'likes'
  const gameId = toOptionalInteger(req.query.gameId)
  const groupId = toOptionalInteger(req.query.groupId)

  const rows = db.prepare(`
    SELECT fc.*,
           g.name AS game_name,
           g.specific_game,
           grp.name AS group_name,
           u.name AS uploaded_by_name
    FROM featured_clips fc
    JOIN games g ON g.id = fc.game_id
    LEFT JOIN groups grp ON grp.id = fc.group_id
    LEFT JOIN users u ON u.id = fc.uploaded_by
    WHERE g.moderation_status = 'approved'
      AND (? IS NULL OR fc.game_id = ?)
      AND (? IS NULL OR fc.group_id = ?)
      AND (
        ? = ''
        OR LOWER(fc.title || ' ' || fc.description || ' ' || fc.tags || ' ' || g.specific_game) LIKE ?
      )
    ORDER BY
      CASE WHEN ? = 'recent' THEN fc.created_at END DESC,
      CASE WHEN ? = 'likes' THEN fc.likes END DESC,
      fc.created_at DESC
  `).all(
    gameId,
    gameId,
    groupId,
    groupId,
    query,
    query ? `%${query}%` : '',
    sort,
    sort,
  )

  return res.json({ clips: rows.map(formatClipRow) })
})

router.post('/', (req, res) => {
  const payload = normalizeClipPayload(req.body)
  if (!payload.ok) return res.status(400).json({ error: payload.error })

  const game = db.prepare(`
    SELECT id, moderation_status
    FROM games
    WHERE id = ?
  `).get(payload.value.gameId)

  if (!game || game.moderation_status !== 'approved') {
    return res.status(404).json({ error: 'Game not found or unavailable for clips' })
  }

  if (payload.value.groupId != null) {
    const membership = db.prepare(`
      SELECT 1
      FROM group_members
      WHERE group_id = ? AND user_id = ?
    `).get(payload.value.groupId, req.user.id)

    if (!membership) {
      return res.status(403).json({ error: 'You can only attach clips to groups you belong to' })
    }
  }

  try {
    const result = db.prepare(`
      INSERT INTO featured_clips (
        game_id, group_id, title, description, video_url, tags, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.value.gameId,
      payload.value.groupId,
      payload.value.title,
      payload.value.description,
      payload.value.videoUrl,
      JSON.stringify(payload.value.tags),
      req.user.id,
    )

    const clip = db.prepare(`
      SELECT fc.*,
             g.name AS game_name,
             g.specific_game,
             grp.name AS group_name,
             u.name AS uploaded_by_name
      FROM featured_clips fc
      JOIN games g ON g.id = fc.game_id
      LEFT JOIN groups grp ON grp.id = fc.group_id
      LEFT JOIN users u ON u.id = fc.uploaded_by
      WHERE fc.id = ?
    `).get(result.lastInsertRowid)

    return res.status(201).json({ clip: formatClipRow(clip) })
  } catch (err) {
    if (isUniqueConstraint(err)) {
      return res.status(409).json({ error: 'That video URL is already in the featured feed.' })
    }

    throw err
  }
})

router.post('/:id/like', (req, res) => {
  const clipId = Number(req.params.id)
  if (!Number.isInteger(clipId) || clipId <= 0) {
    return res.status(400).json({ error: 'Valid clip id is required' })
  }

  const result = db.prepare(`
    UPDATE featured_clips
    SET likes = likes + 1
    WHERE id = ?
  `).run(clipId)

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Clip not found' })
  }

  const clip = db.prepare(`
    SELECT fc.*,
           g.name AS game_name,
           g.specific_game,
           grp.name AS group_name,
           u.name AS uploaded_by_name
    FROM featured_clips fc
    JOIN games g ON g.id = fc.game_id
    LEFT JOIN groups grp ON grp.id = fc.group_id
    LEFT JOIN users u ON u.id = fc.uploaded_by
    WHERE fc.id = ?
  `).get(clipId)

  return res.json({ clip: formatClipRow(clip) })
})

module.exports = router

function normalizeClipPayload(body) {
  const gameId = Number(body?.gameId ?? body?.game_id)
  const groupId = body?.groupId == null && body?.group_id == null
    ? null
    : Number(body?.groupId ?? body?.group_id)

  const title = String(body?.title ?? '').trim()
  const description = String(body?.description ?? '').trim()
  const videoUrl = String(body?.videoUrl ?? body?.video_url ?? '').trim()
  const rawTags = Array.isArray(body?.tags)
    ? body.tags
    : String(body?.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)

  const tags = rawTags
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean)

  if (!Number.isInteger(gameId) || gameId <= 0) {
    return { ok: false, error: 'Valid gameId is required' }
  }

  if (groupId != null && (!Number.isInteger(groupId) || groupId <= 0)) {
    return { ok: false, error: 'groupId must be a valid group id when provided' }
  }

  if (!title || !description || !videoUrl || tags.length === 0) {
    return { ok: false, error: 'title, description, videoUrl, and tags are required' }
  }

  if (!/^https?:\/\//i.test(videoUrl)) {
    return { ok: false, error: 'videoUrl must be a full http or https URL' }
  }

  return {
    ok: true,
    value: {
      gameId,
      groupId,
      title,
      description,
      videoUrl,
      tags,
    },
  }
}

function formatClipRow(row) {
  return {
    ...row,
    tags: parseTags(row.tags),
  }
}

function parseTags(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toOptionalInteger(value) {
  if (value == null || value === '') return null

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function isUniqueConstraint(err) {
  return err && typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')
}
