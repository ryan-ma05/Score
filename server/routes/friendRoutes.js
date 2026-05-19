const { Router } = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware')

const router = Router()
router.use(requireAuth)

// GET /api/friends — accepted friends
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, f.id AS friendship_id, f.created_at
    FROM friendships f
    JOIN users u ON u.id = CASE
      WHEN f.requester_id = ? THEN f.addressee_id
      ELSE f.requester_id
    END
    WHERE (f.requester_id = ? OR f.addressee_id = ?)
      AND f.status = 'accepted'
    ORDER BY u.name ASC
  `).all(req.user.id, req.user.id, req.user.id)
  return res.json({ friends: rows })
})

// GET /api/friends/requests — incoming pending requests
router.get('/requests', (req, res) => {
  const rows = db.prepare(`
    SELECT f.id, u.id AS user_id, u.name, u.email, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(req.user.id)
  return res.json({ requests: rows })
})

// GET /api/friends/sent — outgoing pending requests
router.get('/sent', (req, res) => {
  const rows = db.prepare(`
    SELECT f.id, u.id AS user_id, u.name, u.email, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(req.user.id)
  return res.json({ sent: rows })
})

// GET /api/friends/search?q=name — search users by name (excludes self + existing relationships)
router.get('/search', (req, res) => {
  const q = (req.query.q ?? '').trim()
  if (!q || q.length < 2) return res.json({ users: [] })

  const rows = db.prepare(`
    SELECT u.id, u.name, u.email,
      (SELECT status FROM friendships
       WHERE (requester_id = ? AND addressee_id = u.id)
          OR (requester_id = u.id AND addressee_id = ?)
       LIMIT 1) AS friendship_status,
      (SELECT CASE WHEN requester_id = ? THEN 'sent' ELSE 'received' END
       FROM friendships
       WHERE (requester_id = ? AND addressee_id = u.id)
          OR (requester_id = u.id AND addressee_id = ?)
       LIMIT 1) AS friendship_direction
    FROM users u
    WHERE u.id != ? AND u.name LIKE ?
    ORDER BY u.name ASC
    LIMIT 20
  `).all(
    req.user.id, req.user.id,
    req.user.id, req.user.id, req.user.id,
    req.user.id, `%${q}%`
  )
  return res.json({ users: rows })
})

// POST /api/friends/request — send friend request
router.post('/request', (req, res) => {
  const { userId } = req.body ?? {}
  if (!userId) return res.status(400).json({ error: 'userId is required' })
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' })

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!target) return res.status(404).json({ error: 'User not found' })

  const existing = db.prepare(`
    SELECT * FROM friendships
    WHERE (requester_id = ? AND addressee_id = ?)
       OR (requester_id = ? AND addressee_id = ?)
  `).get(req.user.id, userId, userId, req.user.id)

  if (existing) {
    if (existing.status === 'accepted') return res.status(409).json({ error: 'Already friends' })
    if (existing.status === 'pending') {
      // If they already sent us a request, auto-accept
      if (existing.requester_id === userId) {
        db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(existing.id)
        return res.json({ message: 'Friend request accepted', status: 'accepted' })
      }
      return res.status(409).json({ error: 'Friend request already sent' })
    }
    // declined — reset to pending
    db.prepare("UPDATE friendships SET status = 'pending', requester_id = ?, addressee_id = ? WHERE id = ?")
      .run(req.user.id, userId, existing.id)
    return res.json({ message: 'Friend request sent', status: 'pending' })
  }

  db.prepare('INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)').run(req.user.id, userId)
  return res.status(201).json({ message: 'Friend request sent', status: 'pending' })
})

// POST /api/friends/:id/accept
router.post('/:id/accept', (req, res) => {
  const friendshipId = Number(req.params.id)
  const row = db.prepare('SELECT * FROM friendships WHERE id = ?').get(friendshipId)

  if (!row || row.addressee_id !== req.user.id) {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (row.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' })

  db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(friendshipId)
  return res.json({ message: 'Friend request accepted' })
})

// POST /api/friends/:id/decline
router.post('/:id/decline', (req, res) => {
  const friendshipId = Number(req.params.id)
  const row = db.prepare('SELECT * FROM friendships WHERE id = ?').get(friendshipId)

  if (!row || row.addressee_id !== req.user.id) {
    return res.status(404).json({ error: 'Request not found' })
  }
  if (row.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' })

  db.prepare("UPDATE friendships SET status = 'declined' WHERE id = ?").run(friendshipId)
  return res.json({ message: 'Friend request declined' })
})

// DELETE /api/friends/:id — unfriend (friendship_id)
router.delete('/:id', (req, res) => {
  const friendshipId = Number(req.params.id)
  const row = db.prepare('SELECT * FROM friendships WHERE id = ?').get(friendshipId)

  if (!row || (row.requester_id !== req.user.id && row.addressee_id !== req.user.id)) {
    return res.status(404).json({ error: 'Friendship not found' })
  }

  db.prepare('DELETE FROM friendships WHERE id = ?').run(friendshipId)
  return res.json({ message: 'Unfriended' })
})

module.exports = router
