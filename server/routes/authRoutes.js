const { Router } = require('express')
const db = require('../db')
const { hashPassword, comparePassword, signToken } = require('../auth')
const { requireAuth } = require('../middleware')

const router = Router()

router.post('/register', async (req, res) => {
  const { email, name, password } = req.body ?? {}

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' })
  }

  try {
    const password_hash = await hashPassword(password)
    const result = db.prepare(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)'
    ).run(email.toLowerCase().trim(), name.trim(), password_hash)

    const user = { id: result.lastInsertRowid, email: email.toLowerCase().trim(), name: name.trim() }
    const token = signToken(user)
    return res.status(201).json({ token, user })
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim())
  if (!row) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const valid = await comparePassword(password, row.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const user = { id: row.id, email: row.email, name: row.name }
  const token = signToken(user)
  return res.json({ token, user })
})

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id)
  if (!row) return res.status(401).json({ error: 'User not found' })
  return res.json({ user: row })
})

module.exports = router
