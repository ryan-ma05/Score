const db = require('./db')
const { verifyToken } = require('./auth')

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    req.user = verifyToken(token)
    db.prepare('UPDATE users SET last_seen_at = unixepoch() WHERE id = ?').run(req.user.id)
    next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

module.exports = { requireAuth }
